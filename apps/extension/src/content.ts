import { detectATS, detectResumeImportFeatures } from './utils/ats-platforms';
import { ComprehensiveFormAutomation, type UserProfile, type AutomationResult } from './utils/comprehensive-form-automation';
import { initFloatingPanel } from './ui/floatingPanel';
import { Profile } from './types/profile';

// Panel instance
let floatingPanel: HTMLElement | null = null;

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
    
    // Create comprehensive form automation for bot-resistant filling
    const automationSystem = new ComprehensiveFormAutomation();
    
    floatingPanel = initFloatingPanel({
      ats: {
        name: detectedATS.name,
        domain: new URL(currentUrl).hostname,
        selectors: detectedATS.selectors
      },
      onFillFields: async (profileData: Profile) => {
        console.log('[AutoApply] Starting enhanced field filling...');
        
        try {
          // Convert Profile to UserProfile format
          const userProfile: UserProfile = {
            personal: {
              firstName: profileData.personal?.firstName || '',
              lastName: profileData.personal?.lastName || '',
              email: profileData.personal?.email || '',
              phone: profileData.personal?.phone || '',
              address: profileData.personal?.address,
              city: profileData.personal?.city,
              state: profileData.personal?.state,
              zipCode: profileData.personal?.zipCode,
              linkedIn: profileData.personal?.linkedIn,
              github: profileData.personal?.github,
              website: profileData.personal?.website,
            },
                         documents: {
               coverLetterText: profileData.documents?.coverLetter,
             },
            preferences: {
              currentLocation: profileData.personal?.city,
            }
          };

          // Use comprehensive automation system
          const pageContext = await automationSystem.analyzePageContext();
          const fields = await automationSystem.discoverAllFormElements(detectedATS);
          const result = await automationSystem.fillFormWithProfile(userProfile, fields);
          
          console.log(`[AutoApply] Form automation completed:`, result);
          console.log(`[AutoApply] Fields filled: ${result.fieldsFilled}`);
          console.log(`[AutoApply] Success: ${result.success}`);
          
          if (result.warnings.length > 0) {
            console.warn('[AutoApply] Warnings:', result.warnings);
          }
          
          if (result.nextActions.length > 0) {
            console.info('[AutoApply] Next actions:', result.nextActions);
          }
          
          // Always return the full result for enhanced UI display
          return result;
          
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
        // TODO: Implement fillFields message handler with comprehensive automation
        console.warn('[AutoApply] fillFields message received but not yet implemented with new system');
        sendResponse({ success: false, error: 'Not implemented with new automation system' });
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
      // Default response for unhandled messages
      // sendResponse({ success: false, error: 'Unknown message' }); 
      // return true; // Keep channel open for other listeners if any
      });
    } else {
      console.log('[AutoApply] Chrome runtime API not available - running in test mode');
    }
  } else {
    console.log(`[AutoApply] No supported ATS detected on this page: ${currentUrl}`);
    
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
        // It's crucial to remove existing listeners before re-adding, to prevent duplicates if initialize is called multiple times.
        // However, given initialize() structure, direct re-call might lead to nested listeners.
        // A safer pattern would be to have a separate function for setting up listeners only once.
        // For now, let's rely on the page reload or a more sophisticated state management if re-init is frequent.
        // initialize(); // This could cause issues with duplicate listeners.
        sendResponse({ success: true, message: 'ATS_PAGE_LOADED received, consider page refresh or manual re-check for ATS.' });
        return true;
      }
      // Default response for unhandled messages
      // sendResponse({ success: false, error: 'Unknown message' });
      // return true;
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