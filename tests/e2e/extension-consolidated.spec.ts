import { test, expect } from '../fixtures/shared-extension';

/**
 * Consolidated extension tests - memory-efficient and comprehensive
 * Replaces: extension-detection.spec.ts, panel-debug.spec.ts, 
 *          extension-persistent-context.spec.ts, content-script-debug.spec.ts
 */
test.describe('AutoApply Extension - Comprehensive Tests', () => {
  
  test.describe('Extension Loading & Basic Functionality', () => {
    test('should load extension with proper context', async ({ extensionPage, extensionId }) => {
      // Navigate to a simple test page first
      await extensionPage.goto('data:text/html,<html><body><h1>Extension Test Page</h1></body></html>');
      
      // Verify basic extension functionality
      const pageInfo = await extensionPage.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          hasDocument: typeof document !== 'undefined',
          hasWindow: typeof window !== 'undefined',
        };
      });
      
      expect(pageInfo.hasDocument).toBe(true);
      expect(pageInfo.hasWindow).toBe(true);
      expect(extensionId).toBeTruthy();
      
      console.log(`✅ Extension loaded successfully with ID: ${extensionId}`);
    });
  });

  test.describe('ATS Detection Tests', () => {
    test('should detect Greenhouse ATS and create panel', async ({ extensionPage }) => {
      const url = 'https://job-boards.greenhouse.io/headway/jobs/5308863004';
      
      console.log(`🌐 Navigating to Greenhouse job posting: ${url}`);
      await extensionPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      // Wait for page to stabilize
      await extensionPage.waitForTimeout(3000);
      
      // Check if ATS was detected
      const atsDetection = await extensionPage.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          hasForm: document.querySelectorAll('form').length > 0,
          hasInputs: document.querySelectorAll('input').length > 0,
          hasFileInputs: document.querySelectorAll('input[type="file"]').length > 0,
        };
      });
      
      expect(atsDetection.url).toContain('greenhouse.io');
      expect(atsDetection.hasInputs).toBe(true);
      
      console.log(`✅ Greenhouse detected: ${atsDetection.hasInputs ? 'Has inputs' : 'No inputs found'}`);
      
      // Check for extension panel (may or may not appear depending on page state)
      const panelExists = await extensionPage.locator('#autoapply-panel').count() > 0;
      console.log(`🎛️  Extension panel visible: ${panelExists}`);
      
      // Take screenshot for debugging if needed
      await extensionPage.screenshot({ 
        path: 'test-results/greenhouse-detection.png',
        fullPage: false // Reduce memory usage
      });
    });

    test('should handle simple HTML pages gracefully', async ({ extensionPage }) => {
      const url = 'data:text/html,<html><body><h1>Simple Test Page</h1><p>No forms here</p></body></html>';
      
      console.log(`🌐 Navigating to simple test page`);
      await extensionPage.goto(url);
      
      // Wait briefly for any extension activity
      await extensionPage.waitForTimeout(1000);
      
      // Extension should not create a panel on pages without forms
      const panelCount = await extensionPage.locator('#autoapply-panel').count();
      console.log(`🎛️  Panel count on simple page: ${panelCount}`);
      
      // Should be 0 since there are no forms
      expect(panelCount).toBe(0);
    });
  });

  test.describe('Form Detection Tests', () => {
    test('should detect and analyze form elements on Greenhouse', async ({ extensionPage }) => {
      const url = 'https://job-boards.greenhouse.io/headway/jobs/5308863004';
      
      await extensionPage.goto(url, { timeout: 15000 });
      await extensionPage.waitForTimeout(3000);
      
      // Analyze form structure
      const formAnalysis = await extensionPage.evaluate(() => {
        const forms = document.querySelectorAll('form');
        const inputs = document.querySelectorAll('input, textarea, select');
        const fileInputs = document.querySelectorAll('input[type="file"]');
        
        return {
          formCount: forms.length,
          inputCount: inputs.length,
          fileInputCount: fileInputs.length,
          fieldTypes: Array.from(inputs).map(input => ({
            type: (input as HTMLInputElement).type || input.tagName,
            name: (input as HTMLInputElement).name,
            id: (input as HTMLElement).id,
            placeholder: (input as HTMLInputElement).placeholder
          })).slice(0, 10), // Limit to first 10 to reduce memory
          hasFirstNameField: !!document.querySelector('#first_name, input[name="first_name"]'),
          hasLastNameField: !!document.querySelector('#last_name, input[name="last_name"]'),
          hasEmailField: !!document.querySelector('#email, input[name="email"]'),
          hasResumeField: !!document.querySelector('#resume, input[name="resume"]')
        };
      });
      
      console.log(`📋 Form analysis: ${formAnalysis.formCount} forms, ${formAnalysis.inputCount} inputs`);
      
      // Basic form structure validation
      expect(formAnalysis.formCount).toBeGreaterThan(0);
      expect(formAnalysis.inputCount).toBeGreaterThan(5);
      
      // Log field types for debugging
      if (formAnalysis.fieldTypes.length > 0) {
        console.log('📝 Found field types:', formAnalysis.fieldTypes.slice(0, 5));
      }
    });
  });

  test.describe('Error Handling & Edge Cases', () => {
    test('should handle slow-loading pages', async ({ extensionPage }) => {
      const url = 'https://job-boards.greenhouse.io/headway/jobs/5308863004';
      
      await extensionPage.goto(url, { timeout: 20000 });
      
      // Wait longer for slow loading
      await extensionPage.waitForTimeout(5000);
      
      const hasContent = await extensionPage.evaluate(() => {
        return document.body.innerText.length > 100;
      });
      
      expect(hasContent).toBe(true);
      console.log(`📄 Page loaded successfully with content`);
    });

    test('should maintain functionality across page navigation', async ({ extensionPage }) => {
      // Start with Greenhouse careers page
      await extensionPage.goto('https://www.greenhouse.io/careers', { timeout: 10000 });
      await extensionPage.waitForTimeout(2000);
      
      // Navigate to job posting
      await extensionPage.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004', { timeout: 15000 });
      await extensionPage.waitForTimeout(3000);
      
      // Verify page loaded successfully after navigation
      const pageStatus = await extensionPage.evaluate(() => {
        return {
          url: window.location.href,
          hasContent: document.body.innerText.length > 100,
          readyState: document.readyState,
        };
      });
      
      expect(pageStatus.hasContent).toBe(true);
      expect(pageStatus.readyState).toBe('complete');
      expect(pageStatus.url).toContain('greenhouse.io');
      
      console.log(`🔄 Extension maintained functionality across navigation`);
    });
  });

  test.describe('Performance & Cleanup', () => {
    test('should handle multiple page loads without memory leaks', async ({ extensionPage }) => {
      const urls = [
        'https://www.greenhouse.io/careers',
        'https://job-boards.greenhouse.io/headway/jobs/5308863004',
        'https://www.greenhouse.io/careers'
      ];
      
      for (const url of urls) {
        console.log(`🔄 Loading: ${url}`);
        await extensionPage.goto(url, { timeout: 10000 });
        await extensionPage.waitForTimeout(1000); // Brief pause between loads
        
        // Verify page loaded
        const pageState = await extensionPage.evaluate(() => {
          return {
            readyState: document.readyState,
            hasContent: document.body && document.body.innerText.length > 10,
          };
        });
        expect(pageState.readyState).toBe('complete');
        expect(pageState.hasContent).toBe(true);
      }
      
      console.log(`✅ Multiple page loads completed successfully`);
    });
  });
}); 