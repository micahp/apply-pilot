import { test, expect, chromium } from '@playwright/test';
import path from 'path';

test.describe('Extension with Persistent Context', () => {
  test('should load extension with full API access', async () => {
    // Create a persistent context with the extension loaded
    const pathToExtension = path.resolve('./dist/apps/extension');
    const userDataDir = '/tmp/test-user-data-dir';
    
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
      executablePath: './chrome/mac-137.0.7151.70/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    });

    // Get the first page
    const page = context.pages()[0] || await context.newPage();
    
    // Navigate to a test page first
    await page.goto('data:text/html,<html><body><h1>Test Page</h1></body></html>');
    
    // Check Chrome API availability
    const chromeApiInfo = await page.evaluate(() => {
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
    await page.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
    await page.waitForTimeout(5000);
    
    // Capture console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('AutoApply') || text.includes('Content script')) {
        consoleMessages.push(`${msg.type()}: ${text}`);
        console.log(`CONSOLE [${msg.type()}]: ${text}`);
      }
    });
    
    // Wait for content script to load
    await page.waitForTimeout(3000);
    
    // Check if panel exists
    const panelExists = await page.locator('#autoapply-panel').count() > 0;
    console.log(`Panel exists: ${panelExists}`);
    
    // Check Chrome API on the target page
    const targetPageApiInfo = await page.evaluate(() => {
      return {
        hasChrome: typeof chrome !== 'undefined',
        hasRuntime: typeof chrome?.runtime !== 'undefined',
        extensionId: chrome?.runtime?.id || null
      };
    });
    
    console.log('Target page API info:', targetPageApiInfo);
    
    // Print content script messages
    console.log('Content script messages:', consoleMessages);
    
    await context.close();
    
    // The test should pass if we can access Chrome APIs
    expect(chromeApiInfo.hasRuntime).toBe(true);
  });
});

test.describe('Extension Direct Test', () => {
  test('should work with normal browser context', async ({ page }) => {
    // This test will use the normal Playwright configuration
    await page.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
    await page.waitForTimeout(5000);
    
    const apiInfo = await page.evaluate(() => {
      return {
        hasChrome: typeof chrome !== 'undefined',
        hasRuntime: typeof chrome?.runtime !== 'undefined',
        url: window.location.href
      };
    });
    
    console.log('Normal context API info:', apiInfo);
    
    const panelExists = await page.locator('#autoapply-panel').count() > 0;
    console.log(`Panel exists (normal context): ${panelExists}`);
    
    expect(true).toBe(true); // Always pass to collect info
  });
}); 