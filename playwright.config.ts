import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['line']
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://127.0.0.1:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chrome-for-testing',
      use: { 
        ...devices['Desktop Chrome'],
        // Use Google Chrome for Testing for stable, reproducible testing
        launchOptions: {
          executablePath: './chrome/mac-137.0.7151.70/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
          args: [
            // Extension loading flags
            `--load-extension=${path.resolve('./dist/apps/extension')}`,
            `--disable-extensions-except=${path.resolve('./dist/apps/extension')}`,
            // Essential flags for extension support
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
        },
      },
    },
    {
      name: 'chrome-for-testing-headless',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: './chrome/mac-137.0.7151.70/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
          args: [
            `--load-extension=${path.resolve('./dist/apps/extension')}`,
            `--disable-extensions-except=${path.resolve('./dist/apps/extension')}`,
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--headless=new',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--no-first-run',
            '--disable-default-apps',
            '--enable-automation',
            '--disable-blink-features=AutomationControlled',
            '--remote-debugging-port=9223'
          ],
        },
      },
    },
    // Extension testing in different scenarios with Chrome for Testing
    {
      name: 'chrome-for-testing-debug',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: './chrome/mac-137.0.7151.70/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
          headless: false,
          devtools: true,
          args: [
            `--load-extension=${path.resolve('./dist/apps/extension')}`,
            `--disable-extensions-except=${path.resolve('./dist/apps/extension')}`,
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
            '--remote-debugging-port=9224'
          ],
        },
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
}); 