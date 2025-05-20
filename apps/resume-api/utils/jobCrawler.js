/**
 * Basic Job Page Crawler
 *  – Reads active ATS host domains
 *  – Visits a handful of common “listing” paths
 *  – Collects <a> URLs that look like individual job pages
 *  – Inserts or updates each row in job_postings with a SHA-256 of the page HTML
 *
 * NO deep parsing of title/location yet – that’s Phase 2.
 */

import pg from 'pg';
import got from 'got';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import pLimit from 'p-limit';

// --- BEGIN INSTRUMENTATION ---
// Initialized in runJobCrawler
// let hostsVisited = 0;
// let listingPagesHit = 0;
// let jobUrlsStored = 0;
// let httpErrorsByHost = {}; // Object to store error counts per host domain
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

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function getActiveHosts() {
  const { rows } = await pool.query(
    `SELECT id, domain
       FROM ats_hosts
      WHERE is_active = true`
  );
  return rows;                    // [{ id, domain }]
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
  } catch (err) {
    if (domain) { // Ensure domain is passed
      httpErrorsByHost[domain] = (httpErrorsByHost[domain] || 0) + 1;
    }
    console.error(`Error fetching ${url} for domain ${domain}: ${err.message}`);
    return null;
  }
}

async function upsertPosting({ hostId, url, html, title, location }) { // No change to signature for counters based on revised plan
  // Normalize URL
  const originalUrl = url; // Keep original for conflict target
  let normalizedUrlObj = new URL(originalUrl);
  let paramsToDelete = [];
  for (const [key, value] of normalizedUrlObj.searchParams) {
    if (key.toLowerCase() !== 'gh_jid' && key.toLowerCase() !== 'jobid') {
      paramsToDelete.push(key);
    }
  }
  paramsToDelete.forEach(key => normalizedUrlObj.searchParams.delete(key));
  // Reconstruct, ensuring pathname starts with a slash if not empty, and all lowercase
  let reconstructedPath = normalizedUrlObj.pathname;
  if (reconstructedPath && !reconstructedPath.startsWith('/')) {
    reconstructedPath = '/' + reconstructedPath;
  } else if (!reconstructedPath && originalUrl.includes('?')) { // Handle cases like "domain.com?query" vs "domain.com/"
      reconstructedPath = '/';
  } else if (!reconstructedPath) {
    reconstructedPath = '/';
  }
  const normalizedUrl = (reconstructedPath + normalizedUrlObj.search).toLowerCase();

  const urlHash = sha256(normalizedUrl); // Hash of the normalized URL
  const htmlHash = sha256(html);         // Hash of the page content

  await pool.query(
    `INSERT INTO job_postings
         (ats_host_id, url, html_hash, job_title, location, url_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (url) DO
       UPDATE SET html_hash = EXCLUDED.html_hash,
                  job_title = EXCLUDED.job_title,      -- Also update title/location if they changed
                  location = EXCLUDED.location,    -- for the same raw URL
                  url_hash = EXCLUDED.url_hash,        -- Ensure url_hash is updated
                  last_seen_at = NOW()`,
    [hostId, originalUrl, htmlHash, title, location, urlHash] // Use originalUrl for the VALUES and conflict target
  );
}

async function crawlHost({ id: hostId, domain }, httpErrorsByHost) { // Added httpErrorsByHost
  const limit = pLimit(CONCURRENCY);
  let localListingPagesHit = 0;
  let localJobUrlsStored = 0;

  for (const path of COMMON_PATHS) {
    const listingURL = `https://${domain}${path}`;
    const html = await fetchHTML(listingURL, domain, httpErrorsByHost); // Pass domain, httpErrorsByHost
    if (!html) continue;
    localListingPagesHit++; // Increment for successful listing page fetch

    const $ = cheerio.load(html);
    const links = new Set();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      if (!looksLikeJobLink(href)) return;

      try {
        // Resolve relative URLs
        const absolute = new URL(href, listingURL).href;
        links.add(absolute);
      } catch (_) {
        /* bad URL – skip */
      }
    });

    // Crawl each candidate job page (shallow) in parallel
    const tasks = Array.from(links).map((jobURL) =>
      limit(async () => {
        const jobDomain = new URL(jobURL).hostname; // Get domain from jobURL
        const jobHTML = await fetchHTML(jobURL, jobDomain, httpErrorsByHost); // Pass jobDomain, httpErrorsByHost
        if (!jobHTML) return;

        // VERY rough title/location extraction (h1 + text containing a state abbrev)
        const $$ = cheerio.load(jobHTML);
        const title = ($$('h1').first().text() || '').trim().slice(0, 140) || null;
        const locMatch =
          jobHTML.match(/[A-Z][a-zA-Z]+,\s?(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)/);
        const location = locMatch ? locMatch[0] : null;

        try {
          await upsertPosting({ hostId, url: jobURL, html: jobHTML, title, location });
          localJobUrlsStored++; // Incremented on successful upsert attempt
        } catch (upsertError) {
          console.error(`Error upserting ${jobURL} (domain: ${jobDomain}): ${upsertError.message}`);
          if (jobDomain) {
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

  const hosts = await getActiveHosts();
  for (const host of hosts) {
    hostsVisited++; // Increment for each host processed
    console.log(`Crawling host ${host.domain} (${hostsVisited}/${hosts.length})...`);
    try {
      const { localListingPagesHit, localJobUrlsStored } = await crawlHost(host, httpErrorsByHost);
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
