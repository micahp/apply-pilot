#!/usr/bin/env node
/**
 * Auto-apply runner.
 *
 * For each job in jobs.json: open the application form, fill it with the same engine the
 * extension uses, attach the resume, and either stop for review (default) or submit.
 * It only submits when every required question is answered and no CAPTCHA is showing,
 * and only records "submitted" after the site confirms it.
 *
 * Usage:
 *   pnpm auto-apply                      # fill + screenshot/review, never submit
 *   pnpm auto-apply -- --submit          # submit forms that are complete
 *   Options: --jobs jobs.json --profile profile.json --results apply-results.json
 *            --limit N --min-score N --location <regex> --only <url substring>
 *            --headless --retry (re-attempt jobs that previously needed review/failed)
 *
 * Statuses written to the results file:
 *   submitted     site showed an application-received confirmation
 *   ready         complete and valid, not submitted (review mode)
 *   needs-review  required questions unanswered; see `unanswered` and add customAnswers
 *   needs-human   a CAPTCHA challenge is showing
 *   rejected      submit was clicked but the site reported validation errors
 *   unconfirmed   submit was clicked but no confirmation appeared
 *   no-form       no application form could be found
 *   error         navigation or script failure
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { parseArgs } = require('util');

const ROOT = path.resolve(__dirname, '..');
const ENGINE_IIFE = path.join(ROOT, 'dist/autofill/autofill.iife.js');
const ENGINE_CJS = path.join(ROOT, 'dist/autofill/autofill.cjs');

const RETRYABLE = new Set(['needs-review', 'needs-human', 'rejected', 'unconfirmed', 'no-form', 'error']);

// ─── Pure helpers (exported for tests) ──────────────────────────────

function detectPlatform(url) {
  const host = new URL(url).hostname;
  if (/greenhouse\.io$/.test(host)) return 'greenhouse';
  if (host === 'jobs.lever.co') return 'lever';
  if (host === 'jobs.ashbyhq.com') return 'ashby';
  if (/workable\.com$/.test(host)) return 'workable';
  if (/myworkdayjobs\.com$/.test(host)) return 'workday';
  return 'other';
}

/** Where the application form lives, when the platform puts it on a predictable URL. */
function applicationUrl(url) {
  const u = new URL(url);
  const clean = u.pathname.replace(/\/+$/, '');
  switch (detectPlatform(url)) {
    case 'lever':
      return clean.endsWith('/apply') ? u.href : `${u.origin}${clean}/apply`;
    case 'ashby':
      return clean.endsWith('/application') ? u.href : `${u.origin}${clean}/application`;
    case 'workable':
      return /\/apply$/.test(clean) ? u.href : `${u.origin}${clean}/apply/`;
    default:
      return u.href;
  }
}

function selectJobs(jobs, previous, opts) {
  const location = opts.location ? new RegExp(opts.location, 'i') : null;
  return jobs
    .filter((job) => job && job.url)
    .filter((job) => (job.score ?? 0) >= opts.minScore)
    .filter((job) => !location || location.test(`${job.location || ''} ${job.remote ? 'remote' : ''}`))
    .filter((job) => !opts.only || job.url.includes(opts.only))
    .filter((job) => {
      const prior = previous.get(job.url);
      if (!prior) return true;
      if (prior.status === 'submitted') return false; // never apply twice
      return opts.retry && RETRYABLE.has(prior.status);
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, opts.limit);
}

function decide(report) {
  if (report.captcha.blocking) return { status: 'needs-human', reason: `CAPTCHA (${report.captcha.kinds.join(', ')})` };
  if (report.requiredUnanswered.length > 0) {
    return { status: 'needs-review', reason: `${report.requiredUnanswered.length} required question(s) unanswered` };
  }
  return { status: 'ready', reason: 'all required questions answered' };
}

function loadResults(file) {
  if (!fs.existsSync(file)) return new Map();
  const records = JSON.parse(fs.readFileSync(file, 'utf8'));
  return new Map(records.map((r) => [r.url, r]));
}

function saveResults(file, results) {
  fs.writeFileSync(file, JSON.stringify(Array.from(results.values()), null, 2));
}

function slug(text) {
  return String(text || 'job').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 60);
}

// ─── Browser steps ──────────────────────────────────────────────────

const engineSource = () => fs.readFileSync(ENGINE_IIFE, 'utf8');

async function injectEngine(frame) {
  const loaded = await frame.evaluate(() => Boolean(window.AutoApplyEngine)).catch(() => false);
  if (!loaded) await frame.addScriptTag({ content: engineSource() });
}

/** The frame holding the application form (Greenhouse is often embedded in an iframe). */
async function findFormFrame(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      try {
        await injectEngine(frame);
        const found = await frame.evaluate(() => {
          const root = window.AutoApplyEngine.findApplicationRoot(document);
          return root !== document.body || Boolean(document.querySelector('input[type="email"], input[name*="email" i]'));
        });
        if (found) return frame;
      } catch {
        // Frame navigated or detached mid-check; try again next round.
      }
    }
    await page.waitForTimeout(500);
  }
  return null;
}

/** On a job description page, click through to the application form. */
async function clickApply(page) {
  const apply = page
    .locator('a, button')
    .filter({ hasText: /^\s*(apply( now| for this (job|position|role))?|i'?m interested)\s*$/i })
    .first();
  if ((await apply.count()) === 0) return page;
  const popup = page.context().waitForEvent('page', { timeout: 5000 }).catch(() => null);
  await apply.click();
  const opened = await popup;
  const target = opened || page;
  await target.waitForLoadState('domcontentloaded').catch(() => {});
  return target;
}

async function fill(frame, profile, job, options = {}) {
  return frame.evaluate(
    async ({ profile, job, options }) => {
      const engine = window.AutoApplyEngine;
      return engine.fillForm(engine.findApplicationRoot(document), engine.normalizeProfile(profile), { job, ...options });
    },
    { profile, job, options }
  );
}

async function attachFiles(frame, report, profile) {
  const attached = [];
  for (const field of report.filesNeeded) {
    const file = field.key === 'resume' ? profile.resumePath : field.key === 'coverLetterFile' ? profile.coverLetterPath : null;
    if (!file) continue;
    await frame.setInputFiles(`[data-autoapply-id="${field.id}"]`, file);
    attached.push(field.key);
  }
  return attached;
}

async function submit(page, frame) {
  const marked = await frame.evaluate(() => {
    const engine = window.AutoApplyEngine;
    const button = engine.findSubmitButton(engine.findApplicationRoot(document));
    if (!button) return false;
    button.setAttribute('data-autoapply-submit', 'true');
    return true;
  });
  if (!marked) return { status: 'unconfirmed', reason: 'no submit button found' };

  const startUrl = page.url();
  await frame.click('[data-autoapply-submit="true"]');

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(1000);
    for (const f of page.frames()) {
      try {
        await injectEngine(f);
        const state = await f.evaluate(() => ({
          confirmed: window.AutoApplyEngine.detectConfirmation(document),
          captcha: window.AutoApplyEngine.detectCaptcha(document),
          errors: window.AutoApplyEngine.validationErrors(document),
        }));
        if (state.confirmed) return { status: 'submitted', reason: 'confirmation shown' };
        if (state.captcha.blocking) return { status: 'needs-human', reason: 'CAPTCHA challenge after submit' };
        if (state.errors.length > 0 && f === frame) return { status: 'rejected', reason: state.errors.join('; ') };
      } catch {
        // Navigation in progress.
      }
    }
    if (/confirm|thank|success|submitted/i.test(page.url()) && page.url() !== startUrl) {
      return { status: 'submitted', reason: `redirected to ${page.url()}` };
    }
  }
  return { status: 'unconfirmed', reason: 'no confirmation within 20s' };
}

function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(prompt, () => {
    rl.close();
    resolve();
  }));
}

/**
 * Apply to one job in a fresh browser context. Returns a result record; never throws.
 */
async function applyToJob(browser, job, profile, opts) {
  const record = { url: job.url, title: job.title, company: job.company, attemptedAt: new Date().toISOString() };
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let page = await context.newPage();

  try {
    await page.goto(applicationUrl(job.url), { waitUntil: 'domcontentloaded', timeout: 45000 });
    let frame = await findFormFrame(page, 8000);
    if (!frame) {
      page = await clickApply(page);
      frame = await findFormFrame(page, 10000);
    }
    if (!frame) return { ...record, status: 'no-form', reason: 'no application form found (may require an account or external site)' };

    const jobContext = { company: job.company, title: job.title };
    let report = await fill(frame, profile, jobContext);
    const attached = await attachFiles(frame, report, profile);
    if (attached.length > 0) {
      // Some ATSs parse the resume and reveal or prefill fields; fill again without clobbering.
      await page.waitForTimeout(1500);
      report = await fill(frame, profile, jobContext);
    }

    const summary = {
      filled: report.results.filter((r) => r.status === 'filled').length,
      attached,
      unanswered: report.requiredUnanswered.map((r) => ({ question: r.question, status: r.status, detail: r.message })),
    };
    let outcome = decide(report);

    if (outcome.status === 'ready' && opts.submit) {
      outcome = await submit(page, frame);
    } else if (!opts.headless) {
      console.log(`  ${outcome.reason}. Review the browser window${outcome.status === 'ready' ? ' and submit if it looks right' : ''}.`);
      for (const q of summary.unanswered) console.log(`    - ${q.question || '(unlabeled)'} [${q.status}]`);
      await waitForEnter('  Press Enter to continue to the next job… ');
      const confirmed = await frame.evaluate(() => window.AutoApplyEngine.detectConfirmation(document)).catch(() => false);
      if (confirmed) outcome = { status: 'submitted', reason: 'submitted manually during review' };
    }

    if (outcome.status !== 'submitted') {
      fs.mkdirSync(opts.screenshotDir, { recursive: true });
      const shot = path.join(opts.screenshotDir, `${slug(job.company)}_${slug(job.title)}.png`);
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
      summary.screenshot = path.relative(ROOT, shot);
    }
    return { ...record, ...outcome, ...summary };
  } catch (error) {
    return { ...record, status: 'error', reason: error instanceof Error ? error.message.split('\n')[0] : String(error) };
  } finally {
    await context.close().catch(() => {});
  }
}

// ─── CLI ────────────────────────────────────────────────────────────

function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      submit: { type: 'boolean', default: false },
      headless: { type: 'boolean', default: false },
      retry: { type: 'boolean', default: false },
      jobs: { type: 'string', default: path.join(ROOT, 'jobs.json') },
      profile: { type: 'string', default: path.join(ROOT, 'profile.json') },
      results: { type: 'string', default: path.join(ROOT, 'apply-results.json') },
      screenshots: { type: 'string', default: path.join(ROOT, 'screenshots') },
      limit: { type: 'string', default: '25' },
      'min-score': { type: 'string', default: '0' },
      location: { type: 'string' },
      only: { type: 'string' },
      'delay-ms': { type: 'string', default: '4000' },
    },
  });
  const int = (name) => {
    const n = Number(values[name]);
    if (!Number.isFinite(n) || n < 0) throw new Error(`--${name} must be a non-negative number`);
    return n;
  };
  return {
    submit: values.submit,
    headless: values.headless,
    retry: values.retry,
    jobsFile: path.resolve(values.jobs),
    profileFile: path.resolve(values.profile),
    resultsFile: path.resolve(values.results),
    screenshotDir: path.resolve(values.screenshots),
    limit: int('limit'),
    minScore: int('min-score'),
    location: values.location,
    only: values.only,
    delayMs: int('delay-ms'),
  };
}

function loadProfile(file) {
  if (!fs.existsSync(ENGINE_CJS)) throw new Error('Engine bundle missing; run `pnpm build:autofill` first.');
  const { normalizeProfile, validateProfile } = require(ENGINE_CJS);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const problems = validateProfile(normalizeProfile(raw));
  if (problems.length > 0) throw new Error(`profile ${file} is incomplete:\n  - ${problems.join('\n  - ')}`);

  const resolveFile = (p) => (p ? path.resolve(path.dirname(file), p) : undefined);
  const profile = { ...raw, resumePath: resolveFile(raw.resumePath), coverLetterPath: resolveFile(raw.coverLetterPath) };
  for (const key of ['resumePath', 'coverLetterPath']) {
    if (profile[key] && !fs.existsSync(profile[key])) throw new Error(`${key} does not exist: ${profile[key]}`);
  }
  if (!profile.resumePath) console.warn('[auto-apply] No resumePath in profile; most forms require a resume and will end up needs-review.');
  return profile;
}

function printSummary(results, resultsFile) {
  const byStatus = {};
  const questions = {};
  for (const r of results) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    for (const q of r.unanswered || []) questions[q.question] = (questions[q.question] || 0) + 1;
  }
  console.log('\n── Summary ─────────────────────────────────────');
  for (const [status, count] of Object.entries(byStatus)) console.log(`  ${status.padEnd(13)} ${count}`);
  const common = Object.entries(questions).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (common.length > 0) {
    console.log('\n  Most common unanswered questions (add these to customAnswers in your profile):');
    for (const [q, n] of common) console.log(`    ${String(n).padStart(3)}× ${q}`);
  }
  console.log(`\n  Results: ${path.relative(process.cwd(), resultsFile)}`);
}

async function main() {
  const opts = parseCli(process.argv.slice(2));
  const profile = loadProfile(opts.profileFile);
  const jobs = JSON.parse(fs.readFileSync(opts.jobsFile, 'utf8'));
  const results = loadResults(opts.resultsFile);
  const selected = selectJobs(jobs, results, opts);

  console.log(`[auto-apply] ${opts.submit ? 'SUBMIT' : 'REVIEW'} mode · ${selected.length} of ${jobs.length} jobs selected`);
  if (selected.length === 0) return;

  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: opts.headless, executablePath: process.env.CHROMIUM_PATH || undefined });
  const run = [];
  try {
    for (const [i, job] of selected.entries()) {
      console.log(`\n[${i + 1}/${selected.length}] ${job.title} @ ${job.company}\n  ${job.url}`);
      const result = await applyToJob(browser, job, profile, opts);
      console.log(`  → ${result.status}: ${result.reason}`);
      results.set(job.url, result);
      saveResults(opts.resultsFile, results);
      run.push(result);
      if (i < selected.length - 1) await new Promise((r) => setTimeout(r, opts.delayMs * (0.75 + Math.random() / 2)));
    }
  } finally {
    await browser.close();
  }
  printSummary(run, opts.resultsFile);
  if (run.some((r) => r.status === 'error')) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[auto-apply] ${error.message}`);
    process.exit(1);
  });
}

module.exports = { applicationUrl, applyToJob, decide, detectPlatform, loadProfile, parseCli, selectJobs };
