/**
 * ATS Platform Definitions and Detection
 * Centralized definitions for all supported ATS platforms
 */

/**
 * Represents an ATS (Applicant Tracking System) platform
 */
export interface ATS {
  name: string;
  domain: string;
  selectors: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: string;
    workExperience?: {
      container?: string;
      company?: string;
      title?: string;
      startDate?: string;
      endDate?: string;
      description?: string;
    };
    education?: {
      container?: string;
      institution?: string;
      degree?: string;
      field?: string;
      startDate?: string;
      endDate?: string;
    };
    skills?: string;
  };
}

/**
 * ATS Platform definition with enhanced metadata
 */
export interface ATSPlatform {
  name: string;
  slug: string; 
  description: string;
  urlPatterns: RegExp[];
  selectors: {
    [key: string]: string;
  };
}

/**
 * List of supported ATS platforms with their field selectors
 */
export const supportedPlatforms: ATSPlatform[] = [
  {
    name: 'Ashby',
    slug: 'ashby',
    description: 'Ashby application detected',
    urlPatterns: [
      /jobs\.ashbyhq\.com/
    ],
    selectors: {
      firstName: 'input[name*="first_name"], input[id*="first_name"]',
      lastName: 'input[name*="last_name"], input[id*="last_name"]',
      email: 'input[type="email"], input[name*="email"]',
      phone: 'input[type="tel"], input[name*="phone"]'
    }
  },
  {
    name: 'Workday',
    slug: 'workday',
    description: 'Workday application detected',
    urlPatterns: [
      /\.workday\.com/,
      /\/workday\//,
      /\.wd\d+\.myworkdayjobs\.com/,
      /myworkdayjobs\.com/
    ],
    selectors: {
      firstName: 'input[data-automation-id="firstName"], input[name="firstName"]',
      lastName: 'input[data-automation-id="lastName"], input[name="lastName"]',
      email: 'input[data-automation-id="email"], input[name="email"]',
      phone: 'input[data-automation-id="phone"], input[name="phoneNumber"]',
      address: 'input[data-automation-id="addressLine1"], input[name="address"]',
      city: 'input[data-automation-id="city"], input[name="city"]',
      state: 'select[data-automation-id="state"], select[name="state"]',
      zip: 'input[data-automation-id="postalCode"], input[name="zip"]',
      education: '.education-section, #education-section',
      resume: 'input[type="file"][data-automation-id*="resume"]',
      location: 'input[data-automation-id="location"], input[name="location"]'
    }
  },
  {
    name: 'Greenhouse',
    slug: 'greenhouse',
    description: 'Greenhouse application detected',
    urlPatterns: [
      /\.greenhouse\.io/,
      /\/greenhouse\//
    ],
    selectors: {
      firstName: 'input#first_name, input[name="first_name"]',
      lastName: 'input#last_name, input[name="last_name"]',
      email: 'input#email, input[name="email"]',
      phone: 'input#phone, input[name="phone"]',
      resume: 'input#resume, input[name="resume"]',
      coverLetter: 'textarea#cover_letter, textarea[name="cover_letter"]',
      linkedin: 'input[name="job_application[answers_attributes][0][text_value]"][aria-label*="LinkedIn"]',
      location: 'input[name="location"], input[placeholder*="location" i]'
    }
  },
  {
    name: 'Lever',
    slug: 'lever',
    description: 'Lever application detected',
    urlPatterns: [
      /jobs\.lever\.co/
    ],
    selectors: {
      firstName: 'input[name="name"]', // Lever uses full name in one field
      email: 'input[name="email"]',
      phone: 'input[name="phone"]',
      location: 'input[name="location"], input[name="current_location"], input[name="city"]',
      resume: 'input[name="resume"]',
      linkedin: 'input[name="urls[LinkedIn]"]',
      github: 'input[name="urls[GitHub]"]',
      website: 'input[name="urls[Portfolio]"]',
      coverLetter: 'textarea[name="comments"]'
    }
  },
  {
    name: 'SmartRecruiters',
    slug: 'smartrecruiters',
    description: 'SmartRecruiters application detected',
    urlPatterns: [
      /jobs\.smartrecruiters\.com/
    ],
    selectors: {
      firstName: 'input#firstName, input[name="firstName"]',
      lastName: 'input#lastName, input[name="lastName"]',
      email: 'input#email, input[name="email"]',
      phone: 'input#phoneNumber, input[name="phone"]',
      linkedin: 'input[placeholder*="LinkedIn"]',
      resume: 'input[type="file"][accept*="pdf"]'
    }
  },
  {
    name: 'Workable',
    slug: 'workable',
    description: 'Workable application detected',
    urlPatterns: [
      /\.workable\.com/,
      /apply\.workable\.com/
    ],
    selectors: {
      firstName: 'input[name*="first"], input[id*="first"]',
      lastName: 'input[name*="last"], input[id*="last"]',
      email: 'input[type="email"], input[name*="email"]',
      phone: 'input[type="tel"], input[name*="phone"]',
      resume: 'input[type="file"]'
    }
  },
  {
    name: 'iCIMS',
    slug: 'icims',
    description: 'iCIMS application detected',
    urlPatterns: [
      /\.icims\.com/,
      /careers\..*\.com\/jobs/,
      /jobs\..*\.com\/j\//,
      /recruiting\..*\.com\/icims/
    ],
    selectors: {
      firstName: 'input[name*="first"], input[id*="first"]',
      lastName: 'input[name*="last"], input[id*="last"]',
      email: 'input[type="email"], input[name*="email"]',
      phone: 'input[type="tel"], input[name*="phone"]',
      resume: 'input[type="file"]'
    }
  }
];

/**
 * Enhanced ATS detection with better reliability for SPAs and dynamic content
 */
export function detectATS(url: string): ATSPlatform | null {
  // Primary detection by URL patterns
  for (const platform of supportedPlatforms) {
    if (platform.urlPatterns.some(pattern => pattern.test(url))) {
      return platform;
    }
  }
  
  // Secondary detection by DOM analysis (for SPAs that change content)
  return detectATSByDOM();
}

/**
 * Detect ATS by analyzing DOM content when URL patterns fail
 */
function detectATSByDOM(): ATSPlatform | null {
  // Check for platform-specific DOM indicators
  const domIndicators = [
    {
      platform: 'workday',
      indicators: ['[data-automation-id]', '.workday', 'meta[name="workday"]']
    },
    {
      platform: 'greenhouse', 
      indicators: ['#greenhouse-application', '.greenhouse-application', '[id*="greenhouse"]']
    },
    {
      platform: 'lever',
      indicators: ['.lever-application', '[class*="lever"]', 'input[name="name"]']
    },
    {
      platform: 'ashby',
      indicators: ['[data-qa*="ashby"]', '.ashby-application', '[class*="ashby"]']
    }
  ];
  
  for (const { platform, indicators } of domIndicators) {
    if (indicators.some(selector => document.querySelector(selector))) {
      return supportedPlatforms.find(p => p.slug === platform) || null;
    }
  }
  
  return null;
}

/**
 * Detect native "Import from Resume" features on the current page
 */
export function detectResumeImportFeatures(): {
  hasNativeImport: boolean;
  importSelectors: string[];
  recommendations: string[];
} {
  const resumeImportSelectors = [
    // Common resume import patterns
    'button:has-text("Import from Resume")',
    'button:has-text("Upload Resume")',
    'a:has-text("Import Resume")',
    '[data-qa*="resume-import"]',
    '[data-testid*="resume-import"]',
    'input[type="file"][accept*="pdf"]',
    'input[type="file"][name*="resume"]',
    '.resume-upload',
    '.file-upload',
    '[id*="resume-upload"]',
    '[class*="resume-upload"]'
  ];
  
  const foundSelectors: string[] = [];
  const recommendations: string[] = [];
  
  for (const selector of resumeImportSelectors) {
    if (document.querySelector(selector)) {
      foundSelectors.push(selector);
    }
  }
  
  const hasNativeImport = foundSelectors.length > 0;
  
  if (hasNativeImport) {
    recommendations.push('Native resume import detected - consider using site feature instead of manual entry');
    recommendations.push('Check if the site can automatically populate fields from your resume');
  } else {
    recommendations.push('No native resume import detected - manual field filling recommended');
  }
  
  return {
    hasNativeImport,
    importSelectors: foundSelectors,
    recommendations
  };
}

/**
 * Check if current page is a job listing (vs application form)
 */
export function isJobListingPage(): boolean {
  const listingIndicators = [
    '.job-description',
    '.job-details',
    '[class*="job-listing"]',
    '[class*="job-posting"]',
    'button[class*="apply"]',
    'a[href*="apply"]'
  ];
  
  return listingIndicators.some(selector => document.querySelector(selector));
}

/**
 * Ashby-specific detection and interaction
 */
export function isAshbyJobListingPage(): boolean {
  // Look for Ashby job listing indicators
  const ashbyIndicators = [
    '[data-qa="job-posting"]',
    '.ashby-job-posting',
    'button[data-qa*="apply"]'
  ];
  
  return ashbyIndicators.some(selector => document.querySelector(selector));
}

/**
 * Click apply button on Ashby job listings
 */
export function clickAshbyApplyButton(): boolean {
  const applySelectors = [
    'button[data-qa*="apply"]',
    'a[data-qa*="apply"]',
    'button:has-text("Apply")',
    'a:has-text("Apply")',
    '.apply-button',
    '[class*="apply-btn"]'
  ];
  
  for (const selector of applySelectors) {
    const element = document.querySelector(selector) as HTMLElement;
    if (element && isElementVisible(element)) {
      element.click();
      return true;
    }
  }
  
  return false;
}

/**
 * Check if an element is visible and clickable
 */
function isElementVisible(element: HTMLElement): boolean {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         element.offsetWidth > 0 && 
         element.offsetHeight > 0;
} 