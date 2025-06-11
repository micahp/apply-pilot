import { detectATS, fillATSFields } from './utils/ats';
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
    
    floatingPanel = initFloatingPanel({
      ats: {
        name: detectedATS.name,
        domain: new URL(currentUrl).hostname,
        selectors: detectedATS.selectors
      },
      onFillFields: (profileData: Profile) => {
        return fillATSFields(detectedATS, profileData);
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