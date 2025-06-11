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
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';

import { 
  pool, 
  // sha256, // Not directly used in jobCrawler.js after refactor, processJobPosting uses its own import
  fetchHTML, 
  // addJobPostingVersion, // Not directly used in jobCrawler.js, processJobPosting uses its own import
  processJobPosting,
  CRAWLER_CONCURRENCY, 
  // CRAWLER_REQUEST_TIMEOUT, // Not directly used by jobCrawler.js, fetchHTML uses it
  // USER_AGENT_STRING, // Not directly used by jobCrawler.js, fetchHTML uses it
  RATE_LIMIT_ERROR_MARKER 
} from './crawlerUtils.js';

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

// Constants moved to crawlerUtils.js or locally scoped if specific
// const CONCURRENCY = 4; // Now CRAWLER_CONCURRENCY from crawlerUtils
// const REQUEST_TIMEOUT = 8000; // Now CRAWLER_REQUEST_TIMEOUT from crawlerUtils
const MINIMUM_JOB_LINKS_PER_PAGE = 3; 
const MAX_CONSECUTIVE_LISTING_ERRORS = 3; 
// const RATE_LIMIT_ERROR_MARKER = Symbol('RATE_LIMIT_ERROR'); // Now from crawlerUtils

// const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL }); // Now from crawlerUtils

async function getActiveHosts() {
  const { rows } = await pool.query( // Uses imported pool
    `SELECT id, domain, ats_type
       FROM ats_hosts
      WHERE is_active = true`
  );
  return rows;
}

// sha256 moved to crawlerUtils.js

function looksLikeJobLink(href) {
  // Super-simple heuristics; refine later per-ATS
  return /\/job(s)?\/|\/jobs\/\d|\/positions?\/|jobid=/i.test(href);
}

// fetchHTML moved to crawlerUtils.js
// processJobPosting moved to crawlerUtils.js
// addJobPostingVersion moved to crawlerUtils.js


// Updated signature to include atsConfig and hostErrorStreaks
async function crawlHost(host, httpErrorsByHost, atsConfig, hostErrorStreaks) {
  const { id: hostId, domain, ats_type } = host;
  const limit = pLimit(CRAWLER_CONCURRENCY); // Use imported CRAWLER_CONCURRENCY
  let localListingPagesHit = 0;
  let localJobUrlsStored = 0;

  for (const path of COMMON_PATHS) {
    const listingURL = `https://${domain}${path}`;
    const fetchResult = await fetchHTML(listingURL, domain, httpErrorsByHost); // Use imported fetchHTML

    let htmlContent = null;

    if (fetchResult.body && fetchResult.status >= 200 && fetchResult.status < 300) {
      htmlContent = fetchResult.body;
      hostErrorStreaks[domain] = 0; // Reset streak on success
      localListingPagesHit++;
    } else if (fetchResult.marker === RATE_LIMIT_ERROR_MARKER || (fetchResult.errorStatus && (fetchResult.errorStatus === 429 || fetchResult.errorStatus === 403))) {
      hostErrorStreaks[domain] = (hostErrorStreaks[domain] || 0) + 1;
      console.warn(`Host ${domain} encountered error streak: ${hostErrorStreaks[domain]}/${MAX_CONSECUTIVE_LISTING_ERRORS} on path ${path} (Status: ${fetchResult.errorStatus || 'Marker'})`);
      if (hostErrorStreaks[domain] >= MAX_CONSECUTIVE_LISTING_ERRORS) {
        console.error(`Host ${domain} reached max consecutive errors (${MAX_CONSECUTIVE_LISTING_ERRORS}). Skipping this host for the current run.`);
        return { localListingPagesHit, localJobUrlsStored }; // Return early
      }
      continue; // Skip this path, try next path
    } else { // Other errors (network, non-2xx/429/403 status codes)
      // fetchHTML already logs these if httpErrorsByHost is passed and domain is present.
      // console.warn(`Failed to fetch ${listingURL}. Status: ${fetchResult.errorStatus}, Message: ${fetchResult.message}`);
      continue; // if html is null or other error, skip to next path
    }
    
    // If we reach here, htmlContent is valid
    const $ = cheerio.load(htmlContent);
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
        const jobDetailFetchResult = await fetchHTML(jobURL, jobDomain, httpErrorsByHost); // Use imported fetchHTML

        if (!(jobDetailFetchResult.body && jobDetailFetchResult.status >= 200 && jobDetailFetchResult.status < 300)) {
          // console.warn(`Skipping job URL ${jobURL} due to fetch error. Status: ${jobDetailFetchResult.errorStatus}, Message: ${jobDetailFetchResult.message}`);
          // Note: Unlike listing pages, we don't apply error streak logic for individual job pages here.
          // These errors are already counted in httpErrorsByHost by fetchHTML.
          return; // Skip this job URL
        }
        const jobHTMLString = jobDetailFetchResult.body; // HTML content for this job

        const $$ = cheerio.load(jobHTMLString);
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
          // Use jobHTMLString for regex match
          const locMatchFallback = jobHTMLString.match(/[A-Z][a-zA-Z]+,\s?(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)/);
          if (locMatchFallback) {
            location = locMatchFallback[0];
          }
        }
        
        // Ensure title and location are null if empty after all attempts
        title = title || null;
        location = location || null;

        try {
          // Pass jobHTMLString to processJobPosting
          const processingSuccessful = await processJobPosting({ 
            hostId: hostId,     // From const { id: hostId, ... } = host;
            url: jobURL, 
            html: jobHTMLString, 
            title: title,       // The extracted title
            location: location, // The extracted location
            atsType: ats_type,  // From const { ..., ats_type } = host;
            jobFamily: null     // Pass null for jobFamily for direct crawls
          });
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
if (import.meta.url === `file://${process.argv[1]}`) {
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
