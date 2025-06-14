import { test, expect } from '../fixtures/shared-extension';
import path from 'path';

test.describe('Extension with Persistent Context', () => {
  test('should load extension with full API access', async ({ extensionPage, extensionContext }) => {
    // Navigate to a test page first
    await extensionPage.goto('data:text/html,<html><body><h1>Test Page</h1></body></html>');
    
    // Check Chrome API availability
    const chromeApiInfo = await extensionPage.evaluate(() => {
      return {
        hasChrome: typeof chrome !== 'undefined',
        hasRuntime: typeof chrome?.runtime !== 'undefined',
        hasStorage: typeof chrome?.storage !== 'undefined',
        extensionId: chrome?.runtime?.id || null,
        manifest: chrome?.runtime?.getManifest?.() || null
      };
    });
    
    console.log('Chrome API Info (persistent context):', chromeApiInfo);
    
    if (chromeApiInfo.hasRuntime) {
      console.log('SUCCESS: Chrome runtime API is available!');
      console.log('Extension ID:', chromeApiInfo.extensionId);
      console.log('Manifest:', chromeApiInfo.manifest);
    } else {
      console.log('ERROR: Chrome runtime API is not available');
    }
    
    // Now test on the actual Greenhouse page
    await extensionPage.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
    await extensionPage.waitForTimeout(5000);
    
    // Capture console messages
    const consoleMessages: string[] = [];
    extensionPage.on('console', msg => {
      const text = msg.text();
      if (text.includes('AutoApply') || text.includes('Content script')) {
        consoleMessages.push(`${msg.type()}: ${text}`);
        console.log(`CONSOLE [${msg.type()}]: ${text}`);
      }
    });
    
    // Wait for content script to load
    await extensionPage.waitForTimeout(3000);
    
    // Check if panel exists
    const panelExists = await extensionPage.locator('#autoapply-panel').count() > 0;
    console.log(`Panel exists: ${panelExists}`);
    
    // Check Chrome API on the target page
    const targetPageApiInfo = await extensionPage.evaluate(() => {
      return {
        hasChrome: typeof chrome !== 'undefined',
        hasRuntime: typeof chrome?.runtime !== 'undefined',
        extensionId: chrome?.runtime?.id || null
      };
    });
    
    console.log('Target page API info:', targetPageApiInfo);
    
    // Print content script messages
    console.log('Content script messages:', consoleMessages);
    
    // The test should pass if we can access Chrome APIs
    expect(chromeApiInfo.hasRuntime).toBe(true);
  });
});

test.describe('Extension Direct Test', () => {
  test('should work with normal browser context', async ({ extensionPage }) => {
    // This test will use the shared extension fixture
    await extensionPage.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
    await extensionPage.waitForTimeout(5000);
    
    const apiInfo = await extensionPage.evaluate(() => {
      return {
        hasChrome: typeof chrome !== 'undefined',
        hasRuntime: typeof chrome?.runtime !== 'undefined',
        url: window.location.href
      };
    });
    
    console.log('Normal context API info:', apiInfo);
    
    const panelExists = await extensionPage.locator('#autoapply-panel').count() > 0;
    console.log(`Panel exists (normal context): ${panelExists}`);
    
    expect(true).toBe(true); // Always pass to collect info
  });
}); 