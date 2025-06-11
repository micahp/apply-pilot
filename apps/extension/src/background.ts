// Handle API requests and manage state
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_FIELD_MAP') {
    fetchFieldMap(message.ats, message.version)
      .then(sendResponse)
      .catch(error => {
        console.error('AutoApply: Error fetching field map', error);
        sendResponse({ error: error.message });
      });
    return true; // Will respond asynchronously
  } else if (message.action === 'openOptionsPage') {
    chrome.runtime.openOptionsPage();
    sendResponse({ status: 'Options page opening process initiated.' });
    return false; // Synchronous response
  }
});

// Fetch field map from our API
async function fetchFieldMap(ats: string, version: string) {
  const apiUrl = `https://api.autoapply.dev/v1/ats-maps/${ats}/${version}`;
  
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${await getAuthToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('AutoApply: Error fetching field map', error);
    throw error;
  }
}

// Get the current auth token
async function getAuthToken(): Promise<string> {
  const { token } = await chrome.storage.session.get('token');
  return token || '';
}

// Keep track of tabs we've recently attempted to message for ATS_PAGE_LOADED
const recentlyAttemptedTabsForAtsPageLoaded = new Set<number>();

// Listen for tab updates to track application progress
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if this is a supported ATS URL
    const supportedAts = [
      'workday.com',
      'greenhouse.io',
      'lever.co',
      'ashbyhq.com',
      'icims.com',
      'workable.com'
    ];
    
    const isOnSupportedAts = supportedAts.some(ats => tab.url?.includes(ats));

    if (isOnSupportedAts) {
      if (!recentlyAttemptedTabsForAtsPageLoaded.has(tabId)) {
        // Notify the content script
        chrome.tabs.sendMessage(tabId, { type: 'ATS_PAGE_LOADED' })
          .then(() => {
            // Optional: Could mark as successfully sent if needed for more complex logic
            // For now, just attempting once (per recent period) is the goal
          })
          .catch(() => {
            // Content script might not be ready yet
            console.log(`AutoApply Background: Content script in tab ${tabId} not ready for ATS_PAGE_LOADED.`);
          });
        
        recentlyAttemptedTabsForAtsPageLoaded.add(tabId);
        // Clear this tab from the set after a short delay to allow re-attempts if the page reloads or navigates within SPA later
        setTimeout(() => {
          recentlyAttemptedTabsForAtsPageLoaded.delete(tabId);
        }, 5000); // Allow re-attempt after 5 seconds for the same tabId
      }
    } else {
      // If tab navigates to a non-ATS page, clear it from the set
      recentlyAttemptedTabsForAtsPageLoaded.delete(tabId);
    }
  }
}); 

// Clean up from the set when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  recentlyAttemptedTabsForAtsPageLoaded.delete(tabId);
});