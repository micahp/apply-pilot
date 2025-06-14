import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({ }, use) => {
    const pathToExtension = path.join(__dirname, '../../dist/apps/extension');
    const userDataDir = `/tmp/playwright-extension-test-${Date.now()}-${Math.random()}`;
    
    // Clean up any existing user data directory
    const fs = require('fs');
    if (fs.existsSync(userDataDir)) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
    
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false, // Extensions don't work reliably in headless mode
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
      executablePath: './chrome/mac-137.0.7151.70/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    });
    
    await use(context);
    await context.close();
    
    // Clean up user data directory after test
    if (fs.existsSync(userDataDir)) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  },
  extensionId: async ({ context }, use) => {
    // For manifest v3 (which our extension uses):
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }

    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
});

export const expect = test.expect; 