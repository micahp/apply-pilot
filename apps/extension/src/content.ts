import { detectATS, fillATSFields } from './utils/ats';
import { EnhancedATSFiller } from './utils/ats-enhanced';
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
    
    // Create enhanced ATS filler for better handling of complex scenarios
    const enhancedFiller = new EnhancedATSFiller();
    
    floatingPanel = initFloatingPanel({
      ats: {
        name: detectedATS.name,
        domain: new URL(currentUrl).hostname,
        selectors: detectedATS.selectors
      },
      onFillFields: async (profileData: Profile) => {
        console.log('[AutoApply] Starting enhanced field filling...');
        
        try {
          // Use enhanced filler that combines content script + Playwright
          const result = await enhancedFiller.fillATSFieldsEnhanced(detectedATS, profileData, {
            debugMode: true, // Enable detailed logging
            usePlaywrightForComplex: true,
            enableFileUploads: true,
            enableLocationAutocomplete: true,
            enableMultiStepFlow: true
          });
          
          console.log(`[AutoApply] Enhanced fill completed:`, result);
          console.log(`[AutoApply] Strategy used: ${result.usedPlaywright ? 'Hybrid/Playwright' : 'Content Script Only'}`);
          console.log(`[AutoApply] Fields filled: ${result.totalFieldsFilled} (CS: ${result.contentScriptFields}, PW: ${result.playwrightFields})`);
          
          if (result.warnings.length > 0) {
            console.warn('[AutoApply] Warnings:', result.warnings);
          }
          
          if (result.recommendations.length > 0) {
            console.info('[AutoApply] Recommendations:', result.recommendations);
          }
          
          if (result.platformSpecificInfo) {
            console.info('[AutoApply] Platform info:', result.platformSpecificInfo);
          }
          
          // Always return the full result for enhanced UI display
          return result;
          
        } catch (error: any) {
          console.error('[AutoApply] Enhanced fill critical error:', error);
          
          // Create fallback result with basic content script
          try {
            console.log('[AutoApply] Attempting fallback to basic content script...');
            const basicFieldsFilled = await fillATSFields(detectedATS, profileData);
            
            return {
              success: basicFieldsFilled > 0,
              totalFieldsFilled: basicFieldsFilled,
              contentScriptFields: basicFieldsFilled,
              playwrightFields: 0,
              errors: basicFieldsFilled === 0 ? ['Basic content script also failed'] : [],
              warnings: ['Enhanced filling failed, used basic fallback'],
              usedPlaywright: false,
              recommendations: [
                'Enhanced mode failed - check console for details',
                'Consider refreshing page and trying again'
              ],
              platformSpecificInfo: {
                platform: detectedATS.slug,
                detectedComplexFields: [],
                requiresManualSteps: false
              }
            };
          } catch (fallbackError: any) {
            console.error('[AutoApply] Fallback also failed:', fallbackError);
            
            return {
              success: false,
              totalFieldsFilled: 0,
              contentScriptFields: 0,
              playwrightFields: 0,
              errors: [error.message, fallbackError.message],
              warnings: ['Both enhanced and basic filling failed'],
              usedPlaywright: false,
              recommendations: [
                'All filling methods failed',
                'Check form is loaded and extension has latest updates',
                'Try manual form filling'
              ],
              platformSpecificInfo: {
                platform: detectedATS.slug,
                detectedComplexFields: [],
                requiresManualSteps: true
              }
            };
          }
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
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'fillFields' && message.profileData) {
        console.log('[AutoApply] Received fillFields message.');
        fillATSFields(detectedATS, message.profileData);
        sendResponse({ success: true });
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
    console.log(`[AutoApply] No supported ATS detected on this page: ${currentUrl}`);
    
    // Still listen for check messages and ATS_PAGE_LOADED even if no ATS is detected initially
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