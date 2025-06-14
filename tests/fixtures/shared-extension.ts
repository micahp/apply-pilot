import { test as base, chromium, Browser, BrowserContext, Page } from '@playwright/test';
import path from 'path';

type ExtensionFixtures = {
  extensionContext: BrowserContext;
  extensionPage: Page;
};

type ExtensionWorkerFixtures = {
  extensionBrowser: Browser;
};

/**
 * Shared browser fixture for extension testing.
 * Reuses browser instance across tests while maintaining context isolation.
 * This significantly improves performance for extension testing.
 */
export const test = base.extend<ExtensionFixtures, ExtensionWorkerFixtures>({
  // Worker-scoped browser - shared across all tests in a file
  extensionBrowser: [async ({ }, use) => {
    const pathToExtension = path.join(__dirname, '../../dist/apps/extension');
    const chromeExecutablePath = './chrome/mac-137.0.7151.70/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
    
    const browser = await chromium.launch({
      headless: false, // Set to true for CI
      executablePath: chromeExecutablePath,
      args: [
        `--load-extension=${pathToExtension}`,
        `--disable-extensions-except=${pathToExtension}`,
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--no-first-run',
        '--disable-default-apps',
        '--enable-automation',
        '--disable-blink-features=AutomationControlled',
        '--remote-debugging-port=9222'
      ],
    });
    
    await use(browser);
    await browser.close();
  }, { scope: 'worker' }],

  // Test-scoped context - fresh context for each test (maintains isolation)
  extensionContext: async ({ extensionBrowser }, use) => {
    const context = await extensionBrowser.newContext({
      // Ensure clean state for each test
      ignoreHTTPSErrors: true,
      // You can add more context options here as needed
      viewport: { width: 1280, height: 720 },
    });
    
    await use(context);
    await context.close();
  },

  // Test-scoped page - fresh page for each test
  extensionPage: async ({ extensionContext }, use) => {
    const page = await extensionContext.newPage();
    
    // Set up common configurations
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Enhanced console logging for debugging
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      
      // Log extension-related messages with better formatting
      if (text.includes('AutoApply') || 
          text.includes('Content script') || 
          text.includes('Extension') ||
          text.includes('chrome-extension') ||
          type === 'error') {
        console.log(`[${type.toUpperCase()}] ${text}`);
      }
    });

    // Log page errors
    page.on('pageerror', err => {
      console.error(`[PAGE ERROR] ${err.message}`);
    });

    await use(page);
    await page.close();
  },
});

export { expect } from '@playwright/test';

/**
 * Helper function to wait for extension to be ready
 */
export async function waitForExtensionReady(page: Page, timeout = 10000): Promise<void> {
  await page.waitForFunction(
    () => {
      // Check if extension content script has loaded
      return window.hasOwnProperty('AutoApplyExtension') || 
             document.querySelector('#autoapply-panel') !== null ||
             typeof chrome !== 'undefined' && chrome.runtime;
    },
    { timeout }
  );
}

/**
 * Helper function to get extension debug information
 */
export async function getExtensionDebugInfo(page: Page) {
  return await page.evaluate(() => {
    return {
      hasChrome: typeof chrome !== 'undefined',
      hasRuntime: typeof chrome?.runtime !== 'undefined',
      extensionId: chrome?.runtime?.id || null,
      hasAutoApplyPanel: document.querySelector('#autoapply-panel') !== null,
      autoApplyElements: Array.from(document.querySelectorAll('*[id*="autoapply"], *[class*="autoapply"]')).length,
      url: window.location.href,
      title: document.title
    };
  });
} 