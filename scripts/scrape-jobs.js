#!/usr/bin/env node
/**
 * AI/LLM Job Scraper
 * 
 * Scrapes AI/LLM engineering job listings from multiple sources:
 * 1. Y Combinator Work at a Startup (public API)
 * 2. Wellfound (AngelList Talent) job listings
 * 3. Hacker News "Who is Hiring" monthly thread
 * 4. Known AI company career pages (Greenhouse/Lever)
 * 
 * Usage:
 *   node scripts/scrape-jobs.js                    # Scrape all sources, output to stdout
 *   node scripts/scrape-jobs.js --output jobs.json  # Scrape and save to file
 *   node scripts/scrape-jobs.js --source yc         # Only scrape YC jobs
 *   node scripts/scrape-jobs.js --limit 50          # Limit results per source
 * 
 * Output: JSON array of job objects with normalized schema
 */

const fs = require('fs');

// ─── Configuration ──────────────────────────────────────────────────

const AI_KEYWORDS = [
  'ai', 'artificial intelligence', 'machine learning', 'llm', 'large language model',
  'deep learning', 'nlp', 'natural language', 'transformer', 'gpt', 'generative ai',
  'gen ai', 'neural network', 'computer vision', 'reinforcement learning',
  'vector database', 'embedding', 'rag', 'retrieval augmented', 'langchain',
  'fine-tuning', 'fine tuning', 'prompt engineering', 'diffusion', 'stable diffusion',
  'llama', 'mistral', 'anthropic', 'openai', 'mlops', 'ml infra', 'ai infrastructure',
  'ai/ml', 'ai / ml', 'ml engineer', 'ai engineer', 'ml research',
];

const AI_COMPANY_CAREERS = [
  // Format: [name, url, type]
  // Greenhouse boards (verified working as of May 2026)
  ['Anthropic', 'https://boards.greenhouse.io/anthropic', 'greenhouse'],
  ['Scale AI', 'https://boards.greenhouse.io/scaleai', 'greenhouse'],
  ['Databricks', 'https://boards.greenhouse.io/databricks', 'greenhouse'],
  ['Samsara', 'https://boards.greenhouse.io/samsara', 'greenhouse'],
  ['Applied Intuition', 'https://boards.greenhouse.io/appliedintuition', 'greenhouse'],
  ['Mercury', 'https://boards.greenhouse.io/mercury', 'greenhouse'],
  ['Figma', 'https://boards.greenhouse.io/figma', 'greenhouse'],
  ['Vercel', 'https://boards.greenhouse.io/vercel', 'greenhouse'],
  ['xAI', 'https://boards.greenhouse.io/xai', 'greenhouse'],
  ['Stripe', 'https://boards.greenhouse.io/stripe', 'greenhouse'],
  ['Cloudflare', 'https://boards.greenhouse.io/cloudflare', 'greenhouse'],
  ['Discord', 'https://boards.greenhouse.io/discord', 'greenhouse'],
  ['Reddit', 'https://boards.greenhouse.io/reddit', 'greenhouse'],
  ['Roblox', 'https://boards.greenhouse.io/roblox', 'greenhouse'],
  ['Airbnb', 'https://boards.greenhouse.io/airbnb', 'greenhouse'],
  ['Instacart', 'https://boards.greenhouse.io/instacart', 'greenhouse'],
  ['Brex', 'https://boards.greenhouse.io/brex', 'greenhouse'],
  // Lever boards
  ['Mistral AI', 'https://jobs.lever.co/mistral', 'lever'],
];

// ─── Types ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} JobListing
 * @property {string} id - Unique identifier
 * @property {string} title - Job title
 * @property {string} company - Company name
 * @property {string} [location] - Job location
 * @property {string} [description] - Job description snippet
 * @property {string} url - Link to the job posting
 * @property {string} source - Source where this job was found
 * @property {number} [score] - AI relevance score (0-100)
 * @property {string} [postedAt] - When the job was posted
 */

// ─── HTTP Helper ────────────────────────────────────────────────────

async function fetchJSON(url, headers = {}) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AutoApply-JobScraper/1.0',
        'Accept': 'application/json',
        ...headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[scrape-jobs] Error fetching ${url}:`, error.message);
    return null;
  }
}

// ─── AI Relevance Scoring ──────────────────────────────────────────

function scoreAIRelevance(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  let score = 0;

  for (const kw of AI_KEYWORDS) {
    if (text.includes(kw)) {
      score += 8;
      if (kw.includes('engineer') || kw.includes('research')) score += 4;
    }
  }

  // Title bonus
  const titleLower = title.toLowerCase();
  if (/ai|llm|ml|machine learning/i.test(titleLower)) score += 20;
  if (/engineer|developer/i.test(titleLower)) score += 5;
  if (/senior|staff|principal|lead/i.test(titleLower)) score += 2;

  return Math.min(100, score);
}

// ─── Y Combinator Work at a Startup ─────────────────────────────────

async function scrapeYCJobs(limit = 50) {
  console.log('[scrape-jobs] Fetching YC Work at a Startup jobs...');
  const jobs = [];

  // YC Work at a Startup has a public API endpoint
  const data = await fetchJSON('https://www.workatastartup.com/api/jobs');

  if (!data || !Array.isArray(data)) {
    console.log('[scrape-jobs] YC API returned no data (may need browser scraping)');
    return jobs;
  }

  for (const job of data.slice(0, limit * 2)) {
    const title = job.title || job.role || '';
    const company = job.company_name || job.company || '';
    const desc = job.description || job.body || '';

    const score = scoreAIRelevance(title, desc);

    if (score > 15 || AI_KEYWORDS.some(k => desc.toLowerCase().includes(k))) {
      jobs.push({
        id: `yc-${job.id || Math.random().toString(36).slice(2)}`,
        title,
        company,
        location: job.location || 'Remote',
        description: (desc || '').slice(0, 500),
        url: job.url || `https://www.workatastartup.com/jobs/${job.id}`,
        source: 'Y Combinator',
        score,
        postedAt: job.created_at || job.posted_at || null,
      });
    }

    if (jobs.length >= limit) break;
  }

  console.log(`[scrape-jobs] YC: found ${jobs.length} AI-relevant jobs`);
  return jobs;
}

// ─── Wellfound / AngelList Talent ───────────────────────────────────

async function scrapeWellfoundJobs(limit = 50) {
  console.log('[scrape-jobs] Fetching Wellfound jobs...');
  const jobs = [];

  // Wellfound's public listing page
  const searchTerms = ['ai', 'llm', 'machine-learning', 'deep-learning', 'generative-ai'];
  
  for (const term of searchTerms.slice(0, 2)) { // Limit to 2 terms to avoid rate limiting
    try {
      const data = await fetchJSON(
        `https://wellfound.com/api/job_listings?search=${term}&size=${Math.min(limit, 25)}`,
        { 'X-Requested-With': 'XMLHttpRequest' }
      );

      if (data && Array.isArray(data)) {
        for (const job of data) {
          const title = job.title || '';
          const company = job.company_name || job.startup?.name || '';
          const desc = job.description || job.body || '';

          jobs.push({
            id: `wf-${job.id || Math.random().toString(36).slice(2)}`,
            title,
            company,
            location: job.location || job.locations?.join(', ') || 'Remote',
            description: (desc || '').slice(0, 500),
            url: job.url || (job.id ? `https://wellfound.com/jobs/${job.id}` : ''),
            source: 'Wellfound',
            score: scoreAIRelevance(title, desc),
            postedAt: job.published_at || job.created_at || null,
          });
        }
      }
    } catch (e) {
      console.log(`[scrape-jobs] Wellfound search for "${term}" failed:`, e.message);
    }
  }

  console.log(`[scrape-jobs] Wellfound: found ${jobs.length} jobs`);
  return jobs;
}

// ─── AI Company Career Pages ────────────────────────────────────────

async function scrapeAICompanyCareers(limit = 50) {
  console.log('[scrape-jobs] Fetching AI company career pages...');
  const jobs = [];
  const companiesToFetch = AI_COMPANY_CAREERS; // Fetch all companies

  for (const [company, baseUrl, platform] of companiesToFetch) {
    try {
      let apiUrl;
      if (platform === 'greenhouse') {
        // Greenhouse public API v1: https://developers.greenhouse.io/job-board.html
        const boardToken = baseUrl.split('/').pop();
        apiUrl = `https://api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
      } else if (platform === 'lever') {
        const companySlug = baseUrl.split('/').pop();
        apiUrl = `https://api.lever.co/v0/postings/${companySlug}?mode=json`;
      } else if (platform === 'workable') {
        const companySlug = baseUrl.split('/').pop();
        apiUrl = `https://apply.workable.com/api/v1/widget/accounts/${companySlug}`;
      } else if (platform === 'ashby') {
        const companySlug = baseUrl.split('/').pop();
        apiUrl = `https://jobs.ashbyhq.com/api/non-user/${companySlug}`;
      }

      if (!apiUrl) continue;

      const data = await fetchJSON(apiUrl);

      if (!data) continue;

      // Parse responses differently based on platform
      let rawJobs = [];
      if (platform === 'greenhouse') {
        // Greenhouse v1 API: { jobs: [...] }
        rawJobs = data.jobs || [];
      } else if (platform === 'lever') {
        rawJobs = Array.isArray(data) ? data : (data.postings || data.data || []);
      } else if (platform === 'workable') {
        rawJobs = data.jobs || data.results || [];
      } else if (platform === 'ashby') {
        rawJobs = data.jobs || [];
      }

      for (const job of rawJobs) {
        let title, desc, score, jobUrl;

        if (platform === 'greenhouse') {
          title = job.title || '';
          desc = (job.content || '').replace(/<[^>]*>/g, '').slice(0, 500);
          jobUrl = job.absolute_url || (job.id ? `${baseUrl}/${job.id}` : baseUrl);
          score = scoreAIRelevance(title, desc);
        } else {
          title = job.title || job.text || '';
          desc = (job.description || job.descriptionPlain || '').slice(0, 500);
          score = scoreAIRelevance(title, desc);

          if (platform === 'lever') {
            jobUrl = job.hostedUrl || job.applyUrl || (job.id ? `${baseUrl}/${job.id}` : baseUrl);
          } else if (platform === 'workable') {
            jobUrl = job.url || job.shortlink || baseUrl;
          } else {
            jobUrl = job.url || job.applyUrl || baseUrl;
          }
        }

        if (score > 15) {
          // Greenhouse location is nested: { name: "San Francisco, CA" }
          let loc = job.location;
          if (loc && typeof loc === 'object' && loc.name) loc = loc.name;

          jobs.push({
            id: `${company.toLowerCase().replace(/\s+/g, '-')}-${job.id || Math.random().toString(36).slice(2)}`,
            title,
            company,
            location: loc || 'Remote',
            description: desc,
            url: jobUrl,
            source: `${company} Careers`,
            score,
            postedAt: job.updated_at || job.first_published || job.created_at || job.published_at || null,
          });
        }
      }
    } catch (e) {
      console.log(`[scrape-jobs] Failed to fetch ${company} (${platform}):`, e.message);
    }
  }

  console.log(`[scrape-jobs] AI companies: found ${jobs.length} AI-relevant jobs`);
  return jobs;
}

// ─── Hacker News "Who is Hiring" ────────────────────────────────────

async function scrapeHNJobs(limit = 30) {
  console.log('[scrape-jobs] Fetching Hacker News Who Is Hiring...');
  const jobs = [];

  try {
    // Use Algolia search API to find the latest "Who is Hiring" thread
    const searchData = await fetchJSON(
      'https://hn.algolia.com/api/v1/search?query=Ask+HN:+Who+is+hiring?&tags=story&hitsPerPage=3'
    );

    if (!searchData?.hits?.length) {
      console.log('[scrape-jobs] HN: no hiring thread found');
      return jobs;
    }

    const hiringThread = searchData.hits.find(h =>
      h.title?.toLowerCase().includes('who is hiring') &&
      h.title?.toLowerCase().includes(new Date().getFullYear().toString())
    );

    if (!hiringThread) {
      console.log('[scrape-jobs] HN: no recent hiring thread found');
      return jobs;
    }

    // Fetch the actual thread items via the HN API
    const threadId = hiringThread.objectID;
    const itemData = await fetchJSON(
      `https://hn.algolia.com/api/v1/items/${threadId}`
    );

    if (!itemData?.children?.length) {
      console.log('[scrape-jobs] HN: no comments in hiring thread');
      return jobs;
    }

    for (const comment of itemData.children) {
      const text = comment.text || '';
      if (!text) continue;

      const score = scoreAIRelevance('', text);
      if (score < 15) continue;

      // Extract company and title from the first line
      const firstLine = text.split('\n')[0].trim();
      const parts = firstLine.split('|').map(s => s.trim());
      const company = parts[0] || 'Unknown';
      const title = parts[1] || parts[0] || '';
      const location = parts[2] || '';

      jobs.push({
        id: `hn-${comment.id || Math.random().toString(36).slice(2)}`,
        title: title || 'See description',
        company,
        location: location || 'Remote',
        description: text.slice(0, 500),
        url: `https://news.ycombinator.com/item?id=${threadId}#${comment.id}`,
        source: 'Hacker News',
        score,
        postedAt: hiringThread.created_at,
      });

      if (jobs.length >= limit) break;
    }
  } catch (e) {
    console.log('[scrape-jobs] HN scraping failed:', e.message);
  }

  console.log(`[scrape-jobs] HN: found ${jobs.length} AI-relevant jobs`);
  return jobs;
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const outputFile = args.includes('--output') ? args[args.indexOf('--output') + 1] : null;
  const sourceFilter = args.includes('--source') ? args[args.indexOf('--source') + 1] : null;
  const limit = parseInt(args.includes('--limit') ? args[args.indexOf('--limit') + 1] : '50', 10);

  const scrapers = {
    yc: scrapeYCJobs,
    wellfound: scrapeWellfoundJobs,
    aicompanies: scrapeAICompanyCareers,
    hn: scrapeHNJobs,
  };

  const sourcesToRun = sourceFilter
    ? [[sourceFilter, scrapers[sourceFilter]]].filter(([, fn]) => fn)
    : Object.entries(scrapers);

  if (sourcesToRun.length === 0) {
    console.error(`Unknown source: ${sourceFilter}. Available: ${Object.keys(scrapers).join(', ')}`);
    process.exit(1);
  }

  const allJobs = [];
  const results = await Promise.allSettled(
    sourcesToRun.map(([name, fn]) => fn(limit))
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allJobs.push(...result.value);
    }
  }

  // Deduplicate by URL
  const seen = new Set();
  const uniqueJobs = allJobs.filter(job => {
    if (seen.has(job.url)) return false;
    seen.add(job.url);
    return true;
  });

  // Sort by AI relevance score (highest first)
  uniqueJobs.sort((a, b) => (b.score || 0) - (a.score || 0));

  const output = JSON.stringify(uniqueJobs, null, 2);

  if (outputFile) {
    fs.writeFileSync(outputFile, output);
    console.log(`\n✅ Saved ${uniqueJobs.length} AI/LLM jobs to ${outputFile}`);
  } else {
    console.log(`\n✅ Found ${uniqueJobs.length} AI/LLM job listings:\n`);
    // Print summary
    for (const job of uniqueJobs.slice(0, 20)) {
      const scoreBar = '█'.repeat(Math.round((job.score || 0) / 10));
      console.log(`  ${scoreBar.padEnd(10)} ${job.title} @ ${job.company} — ${job.location || 'Remote'}`);
      console.log(`             ${job.url}`);
      console.log();
    }
    if (uniqueJobs.length > 20) {
      console.log(`  ... and ${uniqueJobs.length - 20} more jobs. Use --output to save all.`);
    }
  }

  return uniqueJobs;
}

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { main, scoreAIRelevance };
