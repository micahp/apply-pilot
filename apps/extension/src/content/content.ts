import { detectATS, isAshbyJobListingPage, clickAshbyApplyButton } from '../utils/ats';
import { fillATSFieldsEnhanced } from '../utils/ats-enhanced';
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
    
    // Check if this is an Ashby job listing page
    const isJobListingPage = ats.slug === 'ashby' && isAshbyJobListingPage();
    
    if (isJobListingPage) {
      console.log('Detected Ashby job listing page - will show Apply button');
    } else {
      console.log('Detected ATS application form page - will show Autofill button');
    }
    
    // Initialize the floating control panel
    const floatingPanel = initFloatingPanel({
      ats: {
        name: ats.name,
        domain: new URL(window.location.href).hostname,
        selectors: ats.selectors
      },
      isJobListingPage,
      onApply: isJobListingPage ? () => {
        return clickAshbyApplyButton();
      } : undefined,
      onFillFields: async (profileData: Profile) => {
        return await fillATSFieldsEnhanced(ats, profileData);
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