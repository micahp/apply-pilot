import { defineConfig } from '@playwright/test';

// Everything runs against local fixtures served through page.route; no live ATS traffic.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
});
