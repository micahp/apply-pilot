#!/usr/bin/env node
/**
 * Job scraper: pulls postings from the public job-board APIs of the companies in
 * scripts/companies.json (Greenhouse, Lever, Ashby) and from the latest Hacker News
 * "Who is hiring?" thread, scores them against your keywords, and writes jobs.json
 * for scripts/auto-apply-playwright.js.
 *
 * Usage:
 *   pnpm scrape                                   # all sources -> jobs.json
 *   pnpm scrape -- --source greenhouse,ashby      # some sources
 *   pnpm scrape -- --keywords "llm,rag,pytorch" --location "remote|austin" --min-score 30
 *   pnpm scrape -- --any-role                     # keep non-engineering titles too
 *   pnpm scrape -- --companies my-companies.json --output jobs.json
 */

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('util');

const ROOT = path.resolve(__dirname, '..');

const DEFAULT_KEYWORDS = [
  'ai', 'ml', 'llm', 'llms', 'machine learning', 'deep learning', 'artificial intelligence', 'generative ai', 'genai',
  'nlp', 'natural language', 'large language model', 'transformer', 'transformers', 'rag', 'retrieval', 'embeddings',
  'vector database', 'fine-tuning', 'fine tuning', 'inference', 'pytorch', 'evals', 'agents', 'mlops', 'computer vision',
  'reinforcement learning', 'prompt engineering',
];

const NON_ENGINEERING_TITLE = /\b(recruit(er|ing)|sourcer|sales|account (executive|manager)|marketing|counsel|legal|attorney|paralegal|administrative|business partner|executive assistant|customer success|talent)\b/i;
const ENGINEERING_TITLE = /\b(engineer|engineering|developer|scientist|research(er)?|architect|swe|sde|technical staff|mts|programmer|tech lead)\b/i;

// ─── Text helpers ───────────────────────────────────────────────────

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'", '#x2F': '/' };

function decodeEntities(text) {
  return String(text || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, code) => {
    if (ENTITIES[code] !== undefined) return ENTITIES[code];
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return m;
  });
}

/** HTML (possibly entity-escaped, as Greenhouse returns it) to readable plain text. */
function htmlToText(html) {
  let text = decodeEntities(html);
  if (/<[a-z]/i.test(text)) {
    text = text
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<[^>]+>/g, '');
    text = decodeEntities(text);
  }
  return text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*/g, '\n\n').trim();
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Score 0-100 from whole-word keyword hits: title hits count much more than description
 * hits. Plain substring matching (the old approach) made "ai" match "maintain".
 */
function scoreJob(title, description, keywords = DEFAULT_KEYWORDS) {
  const matched = [];
  let titleScore = 0;
  let descriptionScore = 0;
  for (const kw of keywords) {
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(kw.toLowerCase())}([^a-z0-9]|$)`, 'i');
    if (re.test(title)) {
      titleScore += 30;
      matched.push(kw);
    } else if (re.test(description)) {
      descriptionScore += 5;
      matched.push(kw);
    }
  }
  // Title relevance dominates; a long description can't make an unrelated title rank high.
  return { score: Math.min(60, titleScore) + Math.min(40, descriptionScore), matched };
}

// ─── Source parsers (pure; exported for tests) ──────────────────────

function parseGreenhouse(data, company) {
  return (data.jobs || []).map((j) => {
    const remote = /remote/i.test(j.location?.name || '') || (j.metadata || []).some((m) => /remote/i.test(String(m.value)));
    return {
      id: `greenhouse:${company.slug}:${j.id}`,
      title: j.title,
      company: j.company_name || company.name,
      location: j.location?.name || '',
      remote,
      department: j.departments?.[0]?.name || '',
      url: j.absolute_url,
      platform: 'greenhouse',
      postedAt: j.first_published || j.updated_at || null,
      description: htmlToText(j.content),
    };
  });
}

function parseLever(data, company) {
  return (Array.isArray(data) ? data : []).map((j) => {
    const location = (j.categories?.allLocations || [j.categories?.location]).filter(Boolean).join('; ');
    return {
      id: `lever:${company.slug}:${j.id}`,
      title: j.text,
      company: company.name,
      location,
      remote: j.workplaceType === 'remote' || /remote/i.test(location),
      department: j.categories?.team || '',
      url: j.hostedUrl,
      platform: 'lever',
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      description: (j.descriptionPlain || htmlToText(j.description)).trim(),
    };
  });
}

function parseAshby(data, company) {
  return (data.jobs || [])
    .filter((j) => j.isListed !== false)
    .map((j) => {
      const locations = [j.location, ...(j.secondaryLocations || []).map((l) => l.location)].filter(Boolean);
      return {
        id: `ashby:${company.slug}:${j.id}`,
        title: j.title,
        company: company.name,
        location: locations.join('; '),
        remote: j.isRemote === true || j.workplaceType === 'Remote' || /remote/i.test(locations.join(' ')),
        department: j.department || '',
        url: j.jobUrl,
        platform: 'ashby',
        postedAt: j.publishedAt || null,
        compensation: j.compensation?.compensationTierSummary || undefined,
        description: (j.descriptionPlain || htmlToText(j.descriptionHtml)).trim(),
      };
    });
}

/**
 * HN "Who is hiring?" comments conventionally start "Company | Role | Location | ...".
 * We keep comments whose header has at least 3 segments, and point `url` at the first
 * link in the post (usually the careers page) or the comment itself.
 */
function parseHnItem(item) {
  const jobs = [];
  for (const c of item.children || []) {
    if (!c.text) continue;
    const firstLine = htmlToText(c.text.split(/<p>/i)[0]).split('\n')[0];
    const segments = firstLine.split(/\s+[|—–]\s+|\s\|\s?/).map((s) => s.trim()).filter(Boolean);
    if (segments.length < 3) continue;
    const role = segments.find((s, i) => i > 0 && ENGINEERING_TITLE.test(s)) || segments[1];
    const location = segments.find((s) => /remote|onsite|on-site|hybrid|\b[A-Z]{2}\b|,/i.test(s) && s !== role && s !== segments[0]) || '';
    const link = decodeEntities((c.text.match(/href="([^"]+)"/) || [])[1] || '');
    const commentUrl = `https://news.ycombinator.com/item?id=${c.id}`;
    jobs.push({
      id: `hn:${c.id}`,
      title: role,
      company: segments[0].replace(/\s*\(.*?\)\s*$/, ''),
      location,
      remote: /remote/i.test(firstLine),
      department: '',
      url: link && /^https?:/.test(link) ? link : commentUrl,
      discussionUrl: commentUrl,
      platform: 'hn',
      postedAt: c.created_at || item.created_at || null,
      description: htmlToText(c.text),
    });
  }
  return jobs;
}

// ─── HTTP ───────────────────────────────────────────────────────────

async function fetchJson(url, { retries = 3, timeoutMs = 20000 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'apply-pilot-job-scraper' }, signal: controller.signal });
      if (res.ok) return await res.json();
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= retries) throw new Error(`HTTP ${res.status} for ${url}`);
    } catch (error) {
      if (attempt >= retries || /HTTP 4\d\d/.test(error.message)) throw error;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
}

async function pool(items, limit, fn) {
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    })
  );
  return results;
}

const BOARD_APIS = {
  greenhouse: (slug) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`,
  lever: (slug) => `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`,
  ashby: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`,
};
const PARSERS = { greenhouse: parseGreenhouse, lever: parseLever, ashby: parseAshby };

async function scrapeCompanies(companies) {
  const report = [];
  const results = await pool(companies, 6, async (company) => {
    try {
      const jobs = PARSERS[company.platform](await fetchJson(BOARD_APIS[company.platform](company.slug)), company);
      report.push({ source: `${company.platform}:${company.slug}`, ok: true, count: jobs.length });
      return jobs;
    } catch (error) {
      report.push({ source: `${company.platform}:${company.slug}`, ok: false, error: error.message });
      return [];
    }
  });
  return { jobs: results.flat(), report };
}

async function scrapeHn() {
  try {
    const search = await fetchJson('https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=10');
    const thread = (search.hits || []).find((h) => /who is hiring/i.test(h.title));
    if (!thread) return { jobs: [], report: [{ source: 'hn', ok: false, error: 'no "Who is hiring?" thread found' }] };
    const jobs = parseHnItem(await fetchJson(`https://hn.algolia.com/api/v1/items/${thread.objectID}`, { timeoutMs: 60000 }));
    return { jobs, report: [{ source: `hn:${thread.title}`, ok: true, count: jobs.length }] };
  } catch (error) {
    return { jobs: [], report: [{ source: 'hn', ok: false, error: error.message }] };
  }
}

// ─── Filtering ──────────────────────────────────────────────────────

function rankJobs(jobs, opts) {
  const location = opts.location ? new RegExp(opts.location, 'i') : null;
  const seen = new Set();
  return jobs
    .filter((j) => j.url && j.title && !seen.has(j.url) && seen.add(j.url))
    .filter((j) => opts.anyRole || (ENGINEERING_TITLE.test(j.title) && !NON_ENGINEERING_TITLE.test(j.title)))
    .filter((j) => !location || location.test(j.location) || (j.remote && location.test('remote')))
    .map((j) => ({ ...j, ...scoreJob(j.title, j.description, opts.keywords), description: j.description.slice(0, 4000) }))
    .filter((j) => j.score >= opts.minScore)
    .sort((a, b) => b.score - a.score);
}

// ─── CLI ────────────────────────────────────────────────────────────

function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      source: { type: 'string', default: 'greenhouse,lever,ashby,hn' },
      companies: { type: 'string', default: path.join(__dirname, 'companies.json') },
      output: { type: 'string', default: path.join(ROOT, 'jobs.json') },
      keywords: { type: 'string' },
      location: { type: 'string' },
      'min-score': { type: 'string', default: '20' },
      'any-role': { type: 'boolean', default: false },
    },
  });
  const sources = values.source.split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = sources.filter((s) => !['greenhouse', 'lever', 'ashby', 'hn'].includes(s));
  if (unknown.length) throw new Error(`unknown --source ${unknown.join(', ')} (use greenhouse, lever, ashby, hn)`);
  const minScore = Number(values['min-score']);
  if (!Number.isFinite(minScore)) throw new Error('--min-score must be a number');
  return {
    sources,
    companiesFile: path.resolve(values.companies),
    output: path.resolve(values.output),
    keywords: values.keywords ? values.keywords.split(',').map((k) => k.trim()).filter(Boolean) : DEFAULT_KEYWORDS,
    location: values.location,
    minScore,
    anyRole: values['any-role'],
  };
}

async function main() {
  const opts = parseCli(process.argv.slice(2));
  const companies = JSON.parse(fs.readFileSync(opts.companiesFile, 'utf8')).filter((c) => opts.sources.includes(c.platform));

  const parts = await Promise.all([
    scrapeCompanies(companies),
    opts.sources.includes('hn') ? scrapeHn() : Promise.resolve({ jobs: [], report: [] }),
  ]);
  const all = parts.flatMap((p) => p.jobs);
  const report = parts.flatMap((p) => p.report);
  const ranked = rankJobs(all, opts);

  const failed = report.filter((r) => !r.ok);
  console.log(`[scrape] ${report.length - failed.length}/${report.length} sources ok · ${all.length} postings · ${ranked.length} kept (min score ${opts.minScore})`);
  for (const r of failed) console.warn(`[scrape] FAILED ${r.source}: ${r.error}`);

  fs.writeFileSync(opts.output, JSON.stringify(ranked, null, 2));
  console.log(`[scrape] wrote ${path.relative(process.cwd(), opts.output)}`);
  for (const j of ranked.slice(0, 15)) {
    console.log(`  ${String(j.score).padStart(3)}  ${j.title} @ ${j.company} — ${j.location || (j.remote ? 'Remote' : '?')}`);
  }
  if (report.length > 0 && failed.length === report.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[scrape] ${error.message}`);
    process.exit(1);
  });
}

module.exports = { htmlToText, parseAshby, parseGreenhouse, parseHnItem, parseLever, rankJobs, scoreJob, DEFAULT_KEYWORDS };
