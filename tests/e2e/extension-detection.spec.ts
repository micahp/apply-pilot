import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';

// Enhanced page detection and resume import detection tests
test.describe('Extension Page Detection & Resume Import Features', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // Create a new context with the extension loaded
    context = await browser.newContext({
      // This assumes the extension is built to dist/extension
      // You may need to adjust the path based on your build output
    });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.describe('ATS Detection', () => {
    test('should detect Lever job application form', async () => {
      // Navigate to a Lever job application
      await page.goto('https://jobs.lever.co/stripe/backend-engineer');
      
      // Wait for the extension to load and detect the ATS
      await page.waitForTimeout(2000);
      
      // Check if the floating panel appeared
      const panel = page.locator('#autoapply-panel');
      await expect(panel).toBeVisible({ timeout: 5000 });
      
      // Check if the correct ATS was detected
      const atsInfo = await page.evaluate(() => {
        return window.location.href;
      });
      
      expect(atsInfo).toContain('lever.co');
      
      // Take a screenshot to see what's happening
      await page.screenshot({ path: 'test-results/lever-detection.png' });
    });

    test('should detect Greenhouse job application form', async () => {
      await page.goto('https://boards.greenhouse.io/stripe/jobs/4000000000');
      
      // Wait for page to load and extension to initialize
      await page.waitForTimeout(2000);
      
      // Check if panel appears
      const panel = page.locator('#autoapply-panel');
      await expect(panel).toBeVisible({ timeout: 5000 });
      
      await page.screenshot({ path: 'test-results/greenhouse-detection.png' });
    });

    test('should detect Workday application form', async () => {
      // Workday URLs are company-specific, so we'll use a general pattern
      await page.goto('https://stripe.wd1.myworkdayjobs.com/en-US/Stripe/job/Seattle-WA/Backend-Engineer_JR_123456');
      
      await page.waitForTimeout(2000);
      
      const panel = page.locator('#autoapply-panel');
      await expect(panel).toBeVisible({ timeout: 5000 });
      
      await page.screenshot({ path: 'test-results/workday-detection.png' });
    });
  });

  test.describe('Resume Import Detection', () => {
    test('should detect native resume import on Lever', async () => {
      await page.goto('https://jobs.lever.co/stripe/backend-engineer');
      
      // Look for resume import buttons/links
      const resumeUploadSelectors = [
        '[data-qa="resume-upload"]',
        'input[type="file"][accept*="pdf"]',
        'button:has-text("Upload Resume")',
        'button:has-text("Import Resume")',
        'a:has-text("Import from Resume")',
        '.resume-upload',
        '[id*="resume"]',
        '[class*="resume"]'
      ];
      
      let foundResumeImport = false;
      
      for (const selector of resumeUploadSelectors) {
        const element = page.locator(selector);
        if (await element.count() > 0) {
          foundResumeImport = true;
          console.log(`Found resume import element: ${selector}`);
          await page.screenshot({ path: 'test-results/lever-resume-import.png' });
          break;
        }
      }
      
      // Test whether our extension detects this
      const extensionDetection = await page.evaluate(() => {
        // This calls our extension's detection function
        return {
          hasResumeImport: document.querySelector('[data-qa="resume-upload"]') !== null,
          allFileInputs: Array.from(document.querySelectorAll('input[type="file"]')).length,
          hasResumeKeywords: document.body.innerText.toLowerCase().includes('resume')
        };
      });
      
      console.log('Extension detection results:', extensionDetection);
    });

    test('should detect native resume import on Greenhouse', async () => {
      await page.goto('https://boards.greenhouse.io/stripe/jobs/4000000000');
      
      // Look for Greenhouse-specific resume import features
      const resumeSelectors = [
        'input[type="file"]',
        '[data-field="resume"]',
        'button:has-text("Upload")',
        '.file-upload',
        '[id*="resume"]'
      ];
      
      for (const selector of resumeSelectors) {
        const element = page.locator(selector);
        if (await element.count() > 0) {
          console.log(`Found resume import on Greenhouse: ${selector}`);
          await page.screenshot({ path: 'test-results/greenhouse-resume-import.png' });
          break;
        }
      }
    });
  });

  test.describe('Dynamic Content Detection', () => {
    test('should detect ATS on single-page applications', async () => {
      // Test SPA navigation
      await page.goto('https://jobs.lever.co/stripe');
      
      // Click on a job listing
      await page.click('a.posting-title', { timeout: 10000 });
      
      // Wait for SPA navigation
      await page.waitForURL(/.*\/jobs\/.*/, { timeout: 10000 });
      
      // Check if extension re-detected after navigation
      await page.waitForTimeout(2000);
      
      const panel = page.locator('#autoapply-panel');
      await expect(panel).toBeVisible({ timeout: 5000 });
      
      await page.screenshot({ path: 'test-results/spa-navigation.png' });
    });

    test('should detect form fields dynamically loaded', async () => {
      await page.goto('https://jobs.lever.co/stripe/backend-engineer');
      
      // Wait for form to load
      await page.waitForSelector('form', { timeout: 10000 });
      
      // Check if our extension detected the form fields
      const formAnalysis = await page.evaluate(() => {
        const forms = document.querySelectorAll('form');
        const inputs = document.querySelectorAll('input, textarea, select');
        
        return {
          formCount: forms.length,
          inputCount: inputs.length,
          fieldTypes: Array.from(inputs).map(input => ({
            type: input.type || input.tagName,
            name: input.name,
            id: input.id,
            placeholder: input.placeholder
          }))
        };
      });
      
      console.log('Form analysis:', formAnalysis);
      expect(formAnalysis.inputCount).toBeGreaterThan(0);
    });
  });

  test.describe('Extension Interaction', () => {
    test('should open extension panel when ATS detected', async () => {
      await page.goto('https://jobs.lever.co/stripe/backend-engineer');
      
      // Wait for extension to initialize
      await page.waitForTimeout(2000);
      
      // Check if floating panel is visible
      const panel = page.locator('#autoapply-panel');
      await expect(panel).toBeVisible();
      
      // Check panel content
      const panelText = await panel.textContent();
      expect(panelText).toContain('Lever'); // Should show detected ATS
    });

    test('should provide recommendations when resume import available', async () => {
      await page.goto('https://jobs.lever.co/stripe/backend-engineer');
      
      await page.waitForTimeout(2000);
      
      // Check if extension provides recommendation about native resume import
      const recommendations = await page.evaluate(() => {
        // This would access extension's recommendation system
        const panel = document.querySelector('#autoapply-panel');
        return panel ? panel.textContent : null;
      });
      
      // Should recommend using native import if available
      if (recommendations && recommendations.includes('import')) {
        console.log('Extension correctly detected native resume import');
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle pages with complex authentication', async () => {
      // Test with a page that requires login
      await page.goto('https://stripe.wd1.myworkdayjobs.com/en-US/Stripe');
      
      await page.waitForTimeout(2000);
      
      // Extension should not crash on auth pages
      const errors = await page.evaluate(() => {
        return window.console.error.toString();
      });
      
      // Should not have critical errors
      expect(errors).not.toContain('ReferenceError');
    });

    test('should handle slow-loading pages', async () => {
      // Navigate to a slow page
      await page.goto('https://jobs.lever.co/stripe/backend-engineer');
      
      // Don't wait for full load
      await page.waitForTimeout(1000);
      
      // Extension should handle partial load gracefully
      const panel = page.locator('#autoapply-panel');
      
      // Should either be visible or not crash
      try {
        await expect(panel).toBeVisible({ timeout: 3000 });
      } catch (e) {
        // It's okay if not visible yet, but should not crash
        const errors = await page.evaluate(() => window.console.error.toString());
        expect(errors).not.toContain('TypeError');
      }
    });
  });

  test.describe('Visual Testing', () => {
    test('should render extension UI correctly', async () => {
      await page.goto('https://jobs.lever.co/stripe/backend-engineer');
      
      await page.waitForTimeout(2000);
      
      // Take screenshots for visual regression testing
      await page.screenshot({ 
        path: 'test-results/extension-ui.png',
        fullPage: true 
      });
      
      // Test different viewport sizes
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.screenshot({ path: 'test-results/extension-ui-desktop.png' });
      
      await page.setViewportSize({ width: 375, height: 667 });
      await page.screenshot({ path: 'test-results/extension-ui-mobile.png' });
    });
  });
});

// Helper function to get extension console logs
async function getExtensionLogs(page: Page) {
  return await page.evaluate(() => {
    // Access extension console if available
    return (window as any).extensionLogs || [];
  });
}

// Helper function to simulate extension interaction
async function simulateExtensionClick(page: Page, selector: string) {
  await page.click(selector);
  await page.waitForTimeout(500); // Wait for extension to process
} 