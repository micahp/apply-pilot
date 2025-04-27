import { detectATS, fillATSFields } from '../utils/ats';
import { initFloatingPanel } from '../ui/floatingPanel';
import { initTestResumeParser } from '../utils/testResumeParsing';
import { Profile } from '../types/profile';

// Main content script initialization
(async function() {
  console.log('AutoApply Extension Loaded');
  
  // Initialize the resume parser test utility
  // This allows testing the parser from the console on any page
  initTestResumeParser();
  
  // Detect what ATS platform this page belongs to
  const ats = detectATS(window.location.href);
  
  if (ats) {
    console.log(`Detected ATS: ${ats.name}`);
    
    // Initialize the floating control panel
    const floatingPanel = initFloatingPanel({
      ats: {
        name: ats.name,
        domain: new URL(window.location.href).hostname,
        selectors: ats.selectors
      },
      onFillFields: (profileData: Profile) => {
        fillATSFields(ats, profileData);
      },
      onClose: () => {
        if (floatingPanel) {
          floatingPanel.remove();
        }
      }
    });
  } else {
    console.log('No supported ATS detected on this page');
  }
})(); 