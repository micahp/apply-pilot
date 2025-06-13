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
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Chrome extension testing configuration
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve('./dist/extension')}`,
            `--load-extension=${path.resolve('./dist/extension')}`,
            '--disable-dev-shm-usage',
            '--no-sandbox',
          ],
        },
      },
    },
    {
      name: 'chromium-headless',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve('./dist/extension')}`,
            `--load-extension=${path.resolve('./dist/extension')}`,
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--headless=new',
          ],
        },
      },
    },
    // Extension testing in different scenarios
    {
      name: 'extension-debug',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          headless: false,
          devtools: true,
          args: [
            `--disable-extensions-except=${path.resolve('./dist/extension')}`,
            `--load-extension=${path.resolve('./dist/extension')}`,
            '--disable-dev-shm-usage',
            '--no-sandbox',
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