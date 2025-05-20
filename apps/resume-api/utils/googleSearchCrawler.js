import pg from 'pg'; // Keep pg for now, might be used by processJobPosting or other utils
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit'; // Added p-limit

// Import the new searchGoogle function
import { searchGoogle } from './googleClient.js';

// Imports from the new shared utilities file
import {
  pool, 
  sha256, // Added sha256
  fetchHTML,
  processJobPosting,
  CRAWLER_CONCURRENCY, // Added CRAWLER_CONCURRENCY
  // CRAWLER_REQUEST_TIMEOUT, // fetchHTML uses its own default from crawlerUtils
  // USER_AGENT_STRING, // fetchHTML uses its own default from crawlerUtils
  // RATE_LIMIT_ERROR_MARKER // fetchHTML uses its own default from crawlerUtils
} from './crawlerUtils.js';


const DEFAULT_BATCH_SIZE_PER_ATS = 40; // As per user feedback

// Load atsConfigs.json
let atsConfigs = {};
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const configPath = path.join(__dirname, 'atsConfigs.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`atsConfigs.json not found at ${configPath}. Make sure the file exists.`);
  }
  const configFile = fs.readFileSync(configPath, 'utf8');
  atsConfigs = JSON.parse(configFile);
  console.log('googleSearchCrawler: Successfully loaded atsConfigs.json.');
} catch (error) {
  console.error('googleSearchCrawler: Critical error loading atsConfigs.json:', error.message);
  process.exit(1); // Exit if critical configs are missing
}

// Place near other utility functions or before runGoogleSearchCrawler
function normalizeWorkableUrl(url) {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'jobs.workable.com' && urlObj.pathname.startsWith('/view/')) {
      const parts = urlObj.pathname.split('/');
      const jobId = parts[parts.length - 1];
      if (jobId) {
        // User wants to normalize to apply.workable.com form.
        // Since we don't have the company slug from the /view/ URL,
        // we use a placeholder. This helps in potential de-duplication logic later
        // by having a somewhat consistent structure.
        return `https://apply.workable.com/UNKNOWN_COMPANY_FROM_VIEW_URL/j/${jobId}`;
      }
    } else if (urlObj.hostname === 'apply.workable.com' && urlObj.pathname.includes('/j/')) {
      // Already in the desired canonical form (or close enough for our purposes)
      return url; // Return as is
    }
  } catch (e) {
    // console.warn(`normalizeWorkableUrl: Error parsing URL ${url}: ${e.message}`);
    return url; // Return original on error
  }
  return url; // Return original if no normalization rule applied
}

/**
 * Main function for the Google Search Crawler.
 * @param {object} params
 * @param {string[]} params.atsTargets - Array of ATS names to target (e.g., ["Greenhouse", "Ashby"]).
 * @param {string} params.countryFilter - Country to search in (e.g., "United States").
 * @param {number} params.hoursBack - How many hours of history to search.
 * @param {number} [params.batchSizePerATS=DEFAULT_BATCH_SIZE_PER_ATS] - Max results to process per ATS.
 */
async function runGoogleSearchCrawler({ 
  atsTargets, 
  countryFilter, 
  hoursBack, 
  batchSizePerATS = DEFAULT_BATCH_SIZE_PER_ATS 
}) {
  console.log(`Starting Google Search Crawler for ATS: ${atsTargets.join(', ')}...`);
  console.log(`Country: ${countryFilter}, Hours Back: ${hoursBack}, Batch Size per ATS: ${batchSizePerATS}`);

  if (!atsTargets || atsTargets.length === 0) {
    console.error("googleSearchCrawler: No ATS targets specified. Exiting.");
    return;
  }
  if (!countryFilter) {
    console.error("googleSearchCrawler: Country filter not specified. Exiting.");
    return;
  }
   if (typeof hoursBack === 'undefined') {
    console.error("googleSearchCrawler: hoursBack not specified. Exiting.");
    return;
  }

  for (const atsName of atsTargets) {
    const config = atsConfigs[atsName];
    if (!config) {
      console.warn(`googleSearchCrawler: No configuration found for ATS: ${atsName} in atsConfigs.json. Skipping.`);
      continue;
    }

    const searchDomain = config.googleSearchDomain;
    if (!searchDomain) {
      console.warn(`googleSearchCrawler: 'googleSearchDomain' not defined for ATS: ${atsName}. Skipping.`);
      continue;
    }

    const keywords = config.searchKeywords;
    if (!keywords || keywords.length === 0) {
      console.warn(`googleSearchCrawler: 'searchKeywords' not defined or empty for ATS: ${atsName}. Skipping.`);
      continue;
    }
    // Format keywords for Google query: "keyword one" OR "keyword two"
    const keywordsString = `"${keywords.join('" OR "')}"`;
    const countryFilterString = `"${countryFilter}"`; // Enclose country in quotes

    const rawQueryParts = { 
      site: searchDomain, 
      keywordsString: keywordsString, 
      countryFilterString: countryFilterString 
    };

    console.log(`googleSearchCrawler: Preparing to search for ${atsName} on domain ${searchDomain} with keywords [${keywords.join(', ')}]`);

    try {
      const results = await searchGoogle(rawQueryParts, { 
        hoursBack, 
        // apiKey and cx will be picked up from process.env by searchGoogle
        maxResults: batchSizePerATS 
      });

      console.log(`googleSearchCrawler: Mock search for ${atsName} returned ${results.length} results.`);
      
      const validJobUrls = [];
      const jobDetailUrlRegexString = config.jobDetailUrlRegex;

      if (!jobDetailUrlRegexString) {
        console.warn(`googleSearchCrawler: 'jobDetailUrlRegex' not defined for ATS: ${atsName}. Cannot validate URLs. Skipping further processing for this ATS.`);
        // continue; // This would skip to the next atsName. If we want to process other ATSs, this is correct.
      } else {
        let regex;
        try {
          regex = new RegExp(jobDetailUrlRegexString);
        } catch (e) {
          console.error(`googleSearchCrawler: Invalid jobDetailUrlRegex for ${atsName}: "${jobDetailUrlRegexString}". Error: ${e.message}. Skipping further processing for this ATS.`);
          // continue; // Skip to next atsName
        }

        if (regex && results && results.length > 0) {
          results.forEach(result => {
            // Ensure result and result.link are valid before testing
            if (result && typeof result.link === 'string' && regex.test(result.link)) {
              let jobUrl = result.link;
              if (atsName === 'Workable') {
                const normalized = normalizeWorkableUrl(jobUrl);
                if (normalized !== jobUrl) {
                  // console.log(`googleSearchCrawler: Workable URL normalized: ${jobUrl} -> ${normalized}`); // Optional debug log
                  jobUrl = normalized;
                }
              }
              validJobUrls.push(jobUrl);
            } else if (result && typeof result.link === 'string') {
              // console.log(`googleSearchCrawler: URL did not validate for ${atsName}: ${result.link} against regex ${jobDetailUrlRegexString}`); // Optional: for debugging non-matches
            } else {
              // console.log(`googleSearchCrawler: Invalid search result item for ${atsName}: ${JSON.stringify(result)}`); // Optional: for debugging bad items
            }
          });
        }
      } // End of else block for jobDetailUrlRegexString check

      console.log(`googleSearchCrawler: Found ${validJobUrls.length} valid job URLs for ${atsName} (from ${results ? results.length : 0} search results).`);

      if (validJobUrls.length > 0) {
        console.log(`googleSearchCrawler: Processing ${validJobUrls.length} valid URLs for ${atsName}...`);
        const limit = pLimit(CRAWLER_CONCURRENCY); // Use imported CRAWLER_CONCURRENCY
        
        const tasks = validJobUrls.map(jobUrl => {
          return limit(async () => {
            try {
              // De-duplication before fetch:
              const urlForHashObj = new URL(jobUrl);
              const pathnameForHash = urlForHashObj.pathname && urlForHashObj.pathname.startsWith('/') ? urlForHashObj.pathname : (urlForHashObj.pathname ? `/${urlForHashObj.pathname}` : '/');
              const normalizedForHash = (pathnameForHash + urlForHashObj.search).toLowerCase();
              const urlHash = sha256(normalizedForHash); // Use shared sha256

              const duplicateCheck = await pool.query(
                'SELECT id FROM job_postings WHERE url_hash = $1 OR url = $2',
                [urlHash, jobUrl]
              );

              if (duplicateCheck.rowCount > 0) {
                // console.log(`googleSearchCrawler: URL ${jobUrl} (hash: ${urlHash.substring(0,7)}) already exists or has same hash. Skipping fetch.`);
                return; // Skip this URL
              }

              // Fetch HTML:
              const jobUrlDomain = new URL(jobUrl).hostname;
              const fetchResult = await fetchHTML(jobUrl, jobUrlDomain, {}); // Pass empty obj for httpErrorsByHost

              if (fetchResult.errorStatus === 404 || fetchResult.errorStatus === 410) {
                const updateRes = await pool.query(
                  `UPDATE job_postings SET status = 'closed', last_seen_at = NOW() 
                   WHERE (url = $1 OR url_hash = $2) AND status != 'closed'`,
                  [jobUrl, urlHash]
                );
                if (updateRes.rowCount > 0) {
                  // console.log(`googleSearchCrawler: Marked existing job ${jobUrl} as closed due to ${fetchResult.errorStatus}.`);
                } else {
                  // console.log(`googleSearchCrawler: URL ${jobUrl} returned ${fetchResult.errorStatus}, not found in DB or already closed.`);
                }
              } else if (fetchResult.body && fetchResult.status === 200) {
                // Process successful fetch:
                await processJobPosting({ 
                  hostId: null, // No hostId for Google-sourced jobs
                  url: jobUrl, 
                  html: fetchResult.body, 
                  title: null, // Let processJobPosting extract
                  location: null, // Let processJobPosting extract
                  atsType: config.atsType 
                });
              } else if (fetchResult.errorStatus || fetchResult.error) {
                console.warn(`googleSearchCrawler: Failed to fetch ${jobUrl}. Status: ${fetchResult.errorStatus || 'N/A'}. Message: ${fetchResult.message || 'Unknown fetch error'}`);
              }

            } catch (e) {
              console.error(`googleSearchCrawler: Unexpected error processing URL ${jobUrl} for ${atsName}: ${e.message}`, e.stack);
            }
          });
        }); // End of validJobUrls.map

        await Promise.allSettled(tasks);
        console.log(`googleSearchCrawler: Finished processing URLs for ${atsName}.`);
      } // End of if (validJobUrls.length > 0)
    } catch (error) {
      console.error(`googleSearchCrawler: Error during searchGoogle execution for ${atsName}: ${error.message}`, error.stack);
      // Continue to the next ATS target
    }
  } // end of for loop over atsTargets

  console.log('Google Search Crawler finished processing all ATS targets.');
  // Any final cleanup, like closing a DB pool if it were opened directly in this script.
  // const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL }); // Not used directly here yet
  // await pool.end(); 
}

// CLI Execution Block (can be adapted from the previous version of this file)
if (require.main === module) {
  const args = process.argv.slice(2);
  const atsArg = args.find(arg => arg.startsWith('--ats='));
  const keywordsArg = args.find(arg => arg.startsWith('--keywords=')); // Note: keywords will come from atsConfigs now
  const countryArg = args.find(arg => arg.startsWith('--country='));
  const hoursArg = args.find(arg => arg.startsWith('--hours='));
  const batchSizeArg = args.find(arg => arg.startsWith('--batchSize='));

  const atsTargets = atsArg ? atsArg.split('=')[1].split(',') : ['Greenhouse', 'Lever', 'Ashby', 'Workable'];
  // Keywords are now per-ATS in atsConfigs.json, so top-level keywords arg is less relevant.
  // The crawler will use keywords from the config for each ATS it targets.
  const countryFilter = countryArg ? countryArg.split('=')[1] : "United States";
  const hoursBack = hoursArg ? parseInt(hoursArg.split('=')[1], 10) : 24;
  const batchSizePerATS = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : DEFAULT_BATCH_SIZE_PER_ATS;
  
  if (isNaN(hoursBack)) {
    console.error("Invalid --hours value. Must be a number.");
    process.exit(1);
  }
   if (isNaN(batchSizePerATS)) {
    console.error("Invalid --batchSize value. Must be a number.");
    process.exit(1);
  }

  runGoogleSearchCrawler({ atsTargets, countryFilter, hoursBack, batchSizePerATS })
    .then(() => console.log("Google Search Crawler script run initiated."))
    .catch(error => {
      console.error("Error in Google Search Crawler script:", error);
      process.exit(1);
    });
}

// Export functions if they need to be used by other modules or for testing
export { runGoogleSearchCrawler }; // Potentially buildGoogleQuery if it's made a separate utility
