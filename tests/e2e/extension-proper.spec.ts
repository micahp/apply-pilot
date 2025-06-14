import { test, expect } from '../fixtures/extension';

test.describe('Chrome Extension with Proper Context', () => {
  test('should load extension with full Chrome API access', async ({ context, extensionId }) => {
    console.log('Extension ID:', extensionId);
    
    // Create a new page in the extension context
    const page = await context.newPage();
    
    // Test Chrome API availability first
    await page.goto('data:text/html,<html><body><h1>Test Page</h1></body></html>');
    
    const chromeApiInfo = await page.evaluate(() => {
      return {
        hasChrome: typeof chrome !== 'undefined',
        hasRuntime: typeof chrome?.runtime !== 'undefined',
        hasStorage: typeof chrome?.storage !== 'undefined',
        extensionId: chrome?.runtime?.id || null,
        runtimeAvailable: !!chrome?.runtime
      };
    });
    
    console.log('Chrome API Info:', chromeApiInfo);
    
    // The runtime should be available now
    expect(chromeApiInfo.hasRuntime).toBe(true);
    expect(chromeApiInfo.extensionId).toBeTruthy();
    
    // Now test on the actual Greenhouse page
    await page.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
    
    // Capture all console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(`${msg.type()}: ${text}`);
      if (text.includes('AutoApply') || text.includes('Content script')) {
        console.log(`CONSOLE [${msg.type()}]: ${text}`);
      }
    });
    
    // Wait for the page to load and extension to initialize
    await page.waitForTimeout(8000);
    
    // Check if the floating panel appears
    const panelExists = await page.locator('#autoapply-panel').count() > 0;
    console.log(`Panel exists: ${panelExists}`);
    
    if (panelExists) {
      // Take a screenshot of success
      await page.screenshot({ path: 'test-results/extension-success.png' });
      
      // Test panel interaction
      const panelText = await page.locator('#autoapply-panel').textContent();
      console.log('Panel text:', panelText);
      expect(panelText).toContain('AutoApply');
      expect(panelText).toContain('Greenhouse');
      
      // Test the autofill button
      const fillButton = page.locator('#autoapply-panel button').first();
      await expect(fillButton).toBeVisible();
      
      // Click the fill button to test the mock profile functionality
      await fillButton.click();
      await page.waitForTimeout(3000);
      
      // Check for success message
      const statusArea = page.locator('#autoapply-status-message-area');
      const statusText = await statusArea.textContent();
      console.log('Status after fill:', statusText);
      
    } else {
      console.log('Panel not found - printing debug info');
      
      // Check what AutoApply elements exist
      const autoapplyElements = await page.evaluate(() => {
        const elements = document.querySelectorAll('*[id*="autoapply"], *[class*="autoapply"]');
        return Array.from(elements).map(el => ({
          tag: el.tagName,
          id: el.id,
          className: el.className
        }));
      });
      console.log('AutoApply elements:', autoapplyElements);
      
      // Print all console messages for debugging
      console.log('\n=== ALL CONSOLE MESSAGES ===');
      consoleMessages.forEach((msg, i) => {
        console.log(`${i + 1}: ${msg}`);
      });
    }
    
    expect(panelExists).toBe(true);
  });
  
  test('should detect ATS and forms correctly', async ({ context }) => {
    const page = await context.newPage();
    await page.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
    await page.waitForTimeout(5000);
    
    // Test form detection
    const formInfo = await page.evaluate(() => {
      const forms = document.querySelectorAll('form');
      const inputs = document.querySelectorAll('input');
      const fileInputs = document.querySelectorAll('input[type="file"]');
      
      return {
        formCount: forms.length,
        inputCount: inputs.length,
        fileInputCount: fileInputs.length,
        hasFirstNameField: !!document.querySelector('#first_name'),
        hasLastNameField: !!document.querySelector('#last_name'),
        hasEmailField: !!document.querySelector('#email'),
        hasResumeField: !!document.querySelector('#resume')
      };
    });
    
    console.log('Form detection results:', formInfo);
    
    // Verify the form structure we expect
    expect(formInfo.formCount).toBeGreaterThan(0);
    expect(formInfo.inputCount).toBeGreaterThan(10);
    expect(formInfo.hasFirstNameField).toBe(true);
    expect(formInfo.hasLastNameField).toBe(true);
    expect(formInfo.hasEmailField).toBe(true);
  });
}); 