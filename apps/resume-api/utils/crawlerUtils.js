import pg from 'pg';
import got from 'got';
import crypto from 'crypto';
import * as cheerio from 'cheerio'; // Added cheerio
import fs from 'fs'; // Added fs
import path from 'path'; // Added path
import { fileURLToPath } from 'url'; // Added fileURLToPath for __dirname
import jobKeywordsConfig from '../config/keywords.js'; // Import jobKeywordsConfig

// Load atsConfigs.json
let atsConfigs = {};
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const configPath = path.join(__dirname, 'atsConfigs.json');
  if (fs.existsSync(configPath)) {
    const configFile = fs.readFileSync(configPath, 'utf8');
    atsConfigs = JSON.parse(configFile);
    console.log('crawlerUtils.js: Successfully loaded atsConfigs.json.');
  } else {
    console.warn('crawlerUtils.js: atsConfigs.json not found. Some ATS-specific logic might not work.');
  }
} catch (error) {
  console.error('crawlerUtils.js: Error loading atsConfigs.json:', error.message);
  // Depending on how critical this is, might exit or continue with atsConfigs = {}
}

export const CRAWLER_CONCURRENCY = process.env.CRAWLER_CONCURRENCY ? parseInt(process.env.CRAWLER_CONCURRENCY, 10) : 4;
export const CRAWLER_REQUEST_TIMEOUT = process.env.CRAWLER_REQUEST_TIMEOUT ? parseInt(process.env.CRAWLER_REQUEST_TIMEOUT, 10) : 8000; // ms
export const USER_AGENT_STRING = 'ApplyPilotBot/0.1 (+https://apply-pilot.ai/bot)';
export const RATE_LIMIT_ERROR_MARKER = Symbol('RATE_LIMIT_ERROR');

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Detects job family based on job title and keywords configuration
 * @param {string} title - The job title to analyze
 * @param {object} jobKeywordsConfig - Configuration object with job families and their aliases
 * @returns {string} - The detected job family or 'Unknown'
 */
export function detectFamily(title, jobKeywordsConfig) {
  if (!title || typeof title !== 'string') {
    return 'Unknown';
  }

  const normalizedTitle = title.toLowerCase().trim();
  
  // Iterate through each job family and check if title matches any aliases
  for (const [familyName, familyConfig] of Object.entries(jobKeywordsConfig)) {
    if (familyConfig.aliases && Array.isArray(familyConfig.aliases)) {
      for (const alias of familyConfig.aliases) {
        const normalizedAlias = alias.toLowerCase();
        if (normalizedTitle.includes(normalizedAlias)) {
          return familyName;
        }
      }
    }
  }
  
  return 'Unknown';
}

/**
 * Fetches HTML content from a given URL.
 * Returns an object: { body: string, status: number } on success,
 * or { errorStatus: number, message: string } on HTTP error,
 * or { error: true, message: string } on other errors.
 */
export async function fetchHTML(url, domain, httpErrorsByHost = {}) { // httpErrorsByHost is optional here
  const options = {
    timeout: { request: CRAWLER_REQUEST_TIMEOUT },
    headers: { 'User-Agent': USER_AGENT_STRING },
    retry: { limit: 0 },
    followRedirect: true,
    maxRedirects: 5,
    throwHttpErrors: false // Process HTTP errors manually
  };

  try {
    const response = await got(url, options);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return { body: response.body, status: response.statusCode };
    } else {
      if (domain && httpErrorsByHost && response.statusCode) { // Log error for original crawler's stats
        httpErrorsByHost[domain] = (httpErrorsByHost[domain] || 0) + 1;
      }
      // Specific check for 429/403 for original crawler compatibility, can be removed if jobCrawler is fully adapted
      if (response.statusCode === 429 || response.statusCode === 403) {
           return { errorStatus: response.statusCode, message: response.statusMessage, marker: RATE_LIMIT_ERROR_MARKER };
      }
      return { errorStatus: response.statusCode, message: response.statusMessage };
    }
  } catch (error) {
    // console.error(`fetchHTML: Error fetching ${url} (Domain: ${domain}): ${error.message}`);
    if (domain && httpErrorsByHost) { // Log error for original crawler's stats
       httpErrorsByHost[domain] = (httpErrorsByHost[domain] || 0) + 1;
    }
    return { error: true, message: error.message };
  }
}

export async function addJobPostingVersion(jobPostingId, htmlHash, title, location) {
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
   } catch (error) {
       console.error(`Error adding job posting version for job_posting_id ${jobPostingId}: ${error.message}`);
   }
}

export async function isDuplicate({ company, jobId, title, location /*, pool - pool is already in module scope */ }) {
  if (!company) { // Company is a critical field for de-duplication
    // console.warn('isDuplicate: Company is missing, cannot perform advanced de-duplication.');
    return false; // Or throw an error, or handle as per desired strictness
                  // Returning false means it's NOT a duplicate by this check, allowing processing to continue.
                  // This might be desired if company extraction fails but other de-dupe (URL hash) passed.
  }

  // Step B.1 (robust): Composite key match (company + job_id)
  if (jobId) { // Only perform this check if jobId is available and not null/empty
    try {
      const { rowCount } = await pool.query(
        `SELECT 1
         FROM job_postings
         WHERE company = $1
           AND job_id = $2
           AND job_id IS NOT NULL`, // job_id IS NOT NULL is redundant if $2 is not null, but good for clarity
        [company, jobId]
      );
      if (rowCount > 0) {
        // console.log(`isDuplicate: Found duplicate by company+jobId: ${company}, ${jobId}`);
        return true;
      }
    } catch (e) {
      console.error(`isDuplicate: Error querying by company+jobId for ${company}, ${jobId}: ${e.message}`);
      // Fall through to next check or return false depending on error handling strategy
    }
  }

  // Step B.2 (robust): Fallback if job_id is NULL or if the first check found nothing
  // (company + title + location) within 45 days
  // This check requires title. If title is missing, this specific check cannot run effectively.
  if (!title) {
      // console.warn('isDuplicate: Title is missing, cannot perform title/location based de-duplication.');
      return false; 
  }
  
  try {
    const { rowCount } = await pool.query(
      `SELECT 1
       FROM job_postings
       WHERE company = $1
         AND job_title = $2
         AND COALESCE(location, '') = COALESCE($3, '')
         AND discovered_at >= NOW() - INTERVAL '45 days'`,
      [company, title, location] // location can be null, COALESCE handles this
    );
    if (rowCount > 0) {
      // console.log(`isDuplicate: Found duplicate by company+title+location (45d): ${company}, ${title}, ${location}`);
      return true;
    }
  } catch (e) {
    console.error(`isDuplicate: Error querying by company+title+location for ${company}, ${title}: ${e.message}`);
  }

  return false; // No duplicate found by these criteria
}

export async function processJobPosting({ hostId, url: originalUrl, html, title: initialTitle, location: initialLocation, atsType, jobFamily: jobFamilyFromCaller }) {
    if (!html) { 
        // console.warn(`crawlerUtils.js: processJobPosting: HTML content is missing for URL ${originalUrl}. Skipping.`);
        return false; 
    }

    const $$ = cheerio.load(html); // Load HTML into Cheerio

    let jobId = null;
    let companyName = null;
    let postingDate = null;
    let finalCanonicalUrl = originalUrl;
    let extractedTitle = initialTitle;
    let extractedLocation = initialLocation;

    // A. Canonical URL Extraction
    try {
        const urlObj = new URL(originalUrl);
        urlObj.hostname = urlObj.hostname.toLowerCase();
        urlObj.pathname = urlObj.pathname.toLowerCase();
        const keepParams = new URLSearchParams();
        // Essential ID params - add more as identified
        const idKeyParams = ['gh_jid', 'jobid', 'id', 'p', 'job', 'jk', 'reqid', 'jobreqid', 'jobidinternal', 'levertoken', 'jobopeningid', 'vid'];
        for (const [key, value] of urlObj.searchParams) {
            if (idKeyParams.includes(key.toLowerCase())) {
                keepParams.set(key.toLowerCase(), value);
            }
        }
        urlObj.search = keepParams.toString();
        finalCanonicalUrl = urlObj.toString();
    } catch(e) { 
        console.warn(`crawlerUtils.js: Error building canonical URL for ${originalUrl}: ${e.message}. Using toLowerCase as fallback.`);
        finalCanonicalUrl = originalUrl.toLowerCase(); // Fallback
    }

    const currentAtsConfig = atsConfigs[atsType] || {}; // Get config, default to empty object

    // B. Job ID Extraction
    if (atsType === 'Greenhouse') {
      try { jobId = new URL(finalCanonicalUrl).searchParams.get('gh_jid'); } catch(e){}
    } else if (atsType === 'Workday') {
      const wdMatchPath = finalCanonicalUrl.match(/\/job\/[^/]+\/([Pp]\d{5,})/i);
      if (wdMatchPath && wdMatchPath[1]) {
        jobId = wdMatchPath[1];
      } else {
        const wdMatchGeneric = finalCanonicalUrl.match(/([Pp]\d{5,})/i);
        if (wdMatchGeneric && wdMatchGeneric[1]) jobId = wdMatchGeneric[1];
      }
    }
    if (!jobId && currentAtsConfig && currentAtsConfig.jobDetailUrlRegex) {
        try {
            const regex = new RegExp(currentAtsConfig.jobDetailUrlRegex);
            const match = finalCanonicalUrl.match(regex);
            if (match) {
                if (match[2] && match[2].length > 1) jobId = match[2]; // Prioritize group 2 if it seems like a real ID
                else if (match[1] && match[1].length > 1) jobId = match[1]; // Then group 1
                else {
                    for (let i = match.length - 1; i > 0; i--) { // Fallback: last non-empty, substantial group
                        if (match[i] && match[i].length > 1) { jobId = match[i]; break; }
                    }
                }
            }
        } catch(e) { console.warn(`crawlerUtils.js: Error extracting jobId with regex for ${atsType} on ${finalCanonicalUrl}: ${e.message}`); }
    }
    if (!jobId && (atsType === 'Lever' || atsType === 'Ashby' || atsType === 'Workable')) {
        try {
            const pathParts = new URL(finalCanonicalUrl).pathname.split('/');
            const potentialId = pathParts[pathParts.length -1];
            if (potentialId && /^[a-zA-Z0-9-]+$/.test(potentialId) && potentialId !== 'apply' && potentialId.length > 5) { 
                jobId = potentialId;
            }
        } catch(e) { /* ignore path parsing error */ }
    }
    if (!jobId) { // Ultimate fallback if still no ID - try to get it from HTML for some known patterns
        if (atsType === 'Workday') jobId = $$("span[data-automation-id='jobPostingIdentifier']").text().trim() || null;
        // Add other HTML-based fallbacks if necessary
    }


    // C. JSON-LD Extraction
    $$('script[type="application/ld+json"]').each((index, element) => {
        const scriptContent = $$(element).html();
        if (!scriptContent) return true;
        try {
            const jsonData = JSON.parse(scriptContent);
            if (jsonData && jsonData['@context'] && jsonData['@context'].toLowerCase().includes('schema.org') && jsonData['@type'] === 'JobPosting') {
                extractedTitle = jsonData.title || extractedTitle;
                companyName = (jsonData.hiringOrganization && jsonData.hiringOrganization.name) || companyName;
                if (jsonData.datePosted) {
                    try { postingDate = new Date(jsonData.datePosted).toISOString().split('T')[0]; }
                    catch (dateError) { /* console.warn(`Could not parse datePosted: ${jsonData.datePosted}`) */ }
                }
                if (jsonData.jobLocation) {
                    const jobLoc = Array.isArray(jsonData.jobLocation) ? jsonData.jobLocation[0] : jsonData.jobLocation;
                    if (jobLoc && jobLoc.address) {
                        const address = jobLoc.address;
                        let tempLoc = '';
                        if (typeof address === 'string') tempLoc = address;
                        else if (typeof address === 'object') {
                            let parts = [];
                            if (address.addressLocality) parts.push(address.addressLocality);
                            if (address.addressRegion) parts.push(address.addressRegion);
                            if (address.addressCountry) parts.push(address.addressCountry);
                            tempLoc = parts.join(', ');
                        }
                        if (tempLoc) extractedLocation = tempLoc;
                    }
                }
                if (extractedTitle && extractedLocation && companyName && postingDate && jobId) return false; // Found enough
            }
        } catch (e) { /* console.warn(`crawlerUtils.js: Error parsing LD+JSON for ${originalUrl}: ${e.message}`); */ }
    });

    // D. Fallback companyName Extraction
    if (!companyName && currentAtsConfig && currentAtsConfig.jobDetailUrlRegex) {
        try {
            const regex = new RegExp(currentAtsConfig.jobDetailUrlRegex);
            const match = finalCanonicalUrl.match(regex);
            // Heuristic: group 1 is company if not numeric, not 'job(s)', not 'P-num', not UUID, not a long ID-like string
            if (match && match[1] && isNaN(parseInt(match[1])) && match[1].length > 1 && match[1].length < 50 && 
                match[1] !== 'job' && match[1] !== 'jobs' && !match[1].startsWith('P') && 
                !/^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(match[1]) &&
                !/^[a-zA-Z0-9-]{15,}$/.test(match[1]) ) { 
                companyName = match[1];
            }
        } catch(e) { /* Warn */ }
    }
    if (!companyName) { // Final fallback for company name
        try {
            const hostParts = new URL(finalCanonicalUrl).hostname.split('.');
            if (hostParts.length > 1) {
                const potentialCo = hostParts[0];
                if (potentialCo !== 'www' && potentialCo !== 'jobs' && potentialCo !== 'careers' && potentialCo !== 'boards' && potentialCo !== 'apply' && !potentialCo.includes('myworkdayjobs') && !potentialCo.includes('icims')) {
                    companyName = potentialCo;
                } else if (hostParts.length > 2 && hostParts[1] !== 'co') { // e.g. www.company.com
                     companyName = hostParts[1];
                }
            }
        } catch(e) {}
    }


    // E. Fallback extractedTitle and extractedLocation
    if (!extractedTitle) { // If not from JSON-LD or initial args
        extractedTitle = $$('h1').first().text().trim() || $$('title').first().text().trim() || null;
    }
    if (!extractedLocation) { // If not from JSON-LD or initial args
        const selectors = currentAtsConfig.locationSelectors || [];
        for (const selector of selectors) {
            const locElement = $$(selector).first();
            let locText = '';
            if (locElement.length) {
                if (locElement.is('meta')) locText = locElement.attr('content');
                else locText = locElement.text();
            }
            if (locText && locText.trim()) {
                extractedLocation = locText.trim();
                break;
            }
        }
        if (!extractedLocation) { // Regex fallback if still not found
            const locMatchFallback = html.match(/[A-Z][a-zA-Z]+,\s?(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)/);
            if (locMatchFallback) extractedLocation = locMatchFallback[0];
        }
    }

    // F. Finalize values
    const finalTitle = (extractedTitle || '').trim().slice(0, 140) || null;
    const finalLocation = (extractedLocation || '').trim().slice(0, 255) || null;
    companyName = (companyName || '').trim().slice(0, 255) || null;
    jobId = (jobId || '').trim().slice(0, 255) || null;
    finalCanonicalUrl = finalCanonicalUrl.slice(0, 1024);
    postingDate = postingDate || null; // Ensure it's null if not found

    // New: Determine finalJobFamily
    let finalJobFamily = jobFamilyFromCaller; // Use the passed-in family by default
    if (!finalJobFamily || finalJobFamily === 'Unknown' || finalJobFamily === null || finalJobFamily === 'DIRECT') {
        finalJobFamily = detectFamily(finalTitle, jobKeywordsConfig); 
    }

    // New: Logging Warning for 'Unknown' family for Google-sourced jobs
    if (finalJobFamily === 'Unknown' && hostId === null) {
        console.warn(`crawlerUtils.js: Job family resolved to 'Unknown' for potentially Google-sourced job. URL: ${originalUrl}, Title: "${finalTitle}"`);
    }

    const newHtmlHash = sha256(html);
    const newUrlHash = sha256(finalCanonicalUrl); // Hash of the canonical URL

    // G. SQL Modifications
    let jobPostingDbId = null;
    try {
        // Call isDuplicate before any database operations for the main record
        if (await isDuplicate({ company: companyName, jobId: jobId, title: finalTitle, location: finalLocation })) {
            console.log(`crawlerUtils.js: Duplicate detected by content fields for URL ${originalUrl} (Company: ${companyName}, JobID: ${jobId}, Title: ${finalTitle}). Skipping DB upsert.`);
            // Even if it's a duplicate by content, we might still want to update last_seen_at if an exact URL match was found.
            // However, the current pre-fetch duplicate check in googleSearchCrawler already handles exact URL/hash matches.
            // For a semantic duplicate found here, we typically don't create a new record or significantly update an old one beyond 'last_seen_at'.
            // The current isDuplicate logic doesn't return the ID of the duplicate, so we can't easily update its last_seen_at here.
            // For now, returning false will prevent this "new" (but semantically duplicate) version from being stored or counted.
            return false; 
        }

        const { rows } = await pool.query(
        `SELECT id, html_hash, job_title AS old_title, location AS old_location, initial_snapshot_done, 
                job_id AS old_job_id, company AS old_company, posting_date AS old_posting_date, canonical_url AS old_canonical_url
         FROM job_postings 
         WHERE url = $1 OR canonical_url = $2 OR url_hash = $3`, // Check originalUrl, canonical_url and its hash
        [originalUrl, finalCanonicalUrl, newUrlHash]);
        
        if (rows.length > 0) {
            const existingJob = rows[0];
            jobPostingDbId = existingJob.id;
            if (!existingJob.initial_snapshot_done) {
                await addJobPostingVersion(jobPostingDbId, existingJob.html_hash, existingJob.old_title, existingJob.old_location);
                await pool.query('UPDATE job_postings SET initial_snapshot_done = true WHERE id = $1', [jobPostingDbId]);
            }
            if (newHtmlHash !== existingJob.html_hash) {
                await addJobPostingVersion(jobPostingDbId, newHtmlHash, finalTitle, finalLocation);
                await pool.query(
                `UPDATE job_postings 
                 SET html_hash = $1, job_title = $2, location = $3, url_hash = $4, last_seen_at = NOW(), status = 'open',
                     job_id = $5, company = $6, posting_date = $7, canonical_url = $8, url = $9, job_family = $10
                 WHERE id = $11`, 
                [newHtmlHash, finalTitle, finalLocation, newUrlHash, jobId, companyName, postingDate, finalCanonicalUrl, originalUrl, finalJobFamily, jobPostingDbId]);
            } else {
                await pool.query(
                `UPDATE job_postings 
                 SET last_seen_at = NOW(), status = 'open', job_title = $1, location = $2, url_hash = $3,
                     job_id = $4, company = $5, posting_date = $6, canonical_url = $7, url = $8, job_family = $9
                 WHERE id = $10`,
                [finalTitle, finalLocation, newUrlHash, jobId, companyName, postingDate, finalCanonicalUrl, originalUrl, finalJobFamily, jobPostingDbId]);
            }
        } else {
            const insertResult = await pool.query(
            `INSERT INTO job_postings 
                (ats_host_id, url, html_hash, job_title, location, url_hash, status, initial_snapshot_done, last_seen_at, discovered_at,
                 job_id, company, posting_date, canonical_url, job_family) 
             VALUES ($1, $2, $3, $4, $5, $6, 'open', false, NOW(), NOW(), $7, $8, $9, $10, $11) 
             RETURNING id`,
            [hostId, originalUrl, newHtmlHash, finalTitle, finalLocation, newUrlHash, jobId, companyName, postingDate, finalCanonicalUrl, finalJobFamily]);
            
            if (insertResult.rows.length > 0) {
                jobPostingDbId = insertResult.rows[0].id;
                await addJobPostingVersion(jobPostingDbId, newHtmlHash, finalTitle, finalLocation);
                await pool.query('UPDATE job_postings SET initial_snapshot_done = true WHERE id = $1', [jobPostingDbId]);
            } else { 
                console.error(`crawlerUtils.js: Failed to insert new job posting for URL ${originalUrl}. RETURNING id did not provide an id.`);
                return false; 
            }
        }
        return true;
    } catch (error) {
        console.error(`crawlerUtils.js: Error in processJobPosting for URL ${originalUrl}: ${error.message}`, error.stack);
        return false;
    }
}
