#!/usr/bin/env node
/**
 * Auto-Apply Playwright Automation Script
 * 
 * Reads scraped jobs from jobs.json and a user profile from profile.json,
 * then navigates to each job's application page, fills in the form,
 * and submits (or stops for review based on --mode).
 * 
 * Usage:
 *   node scripts/auto-apply-playwright.js                    # Review mode (fills, stops before submit)
 *   node scripts/auto-apply-playwright.js --submit           # Auto-submit mode
 *   node scripts/auto-apply-playwright.js --headless         # Run headless
 *   node scripts/auto-apply-playwright.js --limit 5          # Limit applications
 *   node scripts/auto-apply-playwright.js --profile my-profile.json
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────

const JOBS_FILE = path.resolve(__dirname, '..', 'jobs.json');
const DEFAULT_PROFILE = path.resolve(__dirname, '..', 'profile.json');
const RESULTS_FILE = path.resolve(__dirname, '..', 'apply-results.json');
const EXTENSION_PATH = path.resolve(__dirname, '..', 'dist', 'apps', 'extension');

// ─── Parse Args ──────────────────────────────────────────────────

const args = process.argv.slice(2);
const config = {
  submit: args.includes('--submit'),
  headless: args.includes('--headless'),
  limit: parseInt(args.includes('--limit') ? args[args.indexOf('--limit') + 1] : '999', 10),
  profilePath: args.includes('--profile') ? args[args.indexOf('--profile') + 1] : DEFAULT_PROFILE,
};

console.log(`[auto-apply] Mode: ${config.submit ? 'AUTO-SUBMIT' : 'REVIEW (fills, stops before submit)'}`);
console.log(`[auto-apply] Headless: ${config.headless}`);
console.log(`[auto-apply] Max applications: ${config.limit}`);

// ─── Load Data ────────────────────────────────────────────────────

let jobs, profileData;

try {
  jobs = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
  console.log(`[auto-apply] Loaded ${jobs.length} jobs from jobs.json`);
} catch (e) {
  console.error(`[auto-apply] ERROR: Could not load jobs.json: ${e.message}`);
  process.exit(1);
}

try {
  profileData = JSON.parse(fs.readFileSync(config.profilePath, 'utf-8'));
  console.log(`[auto-apply] Loaded profile from ${config.profilePath}`);
} catch (e) {
  console.error(`[auto-apply] ERROR: Could not load profile.json: ${e.message}`);
  console.error(`[auto-apply] Create one from profile.example.json`);
  process.exit(1);
}

// Validate profile
if (!profileData.personal?.firstName || !profileData.personal?.email) {
  console.error('[auto-apply] ERROR: Profile must have at least firstName and email set.');
  process.exit(1);
}

// ─── Utility Functions ────────────────────────────────────────────

/**
 * Human-like typing with random delays
 */
async function typeLikeHuman(page, selector, text, options = {}) {
  if (!text) return;
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.click(selector);
    await page.fill(selector, '');
    // Slow type with delay
    await page.type(selector, text, { delay: Math.random() * 50 + 20 });
    if (options.blur) await page.keyboard.press('Tab');
  } catch (e) {
    // Silently skip if field not found
  }
}

/**
 * Select from dropdown/radio/checkbox
 */
async function selectOption(page, selector, value) {
  if (!value) return;
  try {
    await page.waitForSelector(selector, { timeout: 3000 });
    await page.selectOption(selector, { label: value });
  } catch {
    try {
      await page.selectOption(selector, value);
    } catch {
      // Skip
    }
  }
}

/**
 * Click a radio button by label text
 */
async function clickRadio(page, labelPattern) {
  try {
    const label = page.locator('label').filter({ hasText: labelPattern }).first();
    if (await label.count() > 0) {
      await label.click();
      return true;
    }
    // Try clicking the radio input directly
    const radio = page.locator(`input[type="radio"][value*="${labelPattern}" i]`).first();
    if (await radio.count() > 0) {
      await radio.click();
      return true;
    }
  } catch {}
  return false;
}

/**
 * Detect ATS platform from URL
 */
function detectPlatform(url) {
  if (url.includes('greenhouse.io') || url.includes('job-boards.greenhouse.io')) return 'greenhouse';
  if (url.includes('jobs.lever.co') || url.includes('lever.co')) return 'lever';
  if (url.includes('workable.com')) return 'workable';
  if (url.includes('ashbyhq.com')) return 'ashby';
  if (url.includes('myworkdayjobs.com') || url.includes('workday.com')) return 'workday';
  return 'generic';
}

// ─── Platform-Specific Fillers ────────────────────────────────────

async function fillGreenhouse(page, profile) {
  console.log('  [greenhouse] Filling application...');
  const p = profile.personal;
  const prefs = profile.preferences || {};

  // Name fields
  await typeLikeHuman(page, '#first_name', p.firstName);
  await typeLikeHuman(page, '#last_name', p.lastName);
  await typeLikeHuman(page, 'input[name*="email" i]', p.email, { blur: true });
  await typeLikeHuman(page, 'input[name*="phone" i]', p.phone, { blur: true });

  // Location
  await typeLikeHuman(page, 'input[name*="location" i], input[id*="location" i]', `${p.city}, ${p.state}`, { blur: true });

  // LinkedIn / GitHub
  await typeLikeHuman(page, 'input[name*="linkedin" i], input[id*="linkedin" i]', p.linkedIn, { blur: true });
  await typeLikeHuman(page, 'input[name*="github" i], input[id*="github" i]', p.github, { blur: true });
  await typeLikeHuman(page, 'input[name*="website" i], input[id*="website" i]', p.website, { blur: true });

  // Resume upload
  if (profile.resumePath && fs.existsSync(profile.resumePath)) {
    try {
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles(profile.resumePath);
        console.log('  [greenhouse] Resume uploaded');
      }
    } catch {}
  }

  // Cover letter
  const coverLetterText = profile.documents?.coverLetterText || profile.coverLetterBase || '';
  const coverLetterField = page.locator('textarea[name*="cover" i], textarea[id*="cover" i], #cover_letter_text').first();
  if (coverLetterText && await coverLetterField.count() > 0) {
    await coverLetterField.fill(coverLetterText);
  }

  // Work authorization
  if (prefs.usWorkAuth) {
    const workAuthVal = prefs.usWorkAuth.toLowerCase().includes('yes') ? 'Yes' : 'No';
    await selectOption(page, 'select[name*="authorization" i], select[id*="authorization" i]', workAuthVal);
    await clickRadio(page, 'authorized');
    await clickRadio(page, 'eligible');
  }

  // Sponsorship
  if (prefs.sponsorshipRequired) {
    const sponsorVal = prefs.sponsorshipRequired.toLowerCase().includes('no') ? 'No' : 'Yes';
    await clickRadio(page, sponsorVal);
  }

  // EEO / Demographic questions (optional — skip if configured)
  // Most Greenhouse forms have these at the end

  // Add any custom questions from profile
  if (profile.customAnswers) {
    for (const [question, answer] of Object.entries(profile.customAnswers)) {
      await typeLikeHuman(page, `input[aria-label*="${question}" i], textarea[aria-label*="${question}" i]`, answer);
    }
  }

  return { filled: true, platform: 'greenhouse' };
}

async function fillLever(page, profile) {
  console.log('  [lever] Filling application...');
  const p = profile.personal;
  const prefs = profile.preferences || {};

  // Lever uses card-based form — typically name, email, phone, resume, links
  await typeLikeHuman(page, 'input[name="name"]', `${p.firstName} ${p.lastName}`);
  await typeLikeHuman(page, 'input[name="email"]', p.email);
  await typeLikeHuman(page, 'input[name="phone"]', p.phone);

  // Location (often a text field or autocomplete)
  await typeLikeHuman(page, 'input[name*="location" i]', `${p.city}, ${p.state}`, { blur: true });

  // LinkedIn
  await typeLikeHuman(page, 'input[name*="urls[LinkedIn]" i], input[name*="linkedin" i]', p.linkedIn);
  await typeLikeHuman(page, 'input[name*="urls[GitHub]" i], input[name*="github" i]', p.github);
  await typeLikeHuman(page, 'input[name*="urls[Portfolio]" i], input[name*="urls[Website]" i]', p.website);

  // Resume upload
  if (profile.resumePath && fs.existsSync(profile.resumePath)) {
    try {
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles(profile.resumePath);
        console.log('  [lever] Resume uploaded');
      }
    } catch {}
  }

  // Cover letter
  const coverText = profile.documents?.coverLetterText || profile.coverLetterBase || '';
  const coverField = page.locator('textarea[name*="comments" i], textarea[name*="cover" i]').first();
  if (coverText && await coverField.count() > 0) {
    await coverField.fill(coverText);
  }

  // Work authorization
  if (prefs.usWorkAuth) await clickRadio(page, 'Yes');
  if (prefs.sponsorshipRequired) await clickRadio(page, 'No');

  return { filled: true, platform: 'lever' };
}

async function fillWorkable(page, profile) {
  console.log('  [workable] Filling application...');
  const p = profile.personal;
  const prefs = profile.preferences || {};

  await typeLikeHuman(page, 'input[name="firstname"]', p.firstName);
  await typeLikeHuman(page, 'input[name="lastname"]', p.lastName);
  await typeLikeHuman(page, 'input[name="email"]', p.email);
  await typeLikeHuman(page, 'input[name="phone"]', p.phone);
  await typeLikeHuman(page, 'input[name="headline"]', 'Senior Software Engineer — AI/LLM');

  // Resume
  if (profile.resumePath && fs.existsSync(profile.resumePath)) {
    try {
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles(profile.resumePath);
        console.log('  [workable] Resume uploaded');
      }
    } catch {}
  }

  // Cover letter / summary
  const coverText = profile.documents?.coverLetterText || profile.coverLetterBase || '';
  const summaryField = page.locator('textarea[name*="summary" i], textarea[name*="cover" i]').first();
  if (coverText && await summaryField.count() > 0) {
    await summaryField.fill(coverText);
  }

  return { filled: true, platform: 'workable' };
}

async function fillGeneric(page, profile) {
  console.log('  [generic] Attempting generic form fill...');
  const p = profile.personal;
  const prefs = profile.preferences || {};

  // Try common field patterns
  const fieldMap = {
    'first': p.firstName,
    'last': p.lastName,
    'email': p.email,
    'phone': p.phone,
    'address': p.address || `${p.city}, ${p.state} ${p.zipCode}`,
    'city': p.city,
    'state': p.state,
    'zip': p.zipCode,
    'linkedin': p.linkedIn,
    'github': p.github,
    'website': p.website,
    'portfolio': p.website,
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (!value) continue;
    try {
      const inputs = page.locator(`input[name*="${key}" i], input[id*="${key}" i], input[placeholder*="${key}" i]`);
      const count = await inputs.count();
      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        if (await input.isVisible()) {
          await input.fill(value);
          break;
        }
      }
    } catch {}
  }

  // Resume upload
  if (profile.resumePath && fs.existsSync(profile.resumePath)) {
    try {
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles(profile.resumePath);
        console.log('  [generic] Resume uploaded');
      }
    } catch {}
  }

  // Cover letter
  const coverText = profile.documents?.coverLetterText || profile.coverLetterBase || '';
  if (coverText) {
    try {
      const textareas = page.locator('textarea');
      const count = await textareas.count();
      for (let i = 0; i < count; i++) {
        const ta = textareas.nth(i);
        if (await ta.isVisible()) {
          await ta.fill(coverText);
          break;
        }
      }
    } catch {}
  }

  return { filled: true, platform: 'generic' };
}

// ─── Main Application Flow ────────────────────────────────────────

async function applyToJob(browser, job, profile, index, total) {
  console.log(`\n[${index + 1}/${total}] ${job.title}`);
  console.log(`  Company: ${job.company}`);
  console.log(`  URL: ${job.url}`);
  console.log(`  Score: ${job.score || 'N/A'}`);

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  let result = { success: false, error: null, filled: false, submitted: false };

  try {
    // Navigate to job page
    console.log('  Navigating...');
    await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const platform = detectPlatform(job.url);
    console.log(`  Detected platform: ${platform}`);

    // Click the "Apply" button — varies by platform
    let applyClicked = false;

    if (platform === 'greenhouse') {
      // Greenhouse: "Apply for this job" button
      const applyBtn = page.locator('#apply_button, a[href*="?gh_jid="], button:has-text("Apply"), a:has-text("Apply")').first();
      if (await applyBtn.count() > 0) {
        await applyBtn.click();
        applyClicked = true;
        await page.waitForTimeout(3000);
      }
    } else if (platform === 'lever') {
      // Lever: Apply button opens form inline or redirects
      const applyBtn = page.locator('a[href*="/apply"], button:has-text("Apply"), .postings-btn').first();
      if (await applyBtn.count() > 0) {
        await applyBtn.click();
        applyClicked = true;
        await page.waitForTimeout(3000);
      }
    } else if (platform === 'workable') {
      // Workable: Apply button
      const applyBtn = page.locator('button[data-ui="apply-button"], a:has-text("Apply")').first();
      if (await applyBtn.count() > 0) {
        await applyBtn.click();
        applyClicked = true;
        await page.waitForTimeout(3000);
      }
    } else {
      // Generic: try common apply button patterns
      const genericApply = page.locator('a:has-text("Apply Now"), button:has-text("Apply"), a:has-text("Apply for"), button:has-text("Submit Application")').first();
      if (await genericApply.count() > 0) {
        await genericApply.click();
        applyClicked = true;
        await page.waitForTimeout(3000);
      }
    }

    if (!applyClicked) {
      console.log('  WARNING: No Apply button found. Job may require external application.');
      result.error = 'No Apply button found';
      return result;
    }

    console.log('  Application form loaded. Filling...');

    // Fill form based on platform
    let fillResult;
    switch (platform) {
      case 'greenhouse': fillResult = await fillGreenhouse(page, profile); break;
      case 'lever': fillResult = await fillLever(page, profile); break;
      case 'workable': fillResult = await fillWorkable(page, profile); break;
      default: fillResult = await fillGeneric(page, profile); break;
    }

    result.filled = fillResult.filled;
    console.log(`  Fields filled on ${platform}`);

    // Submit or review
    if (config.submit) {
      const submitBtn = page.locator('input[type="submit"], button[type="submit"], button:has-text("Submit"), button:has-text("Send")').first();
      if (await submitBtn.count() > 0) {
        await submitBtn.click();
        await page.waitForTimeout(3000);
        result.submitted = true;
        console.log('  ✅ SUBMITTED');
      } else {
        console.log('  ⚠️  No submit button found — filled but not submitted');
      }
    } else {
      if (config.headless) {
        // Take screenshot for review
        const ssDir = path.resolve(__dirname, '..', 'screenshots');
        fs.mkdirSync(ssDir, { recursive: true });
        const ssName = `${job.company.replace(/[^a-zA-Z0-9]/g, '_')}_${index}.png`;
        await page.screenshot({ path: path.join(ssDir, ssName), fullPage: true });
        console.log(`  📸 Screenshot saved: screenshots/${ssName}`);
      } else {
        console.log('  ⏸️  REVIEW MODE: Form filled. Review and submit manually.');
        await page.waitForTimeout(30000);
      }
    }

    result.success = true;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    result.error = error.message;
  } finally {
    await context.close();
  }

  return result;
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  // Filter and sort jobs: US/Remote, high score
  const filtered = jobs
    .filter(j => {
      const loc = (j.location || '').toLowerCase();
      const isUS = /united states|usa|san francisco|new york|palo alto|seattle|remote|austin|boston|denver|chicago|los angeles|dc|mountain view|menlo park/i.test(loc);
      return (j.score || 0) >= 35 && (isUS || loc.includes('remote'));
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, config.limit);

  console.log(`\n[auto-apply] Targeting ${filtered.length} high-relevance US/Remote jobs`);

  const results = [];
  const browser = await chromium.launch({
    headless: config.headless,
    slowMo: config.headless ? 0 : 100, // Slow down in visible mode
  });

  for (let i = 0; i < filtered.length; i++) {
    const result = await applyToJob(browser, filtered[i], profileData, i, filtered.length);
    results.push({
      job: filtered[i],
      result,
      timestamp: new Date().toISOString(),
    });

    // Save incremental results
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

    // Rate limit between applications
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
  }

  await browser.close();

  // Final summary
  const successCount = results.filter(r => r.result.success).length;
  const submittedCount = results.filter(r => r.result.submitted).length;
  const filledCount = results.filter(r => r.result.filled).length;

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  AUTO-APPLY SUMMARY`);
  console.log(`  Total attempted: ${results.length}`);
  console.log(`  Successfully filled: ${filledCount}`);
  console.log(`  Submitted: ${submittedCount}`);
  console.log(`  Results saved to: ${RESULTS_FILE}`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (!config.submit) {
    console.log('💡 To auto-submit, run with --submit flag after reviewing the filled forms.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
