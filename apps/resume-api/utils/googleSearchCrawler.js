import pg from 'pg'; // Keep pg for now, might be used by processJobPosting or other utils
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';

// Import the new searchGoogle function
import { searchGoogle } from './googleClient.js';
import jobKeywordsConfig from '../config/keywords.js'; // New import

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
  batchSizePerATS = DEFAULT_BATCH_SIZE_PER_ATS,
  targetJobFamilies = [] // New parameter for targeted job families
}) {
  console.log(`Starting Google Search Crawler for ATS: ${atsTargets.join(', ')}...`);
  console.log(`Country: ${countryFilter}, Hours Back: ${hoursBack}, Batch Size per ATS: ${batchSizePerATS}, Target Families: ${targetJobFamilies.length > 0 ? targetJobFamilies.join(', ') : 'All'}`);

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

  const familiesToProcess = targetJobFamilies.length > 0 
    ? targetJobFamilies 
    : Object.keys(jobKeywordsConfig);

  for (const atsName of atsTargets) {
    const atsSpecificConfig = atsConfigs[atsName]; // Loaded globally in the file
    if (!atsSpecificConfig) {
      console.warn(`googleSearchCrawler: No configuration found for ATS: ${atsName} in atsConfigs.json. Skipping.`);
      continue;
    }
    const searchDomain = atsSpecificConfig.googleSearchDomain;
    if (!searchDomain) {
      console.warn(`googleSearchCrawler: 'googleSearchDomain' not defined for ATS: ${atsName}. Skipping.`);
      continue;
    }

    console.log(`googleSearchCrawler: Processing ATS: ${atsName} for domain: ${searchDomain}`);

    for (const familyName of familiesToProcess) {
      const familyDetails = jobKeywordsConfig[familyName];
      if (!familyDetails || !familyDetails.aliases || familyDetails.aliases.length === 0) {
        console.warn(`googleSearchCrawler: No aliases found for job family "${familyName}". Skipping this family for ${atsName}.`);
        continue;
      }

      const keywordsForQuery = familyDetails.aliases;
      // Format keywords for Google query: "keyword one" OR "keyword two"
      const keywordsString = `"${keywordsForQuery.join('" OR "')}"`;
      const countryFilterString = `"${countryFilter}"`;

      const rawQueryParts = { 
        site: searchDomain, 
        keywordsString: keywordsString, 
        countryFilterString: countryFilterString 
      };

      console.log(`googleSearchCrawler: Searching for job family "${familyName}" (Keywords: ${keywordsForQuery.join(', ')}) on ${atsName}.`);

      try {
        const results = await searchGoogle(rawQueryParts, { 
          hoursBack, 
          maxResults: batchSizePerATS 
        });
        
        // console.log(`googleSearchCrawler: Mock search for ${atsName} / ${familyName} returned ${results.length} results.`);
        
        const validJobUrls = [];
        const jobDetailUrlRegexString = atsSpecificConfig.jobDetailUrlRegex;

        if (!jobDetailUrlRegexString) {
          console.warn(`googleSearchCrawler: 'jobDetailUrlRegex' not defined for ATS: ${atsName} for family ${familyName}. Cannot validate URLs. Skipping.`);
        } else {
            let regex; 
            try { 
              regex = new RegExp(jobDetailUrlRegexString); 
            } catch (e) { 
              console.error(`googleSearchCrawler: Invalid jobDetailUrlRegex for ${atsName} ("${jobDetailUrlRegexString}"): ${e.message}. Skipping family ${familyName}.`);
            }
            if (regex && results && results.length > 0) {
                results.forEach(result => {
                    if (result && typeof result.link === 'string' && regex.test(result.link)) {
                        let jobUrl = result.link;
                        if (atsName === 'Workable') { // Workable normalization
                            jobUrl = normalizeWorkableUrl(jobUrl); 
                        }
                        validJobUrls.push(jobUrl);
                    }
                });
            }
        }
        console.log(`googleSearchCrawler: Found ${validJobUrls.length} valid job URLs for ${atsName} / ${familyName}.`);

        if (validJobUrls.length > 0) {
          console.log(`googleSearchCrawler: Processing ${validJobUrls.length} valid URLs for ${atsName} / ${familyName}...`);
          const limit = pLimit(CRAWLER_CONCURRENCY); 
          
          const tasks = validJobUrls.map(jobUrl => {
            return limit(async () => {
              try {
                const urlForHashObj = new URL(jobUrl);
                const pathnameForHash = urlForHashObj.pathname && urlForHashObj.pathname.startsWith('/') ? urlForHashObj.pathname : (urlForHashObj.pathname ? `/${urlForHashObj.pathname}` : '/');
                const normalizedForHash = (pathnameForHash + urlForHashObj.search).toLowerCase();
                const urlHash = sha256(normalizedForHash);

                const duplicateCheck = await pool.query(
                  'SELECT id FROM job_postings WHERE url_hash = $1 OR url = $2',
                  [urlHash, jobUrl]
                );

                if (duplicateCheck.rowCount > 0) { return; }

                const jobUrlDomain = new URL(jobUrl).hostname;
                const fetchResult = await fetchHTML(jobUrl, jobUrlDomain, {});

                if (fetchResult.errorStatus === 404 || fetchResult.errorStatus === 410) {
                  await pool.query(
                    `UPDATE job_postings SET status = 'closed', last_seen_at = NOW() 
                     WHERE (url = $1 OR url_hash = $2) AND status != 'closed'`,
                    [jobUrl, urlHash]
                  );
                } else if (fetchResult.body && fetchResult.status === 200) {
                  await processJobPosting({ 
                    hostId: null, 
                    url: jobUrl, 
                    html: fetchResult.body, 
                    title: null, // Or title from search result if available and relevant
                    location: null, 
                    atsType: atsSpecificConfig.atsType,
                    jobFamily: familyName // Pass the current familyName
                  });
                } else if (fetchResult.errorStatus || fetchResult.error) {
                  console.warn(`googleSearchCrawler: Failed to fetch ${jobUrl}. Status: ${fetchResult.errorStatus || 'N/A'}. Message: ${fetchResult.message || 'Unknown fetch error'}`);
                }
              } catch (e) {
                console.error(`googleSearchCrawler: Unexpected error processing URL ${jobUrl} for ${atsName} / ${familyName}: ${e.message}`, e.stack);
              }
            });
          });
          await Promise.allSettled(tasks);
          console.log(`googleSearchCrawler: Finished processing URLs for ${atsName} / ${familyName}.`);
        }
      } catch (error) {
        console.error(`googleSearchCrawler: Error during searchGoogle execution for ${atsName} / ${familyName}: ${error.message}`, error.stack);
      }
    } // End of job family loop
  } // End of ATS target loop

  console.log('Google Search Crawler finished processing all ATS targets.');
  // Any final cleanup, like closing a DB pool if it were opened directly in this script.
  // const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL }); // Not used directly here yet
  // await pool.end(); 
}

// CLI Execution Block (can be adapted from the previous version of this file)
if (require.main === module) {
  const args = process.argv.slice(2);
  const atsArg = args.find(arg => arg.startsWith('--ats='));
  // const keywordsArg = args.find(arg => arg.startsWith('--keywords=')); // Deprecated
  const familiesArg = args.find(arg => arg.startsWith('--families=')); // New
  const countryArg = args.find(arg => arg.startsWith('--country='));
  const hoursArg = args.find(arg => arg.startsWith('--hours='));
  const batchSizeArg = args.find(arg => arg.startsWith('--batchSize='));

  const atsTargets = atsArg ? atsArg.split('=')[1].split(',') : ['Greenhouse', 'Lever', 'Ashby', 'Workable'];
  const targetJobFamilies = familiesArg ? familiesArg.split('=')[1].split(',') : []; // Empty means all
  const countryFilter = countryArg ? countryArg.split('=')[1] : "United States";
  const hoursBack = hoursArg ? parseInt(hoursArg.split('=')[1], 10) : 24;
  const batchSizePerATS = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : DEFAULT_BATCH_SIZE_PER_ATS;
  
  if (isNaN(hoursBack)) {
    console.error("googleSearchCrawler: Invalid --hours value. Must be a number.");
    process.exit(1);
  }
  if (isNaN(batchSizePerATS)) {
    console.error("googleSearchCrawler: Invalid --batchSize value. Must be a number.");
    process.exit(1);
  }

  runGoogleSearchCrawler({ atsTargets, countryFilter, hoursBack, batchSizePerATS, targetJobFamilies })
    .then(() => console.log("Google Search Crawler script run initiated."))
    .catch(error => {
      console.error("Error in Google Search Crawler script:", error);
      process.exit(1);
    });
}

// Export functions if they need to be used by other modules or for testing
export { runGoogleSearchCrawler };
