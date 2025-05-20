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
    
    if (supportedAts.some(ats => tab.url?.includes(ats))) {
      // Notify the content script
      chrome.tabs.sendMessage(tabId, { type: 'ATS_PAGE_LOADED' })
        .catch(() => {
          // Content script might not be ready yet
          console.log('AutoApply: Content script not ready');
        });
    }
  }
}); 