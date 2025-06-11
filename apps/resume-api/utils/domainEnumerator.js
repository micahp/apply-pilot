import pg from 'pg';
import got from 'got';
import pLimit from 'p-limit';
// crypto import removed as it's unused in this file.

// Database pool setup
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Constants for base domains and paths
const MYWORKDAYJOBS_BASE_DOMAIN = 'myworkdayjobs.com';
const ICIMS_BASE_DOMAIN = 'icims.com';
const COMMON_PROBE_PATHS = ['/', '/careers', '/jobs', '/job-search']; // A few common paths
const CONCURRENCY = 10; // Concurrency for probing
const REQUEST_TIMEOUT = 8000; // ms

const WORKDAY_PREFIXES = [
  'wd1', 'wd2', 'wd3', 'wd5', // Common technical prefixes
  'accenture', 'avanade', 'boeing', 'centric', 'cognizant', 
  'deloitte', 'ey', 'ibm', 'kpmg', 'pwc', 'capgemini', 
  'infosys', 'tata', 'wipro', 'target', 'walmart', 
  'amazon', 'google', 'microsoft', 'apple', 'facebook', // Large companies
  // Add more known company names or common words
];

const ICIMS_PREFIXES = [
  'careers', 'jobs', 'uscareers', 'canadacareers', 'apaccareers', 'emeacareers', // Common functional prefixes
  'hiltongrandvacations', 'primehealthcare', 'trimas', 'childrensnational', 
  'spectrum', 'northwell', 'rwjbarnabas', 'allegiantair', 'chs', // Known company names using iCIMS
  'adt', 'allieduniversal', 'asurion', 'banfield', 'bloominbrands',
  // Add more known company names or common words
];

const POTENTIAL_COMPANY_SUBDOMAINS = [ // Generic list that might be tried for both
  'careers', 'jobs', 'hr', 'recruiting', 'talent',
  'en', 'us', 'uk', 'ca', 'au', 'de', 'fr', 'nl', 'sg', 'in', // Common geo/lang prefixes
  // Popular company names (can be extensive)
  'abbott', 'abbvie', 'accenture', 'activisionblizzard', 'adidas', 'adobe', 
  'adp', 'airbnb', 'amd', 'apple', 'appliedmaterials', 'att', 'autodesk', 
  'bankofamerica', 'bestbuy', 'boeing', 'booking', 'bristolmyerssquibb', 
  'broadcom', 'capitalone', 'caterpillar', 'charleschwab', 'chevron', 
  'cigna', 'cisco', 'citigroup', 'cloudflare', 'cocacola', 'cognizant', 
  'comcast', 'costco', 'cvs', 'dell', 'delta', 'disney', 'docusign', 
  'ebay', 'equinix', 'ericsson', 'ey', 'facebook', 'fedex', 'fidelity', 
  'ford', 'gamestop', 'ge', 'generalmotors', 'gilead', 'goldmansachs', 
  'google', 'homedepot', 'honeywell', 'hp', 'ibm', 'intel', 'intuitive', 
  'jnj', 'jpmorganchase', 'linkedin', 'lockheedmartin', 'lowes', 'lyft', 
  'marriott', 'mastercard', 'mcdonalds', 'medtronic', 'merck', 'meta', 
  'microsoft', 'moderna', 'morganstanley', 'netflix', 'nike', 'nvidia', 
  'oracle', 'paypal', 'pepsico', 'pfizer', 'philips', 'pinterest', 
  'qualcomm', 'rakuten', 'raytheon', 'salesforce', 'samsung', 'sap', 
  'servicenow', 'shopify', 'sony', 'spotify', 'starbucks', 'stripe', 
  'target', 'tesla', 'texasinstruments', 'tiktok', 'toyota', 'twitter', 
  'uber', 'ups', 'verizon', 'visa', 'vmware', 'walmart', 'wellsfargo', 
  'workday', 'zoom'
  // This list can become very large and should be curated or generated from other sources for better results.
];

async function probeDomain(domain, path) {
  const url = `https://${domain}${path}`;
  const options = {
    timeout: { request: REQUEST_TIMEOUT },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'
    },
    retry: { limit: 0 }, // No retries for probing to fail faster on non-responsive domains
    followRedirect: true,
    maxRedirects: 5,
    throwHttpErrors: false // Important to handle non-2xx status codes in the response object instead of catch
  };

  try {
    // console.log(`Probing ${url}...`); // Optional: for verbose logging during development
    const response = await got(url, options);
    if (response.statusCode === 200) {
      return response.body;
    } else {
      // Log non-200 responses as they are not successful probes for our purpose
      if (response.statusCode) { // Check if response.statusCode is defined
        console.log(`Probe to ${url} returned status ${response.statusCode}`);
      } else {
        // This case might happen if the error is not an HTTP error but something else (e.g. connection refused before HTTP status)
        console.log(`Probe to ${url} failed without a status code.`);
      }
      return null;
    }
  } catch (error) {
    // Log errors like timeouts, DNS errors, connection refused, etc.
    // Taking the first line of the error message for brevity.
    console.log(`Error probing ${url}: ${error.message.split('\n')[0]}`);
    return null;
  }
}

function isWorkdayPage(htmlContent, domain) {
  if (!htmlContent || htmlContent.length < 200) return false;

  const lowerContent = htmlContent.toLowerCase(); // For case-insensitive checks
  const lowerDomain = domain.toLowerCase();

  if (lowerDomain.endsWith('myworkdayjobs.com')) return true;

  // Check for various Workday subdomains/patterns in content
  if (lowerContent.includes('myworkdayjobs.com')) return true; // General catch-all
  if (lowerContent.includes('wdapp.myworkdayjobs.com')) return true;
  if (lowerContent.includes('static.myworkdayjobs.com')) return true;
  if (lowerContent.includes('wd1.myworkdayjobs.com') || 
      lowerContent.includes('wd2.myworkdayjobs.com') ||
      lowerContent.includes('wd3.myworkdayjobs.com') ||
      lowerContent.includes('wd5.myworkdayjobs.com')) return true;
  
  // Check for "workday" string, often in titles or specific attributes
  if (lowerContent.includes(' workday')) return true; // Note the leading space to avoid "networkday" type matches
  if (lowerContent.match(/<title[^>]*>.*workday.*<\/title>/i)) return true; // Workday in title
  if (lowerContent.includes('data-automation-id="workdaybrand"')) return true; // Specific element attribute

  return false;
}

function isICIMSPage(htmlContent, domain) {
  if (!htmlContent || htmlContent.length < 200) return false;

  const lowerContent = htmlContent.toLowerCase(); // For case-insensitive checks
  const lowerDomain = domain.toLowerCase();

  if (lowerDomain.endsWith('icims.com')) return true;

  // Check for various iCIMS patterns in content
  if (lowerContent.includes('icims.com')) return true; // General catch-all
  if (lowerContent.includes('cdn.icims.com')) return true;
  if (lowerContent.includes('meta name="generator" content="icims')) return true; // Checks for iCIMS generator meta tag (often has version too)
  if (lowerContent.includes('icims talent platform')) return true;
  if (lowerContent.includes('data-icims-id')) return true; // Common attribute for iCIMS elements
  if (lowerContent.includes('class="icims')) return true; // e.g. class="iCIMS_JobContent", class="iCIMS_Header"
  if (lowerContent.match(/<title[^>]*>.*icims.*<\/title>/i)) return true; // iCIMS in title
  if (lowerContent.includes('icims.applyparams.meta')) return true; // A common script variable/object

  return false;
}

async function addAtsHost({ domain, atsType }) {
  let company = domain; // Default company to the domain itself
  const lowerDomain = domain.toLowerCase();

  // Improved company name extraction logic
  if (lowerDomain.endsWith('.' + MYWORKDAYJOBS_BASE_DOMAIN) || lowerDomain.endsWith('.' + ICIMS_BASE_DOMAIN)) {
    const base = lowerDomain.endsWith('.' + MYWORKDAYJOBS_BASE_DOMAIN) ? MYWORKDAYJOBS_BASE_DOMAIN : ICIMS_BASE_DOMAIN;
    const prefix = lowerDomain.substring(0, lowerDomain.length - (base.length + 1)); // Get "subdomain" or "www.subdomain"
    
    const parts = prefix.split('.');
    if (parts.length > 0) {
      company = parts[parts.length - 1]; // Takes the last part of the prefix (e.g., 'company' from 'www.company')
      if (company === 'www' && parts.length > 1) { // If 'www' is the last part, take the one before it
        company = parts[parts.length - 2];
      }
    }
  }
  // Ensure company name isn't excessively long (e.g., if domain was used as fallback)
  // company = company.substring(0, 255); // Assuming a VARCHAR(255) limit, adjust if needed

  try {
    // Assuming 'discovered_at' column exists and 'updated_at' is auto-managed or not used here.
    const { rowCount } = await pool.query(
      `INSERT INTO ats_hosts (company, domain, ats_type, is_active, discovered_at)
       VALUES ($1, $2, $3, true, NOW())
       ON CONFLICT (domain) DO NOTHING`,
      [company, domain, atsType]
    );

    if (rowCount > 0) {
      console.log(`Successfully added new ATS host: ${domain} (Type: ${atsType}, Company: ${company})`);
    } else {
      // This means the domain already existed, or some other conflict occurred.
      // console.log(`ATS host already exists or conflict (no new row added): ${domain}`);
    }
  } catch (error) {
    console.error(`Error adding ATS host ${domain} to database: ${error.message}`);
  }
}

/**
 * Main function for the domain enumeration process.
 * This function will eventually contain the core logic for discovering
 * and verifying ATS subdomains.
 */
async function runDomainEnumeration() {
  console.log('Domain enumeration process started...');
  const limit = pLimit(CONCURRENCY);
  const candidateDomains = new Set();

  // 1. Generate candidate domains from WORKDAY_PREFIXES
  WORKDAY_PREFIXES.forEach(prefix => {
    candidateDomains.add(`${prefix}.${MYWORKDAYJOBS_BASE_DOMAIN}`);
  });

  // 2. Generate candidate domains from ICIMS_PREFIXES
  ICIMS_PREFIXES.forEach(prefix => {
    candidateDomains.add(`${prefix}.${ICIMS_BASE_DOMAIN}`);
  });

  // 3. Generate candidate domains from POTENTIAL_COMPANY_SUBDOMAINS for both Workday and iCIMS
  POTENTIAL_COMPANY_SUBDOMAINS.forEach(subdomain => {
    candidateDomains.add(`${subdomain}.${MYWORKDAYJOBS_BASE_DOMAIN}`);
    candidateDomains.add(`${subdomain}.${ICIMS_BASE_DOMAIN}`);
  });

  console.log(`Generated ${candidateDomains.size} unique candidate domains to probe.`);

  const tasks = Array.from(candidateDomains).map(domain => {
    return limit(async () => {
      // console.log(`Processing domain: ${domain}`); // Verbose
      for (const path of COMMON_PROBE_PATHS) {
        const htmlContent = await probeDomain(domain, path);
        if (htmlContent) {
          let atsType = null;
          if (isWorkdayPage(htmlContent, domain)) {
            atsType = 'Workday';
          } else if (isICIMSPage(htmlContent, domain)) {
            atsType = 'iCIMS';
          }

          if (atsType) {
            // console.log(`Fingerprinted ${domain} as ${atsType} from path ${path}`); // Verbose
            await addAtsHost({ domain, atsType });
            return; // Found, no need to check other paths for this domain
          }
        }
      }
      // console.log(`Domain ${domain} did not match any ATS fingerprint on common paths.`); // Verbose
    });
  });

  // Wait for all probing tasks to settle
  const results = await Promise.allSettled(tasks);

  // Optional: Log any rejections from the tasks themselves (though our tasks are designed to handle errors internally)
  results.forEach(result => {
    if (result.status === 'rejected') {
      console.error(`A probing task failed: ${result.reason}`);
    }
  });

  console.log('Domain enumeration process finished.');
  await pool.end();
}

// Export for use in other modules
export { runDomainEnumeration };

// If invoked directly from CLI: `node utils/domainEnumerator.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  runDomainEnumeration()
    .then(() => {
      console.log('Domain enumeration script finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error during domain enumeration:', err);
      process.exit(1);
    });
}
