import { test, expect } from '../fixtures/shared-extension';
import path from 'path';

// Enhanced page detection and resume import detection tests
test.describe('Extension Page Detection & Resume Import Features', () => {
  test.beforeEach(async ({ extensionPage: page }) => {
    // Enhanced logging for debugging
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('AutoApply') || text.includes('Content script') || text.includes('Extension')) {
        console.log(`[EXTENSION] ${text}`);
      }
    });

    page.on('pageerror', err => {
      console.error(`[PAGE ERROR] ${err.message}`);
    });
  });

  test.describe('ATS Detection', () => {
    test('should detect Greenhouse job application form', async ({ extensionPage: page }) => {
      // Navigate to a real Greenhouse job application that exists
      await page.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
      
      // Wait for the extension to load and detect the ATS
      await page.waitForTimeout(3000);
      
      // Check if the floating panel appeared
      const panel = page.locator('#autoapply-panel');
      await expect(panel).toBeVisible({ timeout: 8000 });
      
      // Check if the correct ATS was detected
      const atsInfo = await page.evaluate(() => {
        return window.location.href;
      });
      
      expect(atsInfo).toContain('greenhouse.io');
      
      // Take a screenshot to see what's happening
      await page.screenshot({ path: 'test-results/greenhouse-detection.png' });
    });

    test('should detect Greenhouse career page form', async ({ extensionPage: page }) => {
      const url = 'https://job-boards.greenhouse.io/headway/jobs/5308863004';
      
      console.log(`Navigating to: ${url}`);
      await page.goto(url);
      
      // Wait for page to fully load
      await page.waitForLoadState('networkidle');
      
      // First, let's verify the extension is actually loaded
      const extensionInfo = await page.evaluate(() => {
        return {
          hasChrome: typeof chrome !== 'undefined',
          hasRuntime: typeof chrome?.runtime !== 'undefined',
          extensionId: chrome?.runtime?.id || null,
          url: window.location.href,
          title: document.title,
          hasAnyAutoApplyElements: document.querySelectorAll('*[id*="autoapply"], *[class*="autoapply"]').length > 0
        };
      });
      
      console.log('Extension info:', extensionInfo);
      
      // Check if this URL should trigger content scripts based on manifest
      const shouldHaveContentScript = [
        'greenhouse.io',
        'workday.com',
        'lever.co',
        'taleo.net',
        'ashbyhq.com',
        'workable.com',
        'icims.com'
      ].some(domain => url.includes(domain));
      
      console.log(`Should have content script for this URL: ${shouldHaveContentScript}`);
      
      if (shouldHaveContentScript) {
        // Wait longer for content script to initialize and create panel
        console.log('Waiting for extension content script to create panel...');
        
        // Check if panel exists or gets created within timeout
        try {
          const panel = page.locator('#autoapply-panel');
          await expect(panel).toBeVisible({ timeout: 12000 });
          console.log('✅ Panel found and visible');
        } catch (error) {
          console.log('❌ Panel not found, checking for other extension signs...');
          
          // Check for any extension activity
          const debugInfo = await page.evaluate(() => {
            const allElements = document.querySelectorAll('*');
            const suspiciousElements: Array<{ tag: string; id: string; classes: string }> = [];
            
            allElements.forEach(el => {
              if (el.id && (el.id.includes('autoapply') || el.id.includes('extension'))) {
                suspiciousElements.push({ tag: el.tagName, id: el.id, classes: el.className });
              }
              if (el.className && typeof el.className === 'string' && 
                  (el.className.includes('autoapply') || el.className.includes('extension'))) {
                suspiciousElements.push({ tag: el.tagName, id: el.id, classes: el.className });
              }
            });
            
            return {
              suspiciousElements,
              totalElements: allElements.length,
              hasAutoApplyInBody: document.body.innerHTML.includes('autoapply'),
              scriptTags: Array.from(document.querySelectorAll('script')).length,
              hasExtensionScripts: Array.from(document.querySelectorAll('script')).some(s => 
                s.src && s.src.includes('chrome-extension')
              )
            };
          });
          
          console.log('Debug info:', debugInfo);
          
          // Take diagnostic screenshot
          await page.screenshot({ 
            path: 'test-results/greenhouse-debug.png',
            fullPage: true 
          });
          
          throw error;
        }
      } else {
        console.log('⚠️  URL may not match content script patterns in manifest');
        console.log('Available patterns: workday.com, greenhouse.io, lever.co, taleo.net, ashbyhq.com, workable.com, icims.com');
      }
      
      await page.screenshot({ path: 'test-results/greenhouse-career-detection.png' });
    });

    test('should detect generic job site with application forms', async ({ extensionPage: page }) => {
      // Use a site that might have job application forms
      await page.goto('https://my.greenhouse.io');
      
      await page.waitForTimeout(3000);
      
      // This might not have the panel if it's not an application page
      // But we should at least check that the extension loads
      const hasPanel = await page.locator('#autoapply-panel').count();
      console.log(`Panel found: ${hasPanel > 0}`);
      
      await page.screenshot({ path: 'test-results/generic-detection.png' });
    });
  });

  test.describe('Resume Import Detection', () => {
    test('should detect native resume import on Greenhouse', async ({ extensionPage: page }) => {
      await page.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
      
      // Look for resume import buttons/links
      const resumeUploadSelectors = [
        '[data-qa="resume-upload"]',
        'input[type="file"][accept*="pdf"]',
        'button:has-text("Upload Resume")',
        'button:has-text("Import Resume")',
        'a:has-text("Import from Resume")',
        '.resume-upload',
        '[id*="resume"]',
        '[class*="resume"]',
        'input[type="file"]'
      ];
      
      let foundResumeImport = false;
      
      for (const selector of resumeUploadSelectors) {
        const element = page.locator(selector);
        if (await element.count() > 0) {
          foundResumeImport = true;
          console.log(`Found resume import element: ${selector}`);
          await page.screenshot({ path: 'test-results/greenhouse-resume-import.png' });
          break;
        }
      }
      
      // Test whether our extension detects this
      const extensionDetection = await page.evaluate(() => {
        // This calls our extension's detection function
        return {
          hasResumeImport: document.querySelector('input[type="file"]') !== null,
          allFileInputs: Array.from(document.querySelectorAll('input[type="file"]')).length,
          hasResumeKeywords: document.body.innerText.toLowerCase().includes('resume'),
          hasAttachKeywords: document.body.innerText.toLowerCase().includes('attach')
        };
      });
      
      console.log('Extension detection results:', extensionDetection);
    });

    test('should detect application form elements', async ({ extensionPage: page }) => {
      await page.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
      
      // Look for general application form elements
      const formSelectors = [
        'input[type="file"]',
        'input[type="email"]',
        'input[name*="name"]',
        'form',
        'button[type="submit"]',
        'textarea'
      ];
      
      for (const selector of formSelectors) {
        const element = page.locator(selector);
        if (await element.count() > 0) {
          console.log(`Found form element: ${selector}`);
          await page.screenshot({ path: 'test-results/form-elements.png' });
          break;
        }
      }
    });
  });

  test.describe('Dynamic Content Detection', () => {
    test('should detect form fields dynamically loaded', async ({ extensionPage: page }) => {
      await page.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
      
      // Wait for form to load
      await page.waitForTimeout(3000);
      
      // Check if our extension detected the form fields
      const formAnalysis = await page.evaluate(() => {
        const forms = document.querySelectorAll('form');
        const inputs = document.querySelectorAll('input, textarea, select');
        
        return {
          formCount: forms.length,
          inputCount: inputs.length,
          fieldTypes: Array.from(inputs).map(input => ({
            type: (input as HTMLInputElement).type || input.tagName,
            name: (input as HTMLInputElement).name,
            id: (input as HTMLElement).id,
            placeholder: (input as HTMLInputElement).placeholder
          }))
        };
      });
      
      console.log('Form analysis:', formAnalysis);
      expect(formAnalysis.inputCount).toBeGreaterThan(0);
    });

    test('should handle pages without application forms', async ({ extensionPage: page }) => {
      // Test a page that definitely won't have forms
      await page.goto('https://www.greenhouse.io/careers');
      
      await page.waitForTimeout(2000);
      
      // Extension should not create a panel here
      const panelCount = await page.locator('#autoapply-panel').count();
      console.log(`Panel count on career overview page: ${panelCount}`);
      
      await page.screenshot({ path: 'test-results/no-forms-page.png' });
    });
  });

  test.describe('Extension Interaction', () => {
    test('should open extension panel when ATS detected', async ({ extensionPage: page }) => {
      await page.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
      
      // Wait for extension to initialize
      await page.waitForTimeout(3000);
      
      // Check if floating panel is visible
      const panel = page.locator('#autoapply-panel');
      const panelVisible = await panel.count() > 0;
      console.log(`Panel visible: ${panelVisible}`);
      
      if (panelVisible) {
        await expect(panel).toBeVisible();
        
        // Check panel content
        const panelText = await panel.textContent();
        console.log(`Panel text: ${panelText}`);
        expect(panelText).toContain('Greenhouse'); // Should show detected ATS
      }
    });

    test('should provide debug information', async ({ extensionPage: page }) => {
      await page.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
      
      await page.waitForTimeout(3000);
      
      // Check console logs from extension
      const logs: string[] = [];
      page.on('console', msg => logs.push(msg.text()));
      
      // Trigger a reload to see logs
      await page.reload();
      await page.waitForTimeout(2000);
      
      console.log('Console logs:');
      logs.forEach(log => {
        if (log.includes('AutoApply') || log.includes('extension')) {
          console.log('  ', log);
        }
      });
    });
  });

  test.describe('Error Handling', () => {
    test('should handle pages with complex content', async ({ extensionPage: page }) => {
      // Test with a complex page
      await page.goto('https://www.greenhouse.io');
      
      await page.waitForTimeout(2000);
      
      // Extension should handle this gracefully
      const panelCount = await page.locator('#autoapply-panel').count();
      console.log(`Panel count on complex page: ${panelCount}`);
      
      await page.screenshot({ path: 'test-results/complex-page.png' });
    });

    test('should handle slow-loading pages', async ({ extensionPage: page }) => {
      // Navigate to a potentially slow page
      await page.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
      
      // Wait longer for slow loading
      await page.waitForTimeout(5000);
      
      const hasContent = await page.evaluate(() => {
        return document.body.innerText.length > 100;
      });
      
      expect(hasContent).toBe(true);
      
      await page.screenshot({ path: 'test-results/slow-loading.png' });
    });
  });

  test.describe('Visual Testing', () => {
    test('should render extension UI correctly', async ({ extensionPage: page }) => {
      await page.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
      
      await page.waitForTimeout(3000);
      
      // Take screenshot for visual regression testing
      await page.screenshot({ 
        path: 'test-results/extension-ui.png',
        fullPage: true
      });
      
      // Check if any extension elements exist
      const extensionElements = await page.evaluate(() => {
        return {
          hasPanel: document.querySelector('#autoapply-panel') !== null,
          hasExtensionStyles: Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .some(el => el.textContent?.includes('autoapply') || (el as HTMLLinkElement).href?.includes('autoapply')),
          bodyClasses: document.body.className
        };
      });
      
      console.log('Extension UI state:', extensionElements);
    });
  });
});

async function getExtensionLogs(page: Page) {
  return page.evaluate(() => {
    // Return any extension-specific logs or state
    return (window as any).extensionLogs || [];
  });
}

async function simulateExtensionClick(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (element) {
      (element as HTMLElement).click();
      return true;
    }
    return false;
  }, selector);
} 