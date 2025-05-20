import pg from 'pg';
import got from 'got';
import crypto from 'crypto';

export const CRAWLER_CONCURRENCY = process.env.CRAWLER_CONCURRENCY ? parseInt(process.env.CRAWLER_CONCURRENCY, 10) : 4;
export const CRAWLER_REQUEST_TIMEOUT = process.env.CRAWLER_REQUEST_TIMEOUT ? parseInt(process.env.CRAWLER_REQUEST_TIMEOUT, 10) : 8000; // ms
export const USER_AGENT_STRING = 'ApplyPilotBot/0.1 (+https://apply-pilot.ai/bot)';
export const RATE_LIMIT_ERROR_MARKER = Symbol('RATE_LIMIT_ERROR');

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
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

export async function processJobPosting({ hostId, url: originalUrl, html, title, location, atsType /* New: needed for atsConfigs lookup if not already done */ }) {
    if (!html) { return false; }
    const newHtmlHash = sha256(html);
    let normalizedUrlObj = new URL(originalUrl);
    let paramsToDelete = [];
    for (const [key] of normalizedUrlObj.searchParams) {
        if (key.toLowerCase() !== 'gh_jid' && key.toLowerCase() !== 'jobid') {
        paramsToDelete.push(key);
        }
    }
    paramsToDelete.forEach(key => normalizedUrlObj.searchParams.delete(key));
    const pathname = normalizedUrlObj.pathname && normalizedUrlObj.pathname.startsWith('/') ? normalizedUrlObj.pathname : (normalizedUrlObj.pathname ? `/${normalizedUrlObj.pathname}` : '/');
    const normalizedUrl = (pathname + normalizedUrlObj.search).toLowerCase();
    const newUrlHash = sha256(normalizedUrl);
    let jobPostingId = null;
    try {
        const { rows } = await pool.query(
        `SELECT id, html_hash, job_title AS old_title, location AS old_location, initial_snapshot_done 
        FROM job_postings WHERE url = $1`, [originalUrl]);
        if (rows.length > 0) {
            const existingJob = rows[0];
            jobPostingId = existingJob.id;
            if (!existingJob.initial_snapshot_done) {
                await addJobPostingVersion(jobPostingId, existingJob.html_hash, existingJob.old_title, existingJob.old_location);
                await pool.query('UPDATE job_postings SET initial_snapshot_done = true WHERE id = $1', [jobPostingId]);
            }
            if (newHtmlHash !== existingJob.html_hash) {
                await addJobPostingVersion(jobPostingId, newHtmlHash, title, location);
                await pool.query(
                `UPDATE job_postings SET html_hash = $1, job_title = $2, location = $3, url_hash = $4, last_seen_at = NOW(), status = 'open'
                WHERE id = $5`, [newHtmlHash, title, location, newUrlHash, jobPostingId]);
            } else {
                await pool.query(
                `UPDATE job_postings SET last_seen_at = NOW(), status = 'open', job_title = $1, location = $2, url_hash = $3 WHERE id = $4`,
                [title, location, newUrlHash, jobPostingId]);
            }
        } else {
            const insertResult = await pool.query(
            `INSERT INTO job_postings (ats_host_id, url, html_hash, job_title, location, url_hash, status, initial_snapshot_done, last_seen_at, discovered_at) 
            VALUES ($1, $2, $3, $4, $5, $6, 'open', false, NOW(), NOW()) RETURNING id`,
            [hostId, originalUrl, newHtmlHash, title, location, newUrlHash]);
            if (insertResult.rows.length > 0) {
                jobPostingId = insertResult.rows[0].id;
                await addJobPostingVersion(jobPostingId, newHtmlHash, title, location);
                await pool.query('UPDATE job_postings SET initial_snapshot_done = true WHERE id = $1', [jobPostingId]);
            } else { 
                console.error(`Failed to insert new job posting for URL ${originalUrl}. RETURNING id did not provide an id.`);
                return false; 
            }
        }
        return true;
    } catch (error) {
        console.error(`Error in processJobPosting for URL ${originalUrl}: ${error.message}`, error.stack);
        return false;
    }
}
