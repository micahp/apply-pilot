// Test script for the enhanced PDF parser
// This script will use the HTML resume, convert it to PDF, and test the parsing

import { parseResumeFile } from '../apps/extension/src/utils/enhancedPdfParser.ts';

export class ResumeTester {
  constructor() {
    this.results = {
      success: true,
      errors: [],
      warnings: [],
      sections: {},
      jobCount: 0
    };
  }

  /**
   * Runs all tests on the resume HTML
   * @returns {Object} Test results
   */
  runTests() {
    try {
      this.checkDocumentStructure();
      this.identifySections();
      this.analyzeWorkExperience();
      this.checkEducation();
      this.checkSkills();
      
      return this.results;
    } catch (error) {
      this.results.success = false;
      this.results.errors.push(`Fatal error: ${error.message}`);
      return this.results;
    }
  }

  /**
   * Validates basic document structure
   */
  checkDocumentStructure() {
    // Check for basic HTML structure
    if (!document.doctype) {
      this.results.warnings.push("Missing DOCTYPE declaration");
    }

    // Check for head and body
    if (!document.head) {
      this.results.errors.push("Missing <head> element");
      this.results.success = false;
    }

    if (!document.body) {
      this.results.errors.push("Missing <body> element");
      this.results.success = false;
    }

    // Check for name/title
    const h1Elements = document.querySelectorAll('h1');
    if (h1Elements.length === 0) {
      this.results.warnings.push("No H1 element found. Missing name/title?");
    } else if (h1Elements.length > 1) {
      this.results.warnings.push("Multiple H1 elements found. Resume should typically have one main heading.");
    }

    // Check for contact information
    const contactInfo = document.querySelector('.contact-info');
    if (!contactInfo) {
      this.results.warnings.push("No contact information section found");
    } else {
      // Check for essential contact elements
      const contactText = contactInfo.textContent.toLowerCase();
      if (!contactText.includes('@')) {
        this.results.warnings.push("No email address found in contact information");
      }
      if (!contactText.match(/\d{3}[-\s]?\d{3}[-\s]?\d{4}/)) {
        this.results.warnings.push("No phone number found in contact information");
      }
    }
  }

  /**
   * Identifies and validates resume sections
   */
  identifySections() {
    const sectionHeaders = document.querySelectorAll('.section-header');
    
    if (sectionHeaders.length === 0) {
      this.results.errors.push("No section headers found");
      this.results.success = false;
      return;
    }

    const foundSections = [];
    
    sectionHeaders.forEach(header => {
      const sectionName = header.textContent.trim().toLowerCase();
      foundSections.push(sectionName);
      
      // Store section element for further analysis
      this.results.sections[sectionName] = {
        element: header,
        content: this.getSectionContent(header)
      };
    });

    // Check for essential sections
    const essentialSections = ['work experience', 'experience', 'employment'];
    const hasWorkSection = essentialSections.some(section => 
      foundSections.some(found => found.includes(section))
    );
    
    if (!hasWorkSection) {
      this.results.warnings.push("No work experience section found");
    }
    
    if (!foundSections.some(section => section.includes('education'))) {
      this.results.warnings.push("No education section found");
    }
    
    if (!foundSections.some(section => section.includes('skill'))) {
      this.results.warnings.push("No skills section found");
    }
  }

  /**
   * Gets content following a section header until the next section
   * @param {Element} sectionHeader The section header element
   * @returns {Element[]} Array of elements in the section
   */
  getSectionContent(sectionHeader) {
    const content = [];
    let currentElement = sectionHeader.nextElementSibling;
    
    while (currentElement && !currentElement.classList.contains('section-header')) {
      content.push(currentElement);
      currentElement = currentElement.nextElementSibling;
    }
    
    return content;
  }

  /**
   * Analyzes work experience section
   */
  analyzeWorkExperience() {
    // Find work experience section
    const workSectionKey = Object.keys(this.results.sections).find(key => 
      key.includes('work') || key.includes('experience') || key.includes('employment')
    );
    
    if (!workSectionKey) return;
    
    const workSection = this.results.sections[workSectionKey];
    let jobCount = 0;
    
    // Look for company elements
    const companyElements = workSection.content.filter(el => {
      return el.querySelector('.company');
    });
    
    companyElements.forEach(jobEl => {
      jobCount++;
      
      // Check for proper job structure
      const company = jobEl.querySelector('.company');
      const jobTitle = jobEl.querySelector('.job-title');
      const date = jobEl.querySelector('.date');
      
      // Find bullet points (should be in a ul following the job)
      const nextEl = jobEl.nextElementSibling;
      const bulletPoints = nextEl && nextEl.tagName === 'UL' ? 
        nextEl.querySelectorAll('li') : [];
      
      if (!company) {
        this.results.warnings.push(`Job #${jobCount} missing company name`);
      }
      
      if (!jobTitle) {
        this.results.warnings.push(`Job #${jobCount} missing job title`);
      }
      
      if (!date) {
        this.results.warnings.push(`Job #${jobCount} missing dates`);
      }
      
      if (bulletPoints.length === 0) {
        this.results.warnings.push(`Job #${jobCount} has no bullet points describing responsibilities`);
      } else if (bulletPoints.length < 2) {
        this.results.warnings.push(`Job #${jobCount} has only ${bulletPoints.length} bullet point - consider adding more`);
      }
    });
    
    this.results.jobCount = jobCount;
    
    if (jobCount === 0) {
      this.results.errors.push("No jobs found in work experience section");
      this.results.success = false;
    } else if (jobCount < 2) {
      this.results.warnings.push("Only one job listed - consider adding more work experience if available");
    }
  }

  /**
   * Checks education section
   */
  checkEducation() {
    const eduSectionKey = Object.keys(this.results.sections).find(key => 
      key.includes('education')
    );
    
    if (!eduSectionKey) return;
    
    const eduSection = this.results.sections[eduSectionKey];
    const eduElements = eduSection.content.filter(el => {
      return el.querySelector('.company') || el.querySelector('.job-title');
    });
    
    if (eduElements.length === 0) {
      this.results.warnings.push("Education section exists but no educational institutions found");
    }
  }

  /**
   * Checks skills section
   */
  checkSkills() {
    const skillsSectionKey = Object.keys(this.results.sections).find(key => 
      key.includes('skill')
    );
    
    if (!skillsSectionKey) return;
    
    const skillsSection = this.results.sections[skillsSectionKey];
    let skillsText = '';
    
    skillsSection.content.forEach(el => {
      skillsText += el.textContent;
    });
    
    // Look for common technical skills in a software engineering resume
    const commonSkills = [
      'javascript', 'html', 'css', 'react', 'node', 'python', 
      'java', 'git', 'sql', 'database', 'aws', 'cloud'
    ];
    
    const foundSkills = commonSkills.filter(skill => 
      skillsText.toLowerCase().includes(skill)
    );
    
    if (foundSkills.length < 5) {
      this.results.warnings.push(`Skills section may be lacking detail. Only found ${foundSkills.length} common technical skills.`);
    }
  }
}

// Export for use in browser
if (typeof window !== 'undefined') {
  window.ResumeTester = ResumeTester;
}

// Export for use with Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ResumeTester;
} 