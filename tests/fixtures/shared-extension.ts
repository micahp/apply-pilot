import { test as base, chromium, Browser, BrowserContext, Page } from '@playwright/test';
import path from 'path';

type ExtensionFixtures = {
  extensionContext: BrowserContext;
  extensionPage: Page;
  extensionId: string;
};

type ExtensionWorkerFixtures = {
  // Remove browser fixture since we'll use persistent context directly
};

/**
 * Extension testing fixture following Playwright's official Chrome extension testing pattern.
 * Uses launchPersistentContext for proper extension loading.
 */
export const test = base.extend<ExtensionFixtures, ExtensionWorkerFixtures>({
  // Test-scoped persistent context - proper way to load extensions
  extensionContext: async ({ }, use) => {
    const pathToExtension = path.join(__dirname, '../../dist/apps/extension');
    const userDataDir = '/tmp/test-user-data-dir-' + Date.now(); // Unique dir per test
    
    console.log(`Loading extension from: ${pathToExtension}`);
    
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false, // Extensions require non-headless mode
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--no-first-run',
        '--disable-default-apps',
      ],
      ignoreDefaultArgs: ['--disable-component-extensions-with-background-pages'],
    });
    
    await use(context);
    await context.close();
  },

  // Extension ID detection for Manifest v3
  extensionId: async ({ extensionContext }, use) => {
    // For manifest v3: get service worker
    let [background] = extensionContext.serviceWorkers();
    if (!background) {
      background = await extensionContext.waitForEvent('serviceworker');
    }

    const extensionId = background.url().split('/')[2];
    console.log(`Extension ID: ${extensionId}`);
    await use(extensionId);
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
             (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
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