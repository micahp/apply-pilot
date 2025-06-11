const fastify = require('fastify')({ logger: true });
const path = require('path');
const cors = require('@fastify/cors');
const staticPlugin = require('@fastify/static');
const pg = require('pg');

const fetchFn =
  typeof fetch === 'function'
    ? fetch
    : (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const PORT = process.env.PORT || 3001;

// Database connection for direct ATS data
const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/autoapply'
});

fastify.register(cors, { origin: true });
fastify.register(staticPlugin, {
  root: path.join(__dirname, 'public'),
  prefix: '/',
});

// Direct ATS job search using our database
fastify.get('/api/jobs', async (request, reply) => {
  try {
    const { 
      limit = 50, 
      atsType, 
      location, 
      family,
      hoursBack = 72 
    } = request.query;

    // Build dynamic query based on filters
    let query = `
      SELECT 
        jp.id,
        jp.job_title as title,
        jp.company,
        jp.location,
        jp.url,
        jp.job_family,
        jp.posting_date,
        jp.discovered_at,
        COALESCE(jp.ats_type, ah.ats_type) as ats_type,
        ah.domain
      FROM job_postings jp
      LEFT JOIN ats_hosts ah ON jp.ats_host_id = ah.id
      WHERE jp.status IN ('open', 'active')
        AND jp.last_seen_at > NOW() - INTERVAL '${parseInt(hoursBack)} hours'
    `;
    
    const params = [];
    let paramCount = 0;

    // Add filters
    if (atsType) {
      paramCount++;
      query += ` AND (jp.ats_type = $${paramCount} OR ah.ats_type = $${paramCount})`;
      params.push(atsType);
    }

    if (location) {
      paramCount++;
      query += ` AND jp.location ILIKE $${paramCount}`;
      params.push(`%${location}%`);
    }

    if (family) {
      paramCount++;
      query += ` AND jp.job_family = $${paramCount}`;
      params.push(family);
    }

    // Filter for software engineering roles by default
    if (!family) {
      query += ` AND (
        jp.job_title ILIKE '%software%engineer%' OR
        jp.job_title ILIKE '%software%developer%' OR
        jp.job_title ILIKE '%software%tester%' OR
        jp.job_title ILIKE '%full%stack%' OR
        jp.job_title ILIKE '%backend%engineer%' OR
        jp.job_title ILIKE '%frontend%engineer%' OR
        jp.job_title ILIKE '%front%end%engineer%' OR
        jp.job_title ILIKE '%front-end%engineer%' OR
        jp.job_title ILIKE '%azure%developer%' OR
        jp.job_title ILIKE '%cloud%engineer%' OR
        jp.job_title ILIKE '%cloud%developer%' OR
        jp.job_title ILIKE '%devops%engineer%' OR
        jp.job_title ILIKE '%dev%ops%engineer%' OR
        jp.job_title ILIKE '%platform%engineer%' OR
        jp.job_title ILIKE '%site%reliability%engineer%' OR
        jp.job_title ILIKE '%sre%' OR
        jp.job_title ILIKE '%qa%engineer%' OR
        jp.job_title ILIKE '%quality%assurance%' OR
        jp.job_title ILIKE '%test%engineer%' OR
        jp.job_title ILIKE '%mobile%engineer%' OR
        jp.job_title ILIKE '%mobile%developer%' OR
        jp.job_title ILIKE '%ios%engineer%' OR
        jp.job_title ILIKE '%ios%developer%' OR
        jp.job_title ILIKE '%android%engineer%' OR
        jp.job_title ILIKE '%android%developer%' OR
        jp.job_title ILIKE '%react%developer%' OR
        jp.job_title ILIKE '%javascript%developer%' OR
        jp.job_title ILIKE '%node%developer%' OR
        jp.job_title ILIKE '%python%developer%' OR
        jp.job_title ILIKE '%java%developer%' OR
        jp.job_title ILIKE '%c++%developer%' OR
        jp.job_title ILIKE '%golang%developer%' OR
        jp.job_title ILIKE '%go%developer%' OR
        jp.job_title ILIKE '%rust%developer%' OR
        jp.job_title ILIKE '%data%engineer%' OR
        jp.job_title ILIKE '%ml%engineer%' OR
        jp.job_title ILIKE '%machine%learning%engineer%' OR
        jp.job_title ILIKE '%ai%engineer%' OR
        jp.job_title ILIKE '%security%engineer%' OR
        jp.job_title ILIKE '%infrastructure%engineer%' OR
        jp.job_title ILIKE '%systems%engineer%' OR
        jp.job_title ILIKE '%network%engineer%' OR
        jp.job_title ILIKE '%embedded%engineer%' OR
        jp.job_title ILIKE '%firmware%engineer%' OR
        jp.job_title ILIKE '%hardware%engineer%' OR
        jp.job_title ILIKE '%technical%lead%' OR
        jp.job_title ILIKE '%tech%lead%' OR
        jp.job_title ILIKE '%engineering%manager%' OR
        jp.job_title ILIKE '%principal%engineer%' OR
        jp.job_title ILIKE '%staff%engineer%' OR
        jp.job_title ILIKE '%senior%engineer%' OR
        jp.job_title ILIKE '%lead%engineer%' OR
        jp.job_title ILIKE '%architect%' OR
        jp.job_title ILIKE '%developer%' OR
        jp.job_title ILIKE '%engineer%' OR
        jp.job_family = 'Engineering'
      )`;
    }

    // Order by most recent first
    query += ` ORDER BY jp.discovered_at DESC LIMIT $${++paramCount}`;
    params.push(parseInt(limit));

    const { rows } = await pool.query(query, params);

    // Transform to expected format
    const jobs = rows.map(row => ({
      id: row.id,
      title: row.title || 'Software Engineer',
      company: row.company || row.domain?.split('.')[0] || 'Unknown',
      location: row.location || 'Remote',
      url: row.url,
      source: row.ats_type,
      jobFamily: row.job_family,
      postedDate: row.posting_date,
      discoveredAt: row.discovered_at,
      atsType: row.ats_type
    }));

    // Additional filtering to remove placeholder jobs
    const filteredJobs = jobs.filter(job => {
      const title = job.title.toLowerCase();
      const isPlaceholder = title.includes("don't see what you're looking for") ||
                           title.includes("don't see what you're looking for") || // curly quotes
                           title.includes("general application") ||
                           title.includes("join our talent") ||
                           title.includes("talent pool") ||
                           title.includes("we're always hiring") ||
                           title.includes("open application");
      return !isPlaceholder;
    });

    reply.send({ 
      jobs: filteredJobs,
      total: filteredJobs.length,
      filters: { atsType, location, family, hoursBack },
      source: 'direct_ats_crawling'
    });

  } catch (err) {
    fastify.log.error('Error fetching jobs from database:', err);
    reply.status(500).send({ 
      error: 'Failed to fetch jobs',
      jobs: [],
      fallback: true
    });
  }
});

// Fallback function for Greenhouse API (if needed)
async function fetchGreenhouseJobs(company) {
  try {
    const url = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs`;
    const res = await fetchFn(url);
    if (!res.ok) throw new Error(`Greenhouse fetch failed: ${res.status}`);
    const data = await res.json();
    return data.jobs.map(j => ({
      id: j.id.toString(),
      title: j.title,
      company: j.company_name,
      url: j.absolute_url,
      location: j.location?.name || 'Unknown',
      source: 'Greenhouse'
    }));
  } catch (error) {
    fastify.log.error('Greenhouse API fallback failed:', error);
    return [];
  }
}

fastify.get('/', async (request, reply) => {
  return reply.sendFile('index.html');
});

// ATS crawler statistics and management
fastify.get('/api/ats/stats', async (request, reply) => {
  try {
    // Get ATS host statistics
    const hostsQuery = `
      SELECT 
        ats_type,
        COUNT(*) as host_count,
        COUNT(CASE WHEN is_active THEN 1 END) as active_hosts
      FROM ats_hosts 
      GROUP BY ats_type 
      ORDER BY host_count DESC
    `;
    const hostsResult = await pool.query(hostsQuery);

    // Get job statistics
    const jobsQuery = `
      SELECT 
        ah.ats_type,
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN jp.status = 'open' THEN 1 END) as open_jobs,
        COUNT(CASE WHEN jp.last_seen_at > NOW() - INTERVAL '24 hours' THEN 1 END) as jobs_24h,
        MAX(jp.discovered_at) as latest_discovery
      FROM job_postings jp
      JOIN ats_hosts ah ON jp.ats_host_id = ah.id
      GROUP BY ah.ats_type
      ORDER BY total_jobs DESC
    `;
    const jobsResult = await pool.query(jobsQuery);

    // Get recent activity
    const recentQuery = `
      SELECT 
        jp.job_title,
        jp.company,
        ah.ats_type,
        ah.domain,
        jp.discovered_at
      FROM job_postings jp
      JOIN ats_hosts ah ON jp.ats_host_id = ah.id
      WHERE jp.discovered_at > NOW() - INTERVAL '24 hours'
      ORDER BY jp.discovered_at DESC
      LIMIT 10
    `;
    const recentResult = await pool.query(recentQuery);

    reply.send({
      timestamp: new Date().toISOString(),
      ats_hosts: hostsResult.rows,
      job_stats: jobsResult.rows,
      recent_discoveries: recentResult.rows,
      source: 'direct_ats_crawling'
    });

  } catch (err) {
    fastify.log.error('Error fetching ATS stats:', err);
    reply.status(500).send({ error: 'Failed to fetch ATS statistics' });
  }
});

// Trigger direct ATS crawling
fastify.post('/api/ats/crawl', async (request, reply) => {
  try {
    const { 
      runDiscovery = false, 
      runCrawling = true,
      maxDiscoveryTime = 120 // 2 minutes default for API calls
    } = request.body || {};

    // Import the crawling functions dynamically
    const { runDirectAtsCrawling } = await import('../resume-api/utils/ensureDirectAtsCrawling.js');
    
    // Start crawling in background (don't await to avoid timeout)
    const crawlingPromise = runDirectAtsCrawling({
      runDiscovery,
      runCrawling,
      maxDiscoveryTime: maxDiscoveryTime * 1000
    });

    // Return immediately with status
    reply.send({
      message: 'Direct ATS crawling initiated',
      options: { runDiscovery, runCrawling, maxDiscoveryTime },
      status: 'started',
      timestamp: new Date().toISOString()
    });

    // Log completion (but don't block response)
    crawlingPromise
      .then(() => fastify.log.info('Direct ATS crawling completed successfully'))
      .catch(err => fastify.log.error('Direct ATS crawling failed:', err));

  } catch (err) {
    fastify.log.error('Error starting ATS crawl:', err);
    reply.status(500).send({ error: 'Failed to start ATS crawling' });
  }
});

// Get ATS hosts
fastify.get('/api/ats/hosts', async (request, reply) => {
  try {
    const { atsType, active } = request.query;
    
    let query = 'SELECT * FROM ats_hosts';
    const params = [];
    const conditions = [];
    
    if (atsType) {
      conditions.push(`ats_type = $${params.length + 1}`);
      params.push(atsType);
    }
    
    if (active !== undefined) {
      conditions.push(`is_active = $${params.length + 1}`);
      params.push(active === 'true');
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY ats_type, domain';
    
    const { rows } = await pool.query(query, params);
    
    reply.send({
      hosts: rows,
      total: rows.length,
      filters: { atsType, active }
    });
    
  } catch (err) {
    fastify.log.error('Error fetching ATS hosts:', err);
    reply.status(500).send({ error: 'Failed to fetch ATS hosts' });
  }
});

fastify.listen({ port: PORT, host: '0.0.0.0' }, err => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Server listening on port ${PORT}`);
});
