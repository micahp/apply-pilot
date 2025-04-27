import { Profile } from '../types/profile';

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
 * ATS Platform definition
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
const supportedPlatforms: ATSPlatform[] = [
  {
    name: 'Workday',
    slug: 'workday',
    description: 'Workday application detected',
    urlPatterns: [
      /\.workday\.com/,
      /\/workday\//
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
      education: '.education-section, #education-section'
    }
  },
  {
    name: 'Greenhouse',
    slug: 'greenhouse',
    description: 'Greenhouse application detected',
    urlPatterns: [
      /boards\.greenhouse\.io/,
      /\/greenhouse\//
    ],
    selectors: {
      firstName: 'input#first_name, input[name="first_name"]',
      lastName: 'input#last_name, input[name="last_name"]',
      email: 'input#email, input[name="email"]',
      phone: 'input#phone, input[name="phone"]',
      resume: 'input#resume, input[name="resume"]',
      coverLetter: 'textarea#cover_letter, textarea[name="cover_letter"]',
      linkedin: 'input[name="job_application[answers_attributes][0][text_value]"][aria-label*="LinkedIn"]'
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
      linkedin: 'input[placeholder*="LinkedIn"]'
    }
  }
];

/**
 * Detect which ATS platform is being used on the current page
 */
export function detectATS(url: string): ATSPlatform | null {
  for (const platform of supportedPlatforms) {
    if (platform.urlPatterns.some(pattern => pattern.test(url))) {
      return platform;
    }
  }
  return null;
}

/**
 * Fill fields on the current ATS platform with user profile data
 */
export function fillATSFields(
  platform: ATSPlatform,
  profile: Profile
): number {
  let filledCount = 0;
  
  try {
    // Personal information
    if (profile.personal) {
      if (platform.selectors.firstName && profile.personal.firstName) {
        fillInputField(platform.selectors.firstName, profile.personal.firstName);
        filledCount++;
      }
      
      if (platform.selectors.lastName && profile.personal.lastName) {
        fillInputField(platform.selectors.lastName, profile.personal.lastName);
        filledCount++;
      }
      
      // Special case for Lever which uses full name
      if (platform.slug === 'lever' && platform.selectors.firstName && 
          profile.personal.firstName && profile.personal.lastName) {
        fillInputField(
          platform.selectors.firstName, 
          `${profile.personal.firstName} ${profile.personal.lastName}`
        );
        filledCount++;
      }
      
      if (platform.selectors.email && profile.personal.email) {
        fillInputField(platform.selectors.email, profile.personal.email);
        filledCount++;
      }
      
      if (platform.selectors.phone && profile.personal.phone) {
        fillInputField(platform.selectors.phone, profile.personal.phone);
        filledCount++;
      }
    }
    
    // LinkedIn URL if available in profile and platform supports it
    if (platform.selectors.linkedin && profile.personal?.linkedIn) {
      fillInputField(platform.selectors.linkedin, profile.personal.linkedIn);
      filledCount++;
    }
    
    // GitHub URL if available in profile and platform supports it
    if (platform.selectors.github && profile.personal?.github) {
      fillInputField(platform.selectors.github, profile.personal.github);
      filledCount++;
    }
    
    // Portfolio/website URL if available in profile and platform supports it
    if (platform.selectors.website && profile.personal?.website) {
      fillInputField(platform.selectors.website, profile.personal.website);
      filledCount++;
    }
    
    // Cover letter if applicable
    if (platform.selectors.coverLetter && profile.documents?.coverLetter) {
      fillInputField(platform.selectors.coverLetter, profile.documents.coverLetter);
      filledCount++;
    }
    
    // TODO: Handle more complex fields like education, experience, skills
    // These usually require more complex interactions specific to each ATS
    
    console.log(`[AutoApply] Filled ${filledCount} fields on ${platform.name}`);
    return filledCount;
  } catch (error) {
    console.error(`[AutoApply] Error filling fields:`, error);
    return filledCount;
  }
}

/**
 * Helper function to fill an input field
 */
function fillInputField(selector: string, value: string): boolean {
  const elements = document.querySelectorAll(selector);
  if (!elements || elements.length === 0) return false;
  
  let filled = false;
  
  elements.forEach(element => {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      // Set both the value property and attribute
      element.value = value;
      element.setAttribute('value', value);
      
      // Trigger events to ensure the application recognizes the change
      triggerInputEvents(element);
      filled = true;
    } else if (element instanceof HTMLSelectElement) {
      // For select elements, find the option that matches the value
      const options = Array.from(element.options);
      const option = options.find(opt => 
        opt.value.toLowerCase() === value.toLowerCase() || 
        opt.text.toLowerCase() === value.toLowerCase()
      );
      
      if (option) {
        element.value = option.value;
        triggerInputEvents(element);
        filled = true;
      }
    }
  });
  
  return filled;
}

/**
 * Trigger necessary events for form validation
 */
function triggerInputEvents(element: HTMLElement): void {
  ['input', 'change', 'blur'].forEach(eventType => {
    const event = new Event(eventType, { bubbles: true });
    element.dispatchEvent(event);
  });
} 