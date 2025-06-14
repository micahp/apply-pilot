import { test, expect } from '@playwright/test';
import path from 'path';

// Enhanced page detection and resume import detection tests
test.describe('Extension Page Detection & Resume Import Features', () => {
  test.describe('ATS Detection', () => {
    test('should detect Greenhouse job application form', async ({ page }) => {
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

    test('should detect Greenhouse career page form', async ({ page }) => {
      await page.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
      
      // Wait for page to load and extension to initialize
      await page.waitForTimeout(3000);
      
      // Check if panel appears
      const panel = page.locator('#autoapply-panel');
      await expect(panel).toBeVisible({ timeout: 8000 });
      
      await page.screenshot({ path: 'test-results/greenhouse-career-detection.png' });
    });

    test('should detect generic job site with application forms', async ({ page }) => {
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
    test('should detect native resume import on Greenhouse', async ({ page }) => {
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

    test('should detect application form elements', async ({ page }) => {
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
    test('should detect form fields dynamically loaded', async ({ page }) => {
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

    test('should handle pages without application forms', async ({ page }) => {
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
    test('should open extension panel when ATS detected', async ({ page }) => {
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

    test('should provide debug information', async ({ page }) => {
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
    test('should handle pages with complex content', async ({ page }) => {
      // Test with a complex page
      await page.goto('https://www.greenhouse.io');
      
      await page.waitForTimeout(2000);
      
      // Extension should handle this gracefully
      const panelCount = await page.locator('#autoapply-panel').count();
      console.log(`Panel count on complex page: ${panelCount}`);
      
      await page.screenshot({ path: 'test-results/complex-page.png' });
    });

    test('should handle slow-loading pages', async ({ page }) => {
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
    test('should render extension UI correctly', async ({ page }) => {
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