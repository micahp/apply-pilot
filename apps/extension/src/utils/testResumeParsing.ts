import { parseResumeFile } from './resumeParser';

/**
 * Test utility to parse resume files from the browser console
 * Usage:
 * 1. Open browser console
 * 2. Call: window.testResumeParser()
 * 3. Select a resume file in the file picker that appears
 */
export function initTestResumeParser() {
  // Add the test function to the window object for console access
  (window as any).testResumeParser = async () => {
    console.log('Resume Parser Test Utility');
    console.log('-----------------------');
    console.log('Select a resume file to test parsing...');
    
    try {
      // Create a temporary file input element
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.pdf,.doc,.docx,.txt,.rtf';
      
      // Trigger the file picker
      fileInput.click();
      
      // Listen for file selection
      fileInput.onchange = async (event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        
        if (!file) {
          console.log('No file selected.');
          return;
        }
        
        console.log(`Selected file: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(2)} KB)`);
        console.log('Beginning parse operation...');
        
        const startTime = performance.now();
        try {
          const result = await parseResumeFile(file);
          const endTime = performance.now();
          
          console.log('✅ Parse successful!');
          console.log(`Parsing took ${(endTime - startTime).toFixed(2)}ms`);
          console.log('----- EXTRACTED DATA -----');
          
          // Print personal info if available
          if (result.personal) {
            console.log('📋 PERSONAL INFO:');
            console.table(result.personal);
          } else {
            console.log('❌ No personal information extracted');
          }
          
          // Print experience if available
          if (result.workExperience && result.workExperience.length > 0) {
            console.log(`👔 EXPERIENCE (${result.workExperience.length} entries):`);
            console.table(result.workExperience);
          } else {
            console.log('❌ No work experience extracted');
          }
          
          // Print education if available
          if (result.education && result.education.length > 0) {
            console.log(`🎓 EDUCATION (${result.education.length} entries):`);
            console.table(result.education);
          } else {
            console.log('❌ No education information extracted');
          }
          
          // Print skills if available
          if (result.skills && result.skills.length > 0) {
            console.log(`🛠️ SKILLS (${result.skills.length}):`);
            console.log(result.skills.map(skill => 
              typeof skill === 'string' ? skill : skill.name
            ).join(', '));
          } else {
            console.log('❌ No skills extracted');
          }
          
          console.log('-----------------------');
          console.log('Raw parsed data:');
          console.log(result);
          
        } catch (error) {
          console.error('❌ Parse failed!', error);
        }
      };
    } catch (error) {
      console.error('Error initializing test utility:', error);
    }
  };
  
  console.log('Resume parser test utility initialized.');
  console.log('Run window.testResumeParser() to test PDF parsing.');
} 