import { detectATS, fillATSFields } from './utils/ats';
import { initFloatingPanel } from './ui/floatingPanel';
import { Profile } from './types/profile';

// Panel instance
let floatingPanel: HTMLElement | null = null;

/**
 * Initialize the content script
 */
function initialize(): void {
  console.log('[AutoApply] Content script initialized');
  
  // Check if we're on a supported ATS
  const currentUrl = window.location.href;
  const detectedATS = detectATS(currentUrl);
  
  if (detectedATS) {
    console.log(`[AutoApply] Detected ATS: ${detectedATS.name}`);
    
    // Initialize our floating panel
    floatingPanel = initFloatingPanel({
      ats: {
        name: detectedATS.name,
        domain: new URL(currentUrl).hostname,
        selectors: detectedATS.selectors
      },
      onFillFields: (profileData: Profile) => {
        fillATSFields(detectedATS, profileData);
      },
      onClose: () => {
        if (floatingPanel) {
          floatingPanel.remove();
          floatingPanel = null;
        }
      }
    });
    
    // Listen for messages from the extension popup or background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'fillFields' && message.profileData) {
        fillATSFields(detectedATS, message.profileData);
        sendResponse({ success: true });
      }
      
      if (message.action === 'checkATS') {
        sendResponse({ 
          detected: true, 
          ats: detectedATS.name 
        });
      }
    });
  } else {
    console.log('[AutoApply] No supported ATS detected on this page');
    
    // Still listen for check messages even if no ATS is detected
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'checkATS') {
        sendResponse({ 
          detected: false 
        });
      }
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