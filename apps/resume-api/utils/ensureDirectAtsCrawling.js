/**
 * Script to ensure direct ATS crawling is properly integrated
 * - Adds core ATS domains to the database
 * - Runs domain enumeration to discover new subdomains
 * - Executes the job crawler to scrape directly from ATS platforms
 */

import pg from 'pg';
import { runDomainEnumeration } from './domainEnumerator.js';
import { runJobCrawler } from './jobCrawler.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Core ATS domains that should always be in the database
const CORE_ATS_DOMAINS = [
  // Greenhouse
  { domain: 'boards.greenhouse.io', atsType: 'Greenhouse', company: 'Greenhouse' },
  
  // Lever
  { domain: 'jobs.lever.co', atsType: 'Lever', company: 'Lever' },
  
  // Ashby  
  { domain: 'jobs.ashbyhq.com', atsType: 'Ashby', company: 'Ashby' },
  
  // Workable
  { domain: 'jobs.workable.com', atsType: 'Workable', company: 'Workable' },
  
  // Known Workday subdomains (examples from your requirements)
  { domain: 'zillow.wd5.myworkdayjobs.com', atsType: 'Workday', company: 'zillow' },
  
  // Known iCIMS subdomains (examples from your requirements)  
  { domain: 'careers-quest.icims.com', atsType: 'iCIMS', company: 'quest' },
];

async function addCoreAtsDomains() {
  console.log('Adding core ATS domains to database...');
  
  for (const { domain, atsType, company } of CORE_ATS_DOMAINS) {
    try {
      const { rowCount } = await pool.query(
        `INSERT INTO ats_hosts (company, domain, ats_type, is_active, discovered_at)
         VALUES ($1, $2, $3, true, NOW())
         ON CONFLICT (domain) DO UPDATE SET
           ats_type = EXCLUDED.ats_type,
           is_active = true,
           discovered_at = COALESCE(ats_hosts.discovered_at, NOW())`,
        [company, domain, atsType]
      );
      
      if (rowCount > 0) {
        console.log(`✓ Added/updated ATS host: ${domain} (${atsType})`);
      } else {
        console.log(`- ATS host already exists: ${domain}`);
      }
    } catch (error) {
      console.error(`✗ Error adding ATS host ${domain}: ${error.message}`);
    }
  }
}

async function checkCurrentAtsDomains() {
  console.log('\n--- Current ATS Hosts in Database ---');
  
  try {
    const { rows } = await pool.query(`
      SELECT domain, ats_type, company, is_active, discovered_at
      FROM ats_hosts 
      ORDER BY ats_type, domain
    `);
    
    if (rows.length === 0) {
      console.log('No ATS hosts found in database');
      return;
    }
    
    const grouped = {};
    rows.forEach(row => {
      if (!grouped[row.ats_type]) grouped[row.ats_type] = [];
      grouped[row.ats_type].push(row);
    });
    
    Object.entries(grouped).forEach(([atsType, hosts]) => {
      console.log(`\n${atsType} (${hosts.length} domains):`);
      hosts.forEach(host => {
        const status = host.is_active ? '✓' : '✗';
        console.log(`  ${status} ${host.domain} (${host.company})`);
      });
    });
    
  } catch (error) {
    console.error('Error checking current ATS domains:', error.message);
  }
}

async function runDirectAtsCrawling({ 
  runDiscovery = true, 
  runCrawling = true,
  maxDiscoveryTime = 300000 // 5 minutes max for discovery
} = {}) {
  console.log('🚀 Starting Direct ATS Crawling Integration\n');
  
  try {
    // Step 1: Add core domains
    await addCoreAtsDomains();
    
    // Step 2: Check what we have
    await checkCurrentAtsDomains();
    
    // Step 3: Run domain enumeration (optional, can be time-consuming)
    if (runDiscovery) {
      console.log('\n--- Running Domain Enumeration ---');
      console.log(`⏱️  Max discovery time: ${maxDiscoveryTime / 1000}s`);
      
      const discoveryPromise = runDomainEnumeration();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Discovery timeout')), maxDiscoveryTime)
      );
      
      try {
        await Promise.race([discoveryPromise, timeoutPromise]);
        console.log('✓ Domain enumeration completed');
      } catch (error) {
        if (error.message === 'Discovery timeout') {
          console.log('⏱️  Domain enumeration timed out - continuing with existing domains');
        } else {
          console.warn(`⚠️  Domain enumeration error: ${error.message}`);
        }
      }
      
      // Check domains again after discovery
      await checkCurrentAtsDomains();
    }
    
    // Step 4: Run the job crawler
    if (runCrawling) {
      console.log('\n--- Running Direct Job Crawler ---');
      await runJobCrawler();
      console.log('✓ Job crawling completed');
    }
    
    console.log('\n🎉 Direct ATS Crawling Integration Complete!');
    
  } catch (error) {
    console.error('❌ Error in direct ATS crawling:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  const options = {
    runDiscovery: !args.includes('--no-discovery'),
    runCrawling: !args.includes('--no-crawling'),
    maxDiscoveryTime: 300000 // 5 minutes default
  };
  
  const timeArg = args.find(arg => arg.startsWith('--max-discovery-time='));
  if (timeArg) {
    options.maxDiscoveryTime = parseInt(timeArg.split('=')[1]) * 1000;
  }
  
  console.log('CLI Options:', options);
  
  runDirectAtsCrawling(options)
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { runDirectAtsCrawling, addCoreAtsDomains, checkCurrentAtsDomains }; 