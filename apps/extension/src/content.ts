import { detectATS, detectResumeImportFeatures } from './utils/ats-platforms';
import { ComprehensiveFormAutomation, type UserProfile, type AutomationResult } from './utils/comprehensive-form-automation';
import { initFloatingPanel } from './ui/floatingPanel';
import { Profile } from './types/profile';

// Panel instance
let floatingPanel: HTMLElement | null = null;
// Global automation system - initialize immediately
let globalAutomationSystem: ComprehensiveFormAutomation = new ComprehensiveFormAutomation();

console.log('[AutoApply] Setting up global AutoApplyExtension API...');

// Expose extension API globally for testing
(window as any).AutoApplyExtension = {
  getAutomationSystem: () => {
    console.log('[AutoApply] getAutomationSystem called, returning:', !!globalAutomationSystem);
    return globalAutomationSystem;
  },
  getProfile: async () => {
    console.log('[AutoApply] getProfile called, checking storage...');
    if (chrome?.storage?.sync) {
      try {
        const result = await chrome.storage.sync.get(['profile']);
        console.log('[AutoApply] Storage result:', !!result.profile);
        return result.profile || null;
      } catch (error) {
        console.error('Failed to load profile from storage:', error);
        return null;
      }
    }
    // Test environment fallback
    console.log('[AutoApply] Using test environment fallback profile');
    return {
      personal: {
        firstName: 'John',
        lastName: 'Doe', 
        email: 'john.doe@example.com',
        phone: '555-123-4567',
        city: 'New York',
        state: 'NY',
        zipCode: '10001'
      },
      documents: {
        coverLetter: 'I am very interested in this position.'
      }
    };
  },
  fillForm: async (profileData?: Profile) => {
    // Automation system is always initialized now
    console.log('[AutoApply] Starting fillForm with automation system');

    const profile = profileData || await (window as any).AutoApplyExtension.getProfile();
    if (!profile) {
      throw new Error('No profile data available');
    }

    // Convert to UserProfile format
    const userProfile: UserProfile = {
      personal: {
        firstName: profile.personal?.firstName || '',
        lastName: profile.personal?.lastName || '',
        email: profile.personal?.email || '',
        phone: profile.personal?.phone || '',
        address: profile.personal?.address,
        city: profile.personal?.city,
        state: profile.personal?.state,
        zipCode: profile.personal?.zipCode,
        country: profile.personal?.country,
        linkedIn: profile.personal?.linkedIn,
        github: profile.personal?.github,
        website: profile.personal?.website,
        twitter: (profile.personal as any)?.twitter,
      },
      documents: {
        coverLetterText: profile.documents?.coverLetter,
      },
      preferences: {
        currentLocation: profile.personal?.city,
        desiredSalary: (profile as any).preferences?.desiredSalary,
        availableStartDate: (profile as any).preferences?.availableStartDate,
        usWorkAuth: (profile as any).preferences?.usWorkAuth,
        sponsorshipRequired: (profile as any).preferences?.sponsorshipRequired,
      },
      workExperience: profile.workExperience?.map((exp: any) => ({
        company: exp.company || '',
        title: exp.title || '',
        startDate: exp.startDate || '',
        endDate: exp.endDate || undefined,
        currentlyWorkHere: exp.current || exp.currentlyWorkHere || false,
        description: exp.description || '',
        location: exp.location || '',
      })) || [],
      education: profile.education?.map((edu: any) => ({
        institution: edu.institution || '',
        degree: edu.degree || '',
        fieldOfStudy: edu.fieldOfStudy || '',
        startDate: edu.startDate || '',
        endDate: edu.endDate || undefined,
        gpa: edu.gpa || '',
      })) || [],
      eeo: profile.eeo ? {
        gender: (profile.eeo as any).gender || '',
        ethnicity: (profile.eeo as any).ethnicity || '',
        veteranStatus: (profile.eeo as any).veteranStatus || '',
        disabilityStatus: (profile.eeo as any).disabilityStatus || '',
      } : undefined,
    };

    const detectedATS = detectATS(window.location.href);
    const fields = await globalAutomationSystem.discoverAllFormElements(detectedATS);
    return await globalAutomationSystem.fillFormWithProfile(userProfile, fields);
  }
};

console.log('[AutoApply] AutoApplyExtension API configured:', {
  hasGetAutomationSystem: typeof (window as any).AutoApplyExtension.getAutomationSystem === 'function',
  hasGetProfile: typeof (window as any).AutoApplyExtension.getProfile === 'function',
  hasFillForm: typeof (window as any).AutoApplyExtension.fillForm === 'function',
  automationSystemInitialized: !!globalAutomationSystem
});

/**
 * Initialize the content script
 */
function initialize(): void {
  console.log('[AutoApply] Content script initializing...');
  
  const currentUrl = window.location.href;
  console.log(`[AutoApply] Current URL: ${currentUrl}`);

  const detectedATS = detectATS(currentUrl);
  console.log(`[AutoApply] detectATS result: ${detectedATS ? detectedATS.name : 'null'}`);
  
  if (detectedATS) {
    console.log(`[AutoApply] Detected ATS: ${detectedATS.name}. Initializing panel...`);
    
    // Check for native resume import features
    const resumeImport = detectResumeImportFeatures();
    if (resumeImport.hasNativeImport) {
      console.log('Native resume import detected:', resumeImport.importSelectors);
      console.log('Recommendations:', resumeImport.recommendations);
    }
    
    // Automation system already initialized at module level
    console.log('[AutoApply] Using pre-initialized automation system');
    
    floatingPanel = initFloatingPanel({
      ats: {
        name: detectedATS.name,
        domain: new URL(currentUrl).hostname,
        selectors: detectedATS.selectors
      },
      onFillFields: async (profileData: Profile) => {
        console.log('[AutoApply] Starting enhanced field filling...');
        
        try {
          // Use the global fillForm method
          return await (window as any).AutoApplyExtension.fillForm(profileData);
          
        } catch (error: any) {
          console.error('[AutoApply] Enhanced fill critical error:', error);
          
          // Create fallback result
          console.log('[AutoApply] Automation failed, returning error result');
          return {
            success: false,
            pageContext: { 
              pageType: 'application-form' as const,
              ats: detectedATS,
              url: window.location.href,
              title: document.title,
              hasProtection: false,
              captchas: []
            },
            fieldsDiscovered: 0,
            fieldsAttempted: 0,
            fieldsFilled: 0,
            captchasSolved: 0,
            errors: [error.message],
            warnings: ['Primary automation failed'],
            nextActions: [
              'Check console for details',
              'Consider refreshing page and trying again'
            ],
            timeTaken: 0
          };
        }
      },
      onClose: () => {
        if (floatingPanel) {
          console.log('[AutoApply] Closing and removing floating panel.');
          floatingPanel.remove();
          floatingPanel = null;
        }
      }
    });

    if (document.getElementById('autoapply-panel')) {
      console.log('[AutoApply] Floating panel element FOUND in DOM immediately after init.');
    } else {
      console.error('[AutoApply] CRITICAL: Floating panel element NOT FOUND in DOM immediately after init.');
    }
    
    // Listen for messages from the extension popup or background
    if (chrome?.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'fillFields' && message.profileData) {
        console.log('[AutoApply] Received fillFields message.');
        // Use the global fillForm method
        (window as any).AutoApplyExtension.fillForm(message.profileData)
          .then((result: AutomationResult) => {
            sendResponse({ success: result.success, result });
          })
          .catch((error: any) => {
            sendResponse({ success: false, error: error.message });
          });
        return true; // Indicates that the response will be sent asynchronously
      }
      
      if (message.action === 'checkATS') {
        console.log('[AutoApply] Received checkATS message.');
        sendResponse({ 
          detected: true, 
          ats: detectedATS.name 
        });
        return true;
      }

      if (message.type === 'ATS_PAGE_LOADED') {
        console.log('[AutoApply Content Script] Received ATS_PAGE_LOADED message from background script.');
        sendResponse({ success: true, message: 'ATS_PAGE_LOADED received' });
        return true;
      }

      if (message.action === 'getJobInfo') {
        console.log('[AutoApply] Received getJobInfo message.');
        const jobInfo = {
          title: '',
          company: '',
          description: '',
        };

        // Try to extract job title
        const titleEl = document.querySelector('h1, h2, [class*="job-title"], [class*="posting-title"], [data-qa="job-title"]');
        if (titleEl?.textContent) jobInfo.title = titleEl.textContent.trim();

        // Try to extract company
        const companyEl = document.querySelector('[class*="company"], [class*="employer"], [data-qa="company"], [itemprop="hiringOrganization"]');
        if (companyEl?.textContent) jobInfo.company = companyEl.textContent.trim();

        // Try to extract job description
        const descEl = document.querySelector('[class*="job-description"], [class*="posting-description"], [class*="description"], [data-qa="job-description"], #job-description');
        if (descEl?.textContent) jobInfo.description = descEl.textContent.trim().slice(0, 3000);

        sendResponse(jobInfo);
        return true;
      }
      });
    } else {
      console.log('[AutoApply] Chrome runtime API not available - running in test mode');
    }
  } else {
    console.log(`[AutoApply] No supported ATS detected on this page: ${currentUrl}`);
    
    // Automation system already initialized at module level
    console.log('[AutoApply] Automation system available for non-ATS pages');
    
    // Still listen for check messages and ATS_PAGE_LOADED even if no ATS is detected initially
    if (chrome?.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'checkATS') {
        console.log('[AutoApply] Received checkATS message (no ATS detected).');
        sendResponse({ 
          detected: false 
        });
        return true;
      }

      if (message.type === 'ATS_PAGE_LOADED') {
        console.log('[AutoApply Content Script] Received ATS_PAGE_LOADED (no ATS initially detected). Attempting re-initialization.');
        sendResponse({ success: true, message: 'ATS_PAGE_LOADED received, consider page refresh or manual re-check for ATS.' });
        return true;
      }
      });
    } else {
      console.log('[AutoApply] Chrome runtime API not available - running in test mode (no ATS detected)');
    }
  }
}

// Run our initialization when the DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Also listen for navigation events in SPAs
let lastUrl = window.location.href;
new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    
    // Remove existing panel if present
    if (floatingPanel) {
      floatingPanel.remove();
      floatingPanel = null;
    }
    
    // Re-initialize
    setTimeout(initialize, 1000); // Delay slightly to let the page render
  }
}).observe(document, { subtree: true, childList: true }); 