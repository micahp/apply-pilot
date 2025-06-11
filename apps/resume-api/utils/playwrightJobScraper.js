import { chromium } from 'playwright';
import pg from 'pg';

// Database connection
const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/autoapply' 
});

// Known active company career pages for different ATS platforms
const ACTIVE_COMPANY_PAGES = {
  Greenhouse: [
    'https://boards.greenhouse.io/vercel',
    'https://boards.greenhouse.io/webflow',
    'https://boards.greenhouse.io/retool',
    'https://boards.greenhouse.io/notion',
    'https://boards.greenhouse.io/figma'
  ],
  Lever: [
    'https://jobs.lever.co/netflix',
    'https://jobs.lever.co/coursera',
    'https://jobs.lever.co/mixpanel'
  ],
  Ashby: [
    'https://jobs.ashbyhq.com/ramp',
    'https://jobs.ashbyhq.com/anthropic'
  ]
};

class PlaywrightJobScraper {
  constructor() {
    this.browser = null;
    this.context = null;
  }

  async initialize() {
    console.log('🚀 Initializing Playwright browser...');
    
    // Launch browser with stealth settings
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    // Create context with realistic user agent and viewport
    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York'
    });

    console.log('✅ Browser initialized successfully');
  }

  async scrapeGreenhouseJobs(companyUrl) {
    const page = await this.context.newPage();
    const jobs = [];

    try {
      console.log(`🔍 Scraping Greenhouse jobs from: ${companyUrl}`);
      
      await page.goto(companyUrl, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Multiple selector strategies for Greenhouse
      const selectors = [
        '[data-qa="opening"]',
        '.opening',
        '.job-post',
        '.position',
        'a[href*="/jobs/"]'
      ];
      
      let jobElements = [];
      for (const selector of selectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          jobElements = await page.$$(selector);
          if (jobElements.length > 0) {
            console.log(`✅ Found ${jobElements.length} job elements using selector: ${selector}`);
            break;
          }
        } catch (e) {
          console.log(`⚠️ Selector ${selector} not found, trying next...`);
        }
      }
      
      if (jobElements.length === 0) {
        // Fallback: look for any links containing "jobs" or job-related text
        const allLinks = await page.$$('a');
        for (const link of allLinks) {
          const href = await link.getAttribute('href');
          const text = await link.textContent();
          
          if (href && (href.includes('/jobs/') || href.includes('/job/')) && 
              text && this.isEngineeringRole(text)) {
            jobElements.push(link);
          }
        }
        console.log(`📋 Fallback found ${jobElements.length} potential job links`);
      }
      
      for (const jobElement of jobElements) {
        try {
          let title, location, department, url;
          
          // Try different ways to extract job info
          const titleSelectors = ['[data-qa="opening-title"]', '.opening-title', 'h3', 'h4', '.job-title'];
          const locationSelectors = ['[data-qa="opening-location"]', '.opening-location', '.location'];
          const departmentSelectors = ['[data-qa="opening-department"]', '.opening-department', '.department'];
          
          // Extract title
          for (const selector of titleSelectors) {
            const element = await jobElement.$(selector);
            if (element) {
              title = await element.textContent();
              break;
            }
          }
          
          // If no title found in child elements, use the element's own text
          if (!title) {
            title = await jobElement.textContent();
          }
          
          // Extract location
          for (const selector of locationSelectors) {
            const element = await jobElement.$(selector);
            if (element) {
              location = await element.textContent();
              break;
            }
          }
          
          // Extract department
          for (const selector of departmentSelectors) {
            const element = await jobElement.$(selector);
            if (element) {
              department = await element.textContent();
              break;
            }
          }
          
          // Extract URL
          const href = await jobElement.getAttribute('href');
          if (href) {
            url = href.startsWith('http') ? href : `https://boards.greenhouse.io${href}`;
          } else {
            const linkElement = await jobElement.$('a');
            if (linkElement) {
              const linkHref = await linkElement.getAttribute('href');
              url = linkHref?.startsWith('http') ? linkHref : `https://boards.greenhouse.io${linkHref}`;
            }
          }
          
          if (title && url && this.isEngineeringRole(title)) {
            jobs.push({
              title: title.trim(),
              company: this.extractCompanyFromUrl(companyUrl),
              location: (location || 'Remote').trim(),
              department: (department || 'Engineering').trim(),
              url: url,
              atsType: 'Greenhouse',
              source: companyUrl
            });
          }
        } catch (error) {
          console.warn(`⚠️ Error parsing job element: ${error.message}`);
        }
      }
      
      console.log(`✅ Found ${jobs.length} engineering jobs from ${companyUrl}`);
      
    } catch (error) {
      console.error(`❌ Error scraping ${companyUrl}: ${error.message}`);
    } finally {
      await page.close();
    }

    return jobs;
  }

  async scrapeLeverJobs(companyUrl) {
    const page = await this.context.newPage();
    const jobs = [];

    try {
      console.log(`🔍 Scraping Lever jobs from: ${companyUrl}`);
      
      await page.goto(companyUrl, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Multiple selector strategies for Lever
      const selectors = [
        '.posting',
        '.job-posting',
        '.position',
        'a[href*="/jobs/"]'
      ];
      
      let jobElements = [];
      for (const selector of selectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          jobElements = await page.$$(selector);
          if (jobElements.length > 0) {
            console.log(`✅ Found ${jobElements.length} job elements using selector: ${selector}`);
            break;
          }
        } catch (e) {
          console.log(`⚠️ Selector ${selector} not found, trying next...`);
        }
      }
      
      for (const jobElement of jobElements) {
        try {
          let title, location, department, url;
          
          // Try different ways to extract job info
          const titleSelectors = ['.posting-title h5', '.posting-title', '.job-title', 'h3', 'h4'];
          const locationSelectors = ['.posting-categories .location', '.location'];
          const departmentSelectors = ['.posting-categories .department', '.department'];
          
          // Extract title
          for (const selector of titleSelectors) {
            const element = await jobElement.$(selector);
            if (element) {
              title = await element.textContent();
              break;
            }
          }
          
          if (!title) {
            title = await jobElement.textContent();
          }
          
          // Extract location and department
          for (const selector of locationSelectors) {
            const element = await jobElement.$(selector);
            if (element) {
              location = await element.textContent();
              break;
            }
          }
          
          for (const selector of departmentSelectors) {
            const element = await jobElement.$(selector);
            if (element) {
              department = await element.textContent();
              break;
            }
          }
          
          // Extract URL
          const href = await jobElement.getAttribute('href');
          if (href) {
            url = href.startsWith('http') ? href : `https://jobs.lever.co${href}`;
          } else {
            const linkElement = await jobElement.$('a');
            if (linkElement) {
              const linkHref = await linkElement.getAttribute('href');
              url = linkHref?.startsWith('http') ? linkHref : `https://jobs.lever.co${linkHref}`;
            }
          }
          
          if (title && url && this.isEngineeringRole(title)) {
            jobs.push({
              title: title.trim(),
              company: this.extractCompanyFromUrl(companyUrl),
              location: (location || 'Remote').trim(),
              department: (department || 'Engineering').trim(),
              url: url,
              atsType: 'Lever',
              source: companyUrl
            });
          }
        } catch (error) {
          console.warn(`⚠️ Error parsing job element: ${error.message}`);
        }
      }
      
      console.log(`✅ Found ${jobs.length} engineering jobs from ${companyUrl}`);
      
    } catch (error) {
      console.error(`❌ Error scraping ${companyUrl}: ${error.message}`);
    } finally {
      await page.close();
    }

    return jobs;
  }

  async scrapeAshbyJobs(companyUrl) {
    const page = await this.context.newPage();
    const jobs = [];

    try {
      console.log(`🔍 Scraping Ashby jobs from: ${companyUrl}`);
      
      await page.goto(companyUrl, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Multiple selector strategies for Ashby
      const selectors = [
        '[data-testid="job-posting"]',
        '.job-posting',
        '.position',
        'a[href*="/jobs/"]'
      ];
      
      let jobElements = [];
      for (const selector of selectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          jobElements = await page.$$(selector);
          if (jobElements.length > 0) {
            console.log(`✅ Found ${jobElements.length} job elements using selector: ${selector}`);
            break;
          }
        } catch (e) {
          console.log(`⚠️ Selector ${selector} not found, trying next...`);
        }
      }
      
      for (const jobElement of jobElements) {
        try {
          let title, location, department, url;
          
          // Try different ways to extract job info
          const titleSelectors = ['[data-testid="job-title"]', '.job-title', 'h3', 'h4'];
          const locationSelectors = ['[data-testid="job-location"]', '.job-location', '.location'];
          const departmentSelectors = ['[data-testid="job-department"]', '.job-department', '.department'];
          
          // Extract title
          for (const selector of titleSelectors) {
            const element = await jobElement.$(selector);
            if (element) {
              title = await element.textContent();
              break;
            }
          }
          
          if (!title) {
            title = await jobElement.textContent();
          }
          
          // Extract location and department
          for (const selector of locationSelectors) {
            const element = await jobElement.$(selector);
            if (element) {
              location = await element.textContent();
              break;
            }
          }
          
          for (const selector of departmentSelectors) {
            const element = await jobElement.$(selector);
            if (element) {
              department = await element.textContent();
              break;
            }
          }
          
          // Extract URL
          const href = await jobElement.getAttribute('href');
          if (href) {
            url = href.startsWith('http') ? href : `https://jobs.ashbyhq.com${href}`;
          } else {
            const linkElement = await jobElement.$('a');
            if (linkElement) {
              const linkHref = await linkElement.getAttribute('href');
              url = linkHref?.startsWith('http') ? linkHref : `https://jobs.ashbyhq.com${linkHref}`;
            }
          }
          
          if (title && url && this.isEngineeringRole(title)) {
            jobs.push({
              title: title.trim(),
              company: this.extractCompanyFromUrl(companyUrl),
              location: (location || 'Remote').trim(),
              department: (department || 'Engineering').trim(),
              url: url,
              atsType: 'Ashby',
              source: companyUrl
            });
          }
        } catch (error) {
          console.warn(`⚠️ Error parsing job element: ${error.message}`);
        }
      }
      
      console.log(`✅ Found ${jobs.length} engineering jobs from ${companyUrl}`);
      
    } catch (error) {
      console.error(`❌ Error scraping ${companyUrl}: ${error.message}`);
    } finally {
      await page.close();
    }

    return jobs;
  }

  isEngineeringRole(title) {
    const engineeringKeywords = [
      'software', 'engineer', 'developer', 'programmer', 'architect',
      'frontend', 'backend', 'fullstack', 'full-stack', 'full stack',
      'devops', 'sre', 'platform', 'infrastructure', 'cloud',
      'mobile', 'ios', 'android', 'react', 'javascript', 'python',
      'java', 'golang', 'rust', 'typescript', 'node', 'api',
      'machine learning', 'ml', 'ai', 'data engineer', 'qa',
      'test', 'automation', 'security', 'cyber', 'blockchain',
      'web3', 'crypto', 'embedded', 'firmware', 'systems',
      'principal', 'senior', 'staff', 'lead', 'tech lead'
    ];
    
    const titleLower = title.toLowerCase();
    return engineeringKeywords.some(keyword => titleLower.includes(keyword));
  }

  extractCompanyFromUrl(url) {
    try {
      if (url.includes('greenhouse.io')) {
        return url.split('/').pop();
      } else if (url.includes('lever.co')) {
        return url.split('/').pop();
      } else if (url.includes('ashbyhq.com')) {
        return url.split('/').pop();
      }
      return 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  async saveJobsToDatabase(jobs) {
    if (jobs.length === 0) {
      console.log('📝 No jobs to save');
      return;
    }

    console.log(`💾 Saving ${jobs.length} jobs to database...`);
    
    try {
      for (const job of jobs) {
        // Generate URL hash for conflict resolution
        const crypto = await import('crypto');
        const urlHash = crypto.createHash('sha256').update(job.url).digest('hex');
        
        await pool.query(`
          INSERT INTO job_postings (
            job_title, company, location, department, url, url_hash,
            ats_type, source_url, status, discovered_at, last_seen_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW(), NOW())
          ON CONFLICT (url_hash) DO UPDATE SET
            last_seen_at = NOW(),
            status = 'active'
        `, [
          job.title,
          job.company,
          job.location,
          job.department,
          job.url,
          urlHash,
          job.atsType,
          job.source
        ]);
      }
      
      console.log(`✅ Successfully saved ${jobs.length} jobs to database`);
    } catch (error) {
      console.error(`❌ Error saving jobs to database: ${error.message}`);
      throw error;
    }
  }

  async scrapeAllPlatforms() {
    console.log('🎯 Starting comprehensive job scraping across all ATS platforms...');
    
    await this.initialize();
    
    let allJobs = [];
    
    try {
      // Scrape Greenhouse jobs
      for (const url of ACTIVE_COMPANY_PAGES.Greenhouse) {
        const jobs = await this.scrapeGreenhouseJobs(url);
        allJobs.push(...jobs);
        
        // Add delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // Scrape Lever jobs
      for (const url of ACTIVE_COMPANY_PAGES.Lever) {
        const jobs = await this.scrapeLeverJobs(url);
        allJobs.push(...jobs);
        
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // Scrape Ashby jobs
      for (const url of ACTIVE_COMPANY_PAGES.Ashby) {
        const jobs = await this.scrapeAshbyJobs(url);
        allJobs.push(...jobs);
        
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      console.log(`🎉 Total jobs scraped: ${allJobs.length}`);
      
      // Save all jobs to database
      await this.saveJobsToDatabase(allJobs);
      
      // Print summary by ATS type
      const summary = allJobs.reduce((acc, job) => {
        acc[job.atsType] = (acc[job.atsType] || 0) + 1;
        return acc;
      }, {});
      
      console.log('📊 Jobs by ATS Platform:');
      Object.entries(summary).forEach(([ats, count]) => {
        console.log(`  ${ats}: ${count} jobs`);
      });
      
    } catch (error) {
      console.error(`❌ Error during scraping: ${error.message}`);
      throw error;
    } finally {
      await this.cleanup();
    }
    
    return allJobs;
  }

  async cleanup() {
    console.log('🧹 Cleaning up browser resources...');
    
    if (this.context) {
      await this.context.close();
    }
    
    if (this.browser) {
      await this.browser.close();
    }
    
    await pool.end();
    console.log('✅ Cleanup completed');
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const scraper = new PlaywrightJobScraper();
  
  scraper.scrapeAllPlatforms()
    .then((jobs) => {
      console.log(`🎯 Scraping completed successfully! Found ${jobs.length} engineering jobs.`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Scraping failed:', error);
      process.exit(1);
    });
}

export default PlaywrightJobScraper; 