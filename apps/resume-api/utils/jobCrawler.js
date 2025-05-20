/**
 * Basic Job Page Crawler
 *  – Reads active ATS host domains
 *  – Visits a handful of common “listing” paths
 *  – Collects <a> URLs that look like individual job pages
 *  – Inserts or updates each row in job_postings with a SHA-256 of the page HTML
 *
 * NO deep parsing of title/location yet – that’s Phase 2.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url'; // Needed for __dirname in ES modules
import pg from 'pg';
import got from 'got';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import pLimit from 'p-limit';

// --- BEGIN INSTRUMENTATION --- (Commented out as these are locally scoped in runJobCrawler)
// // Initialized in runJobCrawler
// // let hostsVisited = 0;
// // let listingPagesHit = 0;
// // let jobUrlsStored = 0;
// // let httpErrorsByHost = {};
// --- END INSTRUMENTATION ---

const COMMON_PATHS = [
  '/careers',
  '/careers/',
  '/jobs',
  '/jobs/',
  '/job-search',
  '/jobsearch',
  '/search/jobs',
  '/joblisting',
];

const CONCURRENCY = 4;            // politeness
const REQUEST_TIMEOUT = 8000;     // ms
const MINIMUM_JOB_LINKS_PER_PAGE = 3; // Minimum job links to consider a page valid
const MAX_CONSECUTIVE_LISTING_ERRORS = 3; // Number of allowed consecutive 429/403 errors on listing pages
const RATE_LIMIT_ERROR_MARKER = Symbol('RATE_LIMIT_ERROR'); // Unique marker for these errors

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function getActiveHosts() {
  const { rows } = await pool.query(
    `SELECT id, domain, ats_type
       FROM ats_hosts
      WHERE is_active = true`
  );
  return rows;                    // [{ id, domain, ats_type }]
}

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function looksLikeJobLink(href) {
  // Super-simple heuristics; refine later per-ATS
  return /\/job(s)?\/|\/jobs\/\d|\/positions?\/|jobid=/i.test(href);
}

async function fetchHTML(url, domain, httpErrorsByHost) { // Added domain, httpErrorsByHost
  try {
    const res = await got(url, { timeout: { request: REQUEST_TIMEOUT } });
    return res.body;
  } catch (error) {
    const errorMessage = error instanceof got.HTTPError && error.response ? error.response.statusMessage : error.message;
    // console.error(`Error fetching ${url} (Domain: ${domain}): ${errorMessage}`); // Refined logging

    if (domain && httpErrorsByHost) { // Ensure httpErrorsByHost is passed and available
        httpErrorsByHost[domain] = (httpErrorsByHost[domain] || 0) + 1;
    }

    if (error instanceof got.HTTPError && error.response && (error.response.statusCode === 429 || error.response.statusCode === 403)) {
      // console.warn(`Rate limit or forbidden error for ${url} (Domain: ${domain}). Status: ${error.response.statusCode}`);
      return RATE_LIMIT_ERROR_MARKER; // Specific marker for these errors
    }
    return null; // For all other errors
  }
}

// Removed upsertPosting and replaced with processJobPosting
async function processJobPosting({ hostId, url: originalUrl, html, title, location }) {
  if (!html) {
    // console.warn(`processJobPosting: HTML content is missing for URL ${originalUrl}. Skipping.`);
    return false; // Return a status indicating failure/skip
  }

  const newHtmlHash = sha256(html);
  let normalizedUrlObj = new URL(originalUrl);
  let paramsToDelete = [];
  for (const [key] of normalizedUrlObj.searchParams) {
    if (key.toLowerCase() !== 'gh_jid' && key.toLowerCase() !== 'jobid') {
      paramsToDelete.push(key);
    }
  }
  paramsToDelete.forEach(key => normalizedUrlObj.searchParams.delete(key));
  // Ensure pathname starts with a / if it's not empty, or defaults to / if originally empty
  const pathname = normalizedUrlObj.pathname && normalizedUrlObj.pathname.startsWith('/') ? normalizedUrlObj.pathname : (normalizedUrlObj.pathname ? `/${normalizedUrlObj.pathname}` : '/');
  const normalizedUrl = (pathname + normalizedUrlObj.search).toLowerCase();
  const newUrlHash = sha256(normalizedUrl);

  let jobPostingId = null;

  try {
    const { rows } = await pool.query(
      `SELECT id, html_hash, job_title AS old_title, location AS old_location, initial_snapshot_done 
       FROM job_postings 
       WHERE url = $1`,
      [originalUrl]
    );

    if (rows.length > 0) { // Job exists
      const existingJob = rows[0];
      jobPostingId = existingJob.id;
      const currentDbHash = existingJob.html_hash;
      const oldTitle = existingJob.old_title;
      const oldLocation = existingJob.old_location;
      const isInitialSnapshotDone = existingJob.initial_snapshot_done;

      if (!isInitialSnapshotDone) {
        await addJobPostingVersion(jobPostingId, currentDbHash, oldTitle, oldLocation);
        await pool.query('UPDATE job_postings SET initial_snapshot_done = true WHERE id = $1', [jobPostingId]);
      }

      if (newHtmlHash !== currentDbHash) {
        await addJobPostingVersion(jobPostingId, newHtmlHash, title, location);
        await pool.query(
          `UPDATE job_postings 
           SET html_hash = $1, job_title = $2, location = $3, url_hash = $4, last_seen_at = NOW(), status = 'open'
           WHERE id = $5`,
          [newHtmlHash, title, location, newUrlHash, jobPostingId]
        );
      } else { // Hashes are the same
        await pool.query(
          `UPDATE job_postings 
           SET last_seen_at = NOW(), status = 'open', job_title = $1, location = $2, url_hash = $3
           WHERE id = $4`,
          [title, location, newUrlHash, jobPostingId]
        );
      }
    } else { // New job
      const insertResult = await pool.query(
        `INSERT INTO job_postings 
           (ats_host_id, url, html_hash, job_title, location, url_hash, status, initial_snapshot_done, last_seen_at, discovered_at) 
         VALUES ($1, $2, $3, $4, $5, $6, 'open', false, NOW(), NOW()) 
         RETURNING id`,
        [hostId, originalUrl, newHtmlHash, title, location, newUrlHash]
      );
      if (insertResult.rows.length > 0) {
        jobPostingId = insertResult.rows[0].id;
        await addJobPostingVersion(jobPostingId, newHtmlHash, title, location);
        await pool.query('UPDATE job_postings SET initial_snapshot_done = true WHERE id = $1', [jobPostingId]);
      } else {
        console.error(`Failed to insert new job posting for URL ${originalUrl}. RETURNING id did not provide an id.`);
        return false; // Indicate failure
      }
    }
    return true; // Indicate success
  } catch (error) {
    console.error(`Error in processJobPosting for URL ${originalUrl}: ${error.message}`, error.stack);
    return false; // Indicate failure
  }
}

async function addJobPostingVersion(jobPostingId, htmlHash, title, location) {
  if (!jobPostingId || !htmlHash) {
    console.error('addJobPostingVersion: Missing jobPostingId or htmlHash. Skipping version insert.');
    return;
  }
  try {
    await pool.query(
      `INSERT INTO job_posting_versions 
         (job_posting_id, html_hash, job_title, location, snapshot_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [jobPostingId, htmlHash, title, location]
    );
    // console.log(`Added version for job_posting_id ${jobPostingId}: hash ${htmlHash.substring(0,7)}`); // Optional: for debugging
  } catch (error) {
    console.error(`Error adding job posting version for job_posting_id ${jobPostingId}: ${error.message}`);
    // Consider if this error should be propagated or just logged. For now, just log.
  }
}

// Updated signature to include atsConfig and hostErrorStreaks
async function crawlHost(host, httpErrorsByHost, atsConfig, hostErrorStreaks) {
  const { id: hostId, domain, ats_type } = host; // Deconstruct host
  const limit = pLimit(CONCURRENCY);
  let localListingPagesHit = 0;
  let localJobUrlsStored = 0;

  for (const path of COMMON_PATHS) {
    const listingURL = `https://${domain}${path}`;
    const html = await fetchHTML(listingURL, domain, httpErrorsByHost);

    if (html === RATE_LIMIT_ERROR_MARKER) {
      hostErrorStreaks[domain] = (hostErrorStreaks[domain] || 0) + 1;
      console.warn(`Host ${domain} encountered error streak: ${hostErrorStreaks[domain]}/${MAX_CONSECUTIVE_LISTING_ERRORS} on path ${path}`);
      if (hostErrorStreaks[domain] >= MAX_CONSECUTIVE_LISTING_ERRORS) {
        console.error(`Host ${domain} reached max consecutive errors (${MAX_CONSECUTIVE_LISTING_ERRORS}). Skipping this host for the current run.`);
        return { localListingPagesHit, localJobUrlsStored }; // Return early
      }
      continue; // Skip this path, try next path
    } else if (html) { // Successfully fetched HTML (not null, not the error marker)
      hostErrorStreaks[domain] = 0; // Reset streak on success
      localListingPagesHit++; // Increment successfully fetched listing pages
    } else { // html is null (some other error)
      // Optional: could also increment streak here, or handle differently.
      // For now, only 429/403 on listing pages contribute to forced host skipping.
      // Other errors are already counted in httpErrorsByHost.
      continue; // if html is null, skip to next path
    }

    // If we reach here, html is valid content
    const $ = cheerio.load(html);
    const links = new Set();

    const selectors = atsConfig.listingPageSelectors && atsConfig.listingPageSelectors.length > 0 
                      ? atsConfig.listingPageSelectors 
                      : ['a[href]']; // Default if no selectors provided

    selectors.forEach(selector => {
      $(selector).each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        let isLikelyJobLink = looksLikeJobLink(href); // Primary heuristic

        if (!isLikelyJobLink && atsConfig.jobDetailLinkPatterns && atsConfig.jobDetailLinkPatterns.length > 0) {
          // Secondary check using specific patterns from config
          isLikelyJobLink = atsConfig.jobDetailLinkPatterns.some(pattern => {
            try {
              return new RegExp(pattern, 'i').test(href);
            } catch (e) {
              // console.warn(`Invalid regex pattern in atsConfig: ${pattern} for ${domain}`);
              return false;
            }
          });
        }

        if (!isLikelyJobLink) return; // Skip if still not considered a job link

        try {
          const absolute = new URL(href, listingURL).href;
          links.add(absolute);
        } catch (_) {
          // bad URL – skip
        }
      });
    });

    // Check if enough links were found on this listing page
    if (links.size < MINIMUM_JOB_LINKS_PER_PAGE) {
      console.log(`Skipping listing page ${listingURL} - found only ${links.size} potential job links (less than minimum ${MINIMUM_JOB_LINKS_PER_PAGE}).`);
      continue; // Skips to the next path in COMMON_PATHS for the current host
    }

    // Crawl each candidate job page (shallow) in parallel
    const tasks = Array.from(links).map((jobURL) =>
      limit(async () => {
        const jobDomain = new URL(jobURL).hostname; // Get domain from jobURL
        const jobHTML = await fetchHTML(jobURL, jobDomain, httpErrorsByHost); // Pass jobDomain, httpErrorsByHost
        if (!jobHTML) return;

        const $$ = cheerio.load(jobHTML);
        let title = null;
        let location = null;

        if (atsConfig.atsType === 'Workday') {
          $$('script[type="application/ld+json"]').each((index, element) => {
            const scriptContent = $$(element).html();
            if (!scriptContent) return true;
            try {
              const jsonData = JSON.parse(scriptContent);
              if (jsonData && jsonData['@context'] && jsonData['@context'].toLowerCase().includes('schema.org') && jsonData['@type'] === 'JobPosting') {
                let ldTitle = jsonData.title;
                let ldLocation = null;
                if (jsonData.jobLocation) {
                  const jobLoc = Array.isArray(jsonData.jobLocation) ? jsonData.jobLocation[0] : jsonData.jobLocation;
                  if (jobLoc && jobLoc.address) {
                    const address = jobLoc.address;
                    if (typeof address === 'string') ldLocation = address;
                    else if (typeof address === 'object') {
                      let parts = [];
                      if (address.addressLocality) parts.push(address.addressLocality);
                      if (address.addressRegion) parts.push(address.addressRegion);
                      if (parts.length > 0) ldLocation = parts.join(', ');
                    }
                  }
                }
                if (!ldLocation && jsonData.applicantLocationRequirements) {
                  const appLocReq = jsonData.applicantLocationRequirements;
                  if (typeof appLocReq === 'string') ldLocation = appLocReq;
                  else if (typeof appLocReq === 'object' && appLocReq.name) ldLocation = appLocReq.name;
                }
                if (ldTitle && ldLocation) {
                  title = (ldTitle.toString() || '').trim().slice(0, 140);
                  location = (ldLocation.toString() || '').trim();
                  if (location.length > 255) location = location.substring(0, 255);
                  return false; // Exit .each loop
                }
              }
            } catch (e) { /* console.warn(`Error parsing LD+JSON for ${jobURL}: ${e.message}`); */ }
          });
        } else if (atsConfig.atsType === 'iCIMS') {
          title = ($$('h1').first().text() || '').trim().slice(0, 140);

          if (atsConfig.locationSelectors && atsConfig.locationSelectors.length > 0) {
            for (const selector of atsConfig.locationSelectors) {
              const locElement = $$(selector).first();
              let locText = '';
              if (locElement.length) { // Check if element exists
                if (locElement.is('meta')) {
                  locText = locElement.attr('content');
                } else {
                  locText = locElement.text();
                }
              }
              if (locText && locText.trim()) {
                location = locText.trim();
                if (location.length > 255) location = location.substring(0, 255);
                break; // Found location, exit selector loop
              }
            }
          }
        }

        // Generic Fallback for Title (if not set by Workday/iCIMS specific logic)
        if (!title) {
          title = ($$('h1').first().text() || '').trim().slice(0, 140);
        }
        
        // Generic Fallback for Location (if not set by Workday/iCIMS specific logic)
        if (!location) {
          const locMatchFallback = jobHTML.match(/[A-Z][a-zA-Z]+,\s?(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)/);
          if (locMatchFallback) {
            location = locMatchFallback[0];
          }
        }
        
        // Ensure title and location are null if empty after all attempts
        title = title || null;
        location = location || null;

        try {
          const processingSuccessful = await processJobPosting({ hostId, url: jobURL, html: jobHTML, title, location });
          if (processingSuccessful) {
            localJobUrlsStored++; // Increment only on successful processing
          }
          // If !processingSuccessful, processJobPosting already logged the error.
        } catch (processingError) { // Catch any unexpected error from processJobPosting itself
          console.error(`Critical error calling processJobPosting for ${jobURL}: ${processingError.message}`, processingError.stack);
          if (jobDomain && httpErrorsByHost) {
            httpErrorsByHost[jobDomain] = (httpErrorsByHost[jobDomain] || 0) + 1;
          }
        }
      })
    );

    await Promise.allSettled(tasks);
  }
  return { localListingPagesHit, localJobUrlsStored }; // Return collected counts
}

export async function runJobCrawler() {
  // Initialize counters
  let hostsVisited = 0;
  let listingPagesHit = 0;
  let jobUrlsStored = 0;
  let httpErrorsByHost = {}; // Object to store error counts per host domain
  let hostErrorStreaks = {}; // Initialize hostErrorStreaks

  // Load atsConfigs.json
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  let atsConfigs = {};
  try {
    const configPath = path.join(__dirname, 'atsConfigs.json');
    const configFile = fs.readFileSync(configPath, 'utf8');
    atsConfigs = JSON.parse(configFile);
    console.log('Successfully loaded ATS configurations.');
  } catch (error) {
    console.error('Error loading atsConfigs.json:', error.message);
    // Continue with empty atsConfigs, will use FallbackGeneric later.
  }

  const hosts = await getActiveHosts(); // Now returns { id, domain, ats_type }
  for (const host of hosts) {
    hostsVisited++; // Increment for each host processed
    
    const hostAtsType = host.ats_type || 'Generic';
    const specificAtsConfig = atsConfigs[hostAtsType] || atsConfigs['Generic'];
    const finalAtsConfig = specificAtsConfig || { 
      listingPageSelectors: ['a[href]'], // Minimal fallback
      jobDetailLinkPatterns: ['/job', '/career', '/position'], 
      atsType: 'FallbackGeneric' 
    };
    
    console.log(`Crawling host ${host.domain} (${hostsVisited}/${hosts.length}) using ATS config: ${finalAtsConfig.atsType}...`);
    try {
      const { localListingPagesHit, localJobUrlsStored } = await crawlHost(host, httpErrorsByHost, finalAtsConfig, hostErrorStreaks);
      listingPagesHit += localListingPagesHit;
      jobUrlsStored += localJobUrlsStored;
    } catch (crawlError) {
      console.error(`Error crawling host ${host.domain}: ${crawlError.message}`);
      // Optionally, count this as a host-level error if not captured by fetchHTML
      httpErrorsByHost[host.domain] = (httpErrorsByHost[host.domain] || 0) + 1;
    }
  }

  // Log statistics
  console.log('--- Crawl Statistics ---');
  console.log(`Hosts Visited: ${hostsVisited}`);
  console.log(`Listing Pages Successfully Fetched: ${listingPagesHit}`);
  console.log(`Job URLs Attempted for Storage (with HTML): ${jobUrlsStored}`);
  console.log('HTTP/Upsert Errors By Host:');
  if (Object.keys(httpErrorsByHost).length === 0) {
    console.log('  None');
  } else {
    for (const [hostDomain, count] of Object.entries(httpErrorsByHost)) {
      console.log(`  ${hostDomain}: ${count}`);
    }
  }
  console.log('------------------------');

  await pool.end();
}

// If invoked directly from CLI:  `node utils/jobCrawler.js`
if (require.main === module) {
  runJobCrawler()
    .then(() => {
      console.log('Job crawl finished');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
