import { test, expect } from '@playwright/test';

test.describe('Panel Debug', () => {
  test('debug panel creation with detailed logging', async ({ page }) => {
    // Capture console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(`${msg.type()}: ${text}`);
      console.log(`CONSOLE [${msg.type()}]: ${text}`);
    });

    // Capture any errors
    page.on('pageerror', error => {
      console.log(`PAGE ERROR: ${error.message}`);
    });

    // Navigate to the Greenhouse job page
    await page.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
    
    // Wait longer for extension to fully initialize
    await page.waitForTimeout(5000);
    
    // Check if extension is loaded
    const extensionInfo = await page.evaluate(() => {
      return {
        hasExtensionScripts: !!window.chrome?.runtime,
        userAgent: navigator.userAgent,
        url: window.location.href,
        documentReady: document.readyState,
        bodyHTML: document.body.innerHTML.substring(0, 500) + '...'
      };
    });
    
    console.log('Extension Info:', extensionInfo);
    
    // Check for panel element
    const panelExists = await page.locator('#autoapply-panel').count() > 0;
    console.log(`Panel exists: ${panelExists}`);
    
    // Check for any elements with autoapply in their ID or class
    const autoapplyElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('*[id*="autoapply"], *[class*="autoapply"]');
      return Array.from(elements).map(el => ({
        tag: el.tagName,
        id: el.id,
        className: el.className,
        innerHTML: el.innerHTML.substring(0, 100)
      }));
    });
    
    console.log('AutoApply elements found:', autoapplyElements);
    
    // Check if content script has run by looking for specific console messages
    const contentScriptMessages = consoleMessages.filter(msg => 
      msg.includes('AutoApply') || msg.includes('Content script')
    );
    
    console.log('Content script messages:', contentScriptMessages);
    
    // Try to manually trigger initialization if it hasn't run
    if (!panelExists) {
      console.log('Panel not found, checking extension loading...');
      
      // Wait a bit more and check again
      await page.waitForTimeout(3000);
      const panelExistsAfterWait = await page.locator('#autoapply-panel').count() > 0;
      console.log(`Panel exists after additional wait: ${panelExistsAfterWait}`);
    }
    
    // Take a screenshot for visual debugging
    await page.screenshot({ 
      path: 'test-results/panel-debug.png',
      fullPage: true 
    });
    
    // Print all console messages for analysis
    console.log('\n=== ALL CONSOLE MESSAGES ===');
    consoleMessages.forEach((msg, i) => {
      console.log(`${i + 1}: ${msg}`);
    });
    
    // The test should pass regardless to gather debug info
    expect(true).toBe(true);
  });
}); 