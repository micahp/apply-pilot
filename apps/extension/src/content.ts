import { detectAts, fillFields } from './ats';
import { createFloatingPanel } from './ui';

// Initialize the content script
async function init() {
  try {
    // Detect the ATS platform
    const atsInfo = await detectAts();
    if (!atsInfo) {
      console.log('AutoApply: No supported ATS detected');
      return;
    }

    // Fetch the field map for this ATS version
    const fieldMap = await fetchFieldMap(atsInfo);
    if (!fieldMap) {
      console.error('AutoApply: Failed to fetch field map');
      return;
    }

    // Create the floating panel UI
    const panel = createFloatingPanel();
    document.body.appendChild(panel);

    // Fill the fields and update the UI
    const filledCount = await fillFields(fieldMap);
    panel.updateFilledCount(filledCount);

    // Listen for DOM changes to handle dynamic forms
    const observer = new MutationObserver(() => {
      fillFields(fieldMap).then(count => {
        panel.updateFilledCount(count);
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });

  } catch (error) {
    console.error('AutoApply: Error in content script', error);
  }
}

// Fetch the field map from our API
async function fetchFieldMap(atsInfo: { ats: string; version: string }) {
  try {
    const response = await fetch(`/api/v1/ats-maps/${atsInfo.ats}/${atsInfo.version}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('AutoApply: Error fetching field map', error);
    return null;
  }
}

// Start the content script
init(); 