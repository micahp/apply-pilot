import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Loads the built extension (dist/apps/extension) into Chromium and drives its floating panel
// on a Greenhouse URL served from the local fixture.
const EXTENSION = path.resolve(__dirname, '../../dist/apps/extension');
const FIXTURES = path.resolve(__dirname, '../fixtures/forms');

let context: BrowserContext;

test.beforeAll(async () => {
  if (!fs.existsSync(path.join(EXTENSION, 'manifest.json'))) {
    throw new Error('Build the extension first: (cd apps/extension && npx vite build)');
  }
  context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ext-')), {
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  await context.route('https://job-boards.greenhouse.io/**', (route) => {
    const file = route.request().url().endsWith('mock-submit.js') ? 'mock-submit.js' : 'greenhouse.html';
    return route.fulfill({ contentType: file.endsWith('.js') ? 'text/javascript' : 'text/html', body: fs.readFileSync(path.join(FIXTURES, file), 'utf8') });
  });

  // Seed storage from an extension page: the service worker's chrome.* APIs can still be
  // initializing right after launch.
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).host;
  const setup = await context.newPage();
  await setup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await setup.evaluate(() =>
    chrome.storage.local.set({
      profile: {
        personal: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '512-555-0100', linkedIn: 'https://linkedin.com/in/ada' },
        preferences: { workAuthorized: 'Yes', requiresSponsorship: 'No' },
        eeo: {},
        resumeFile: { name: 'resume.txt', type: 'text/plain', dataUrl: 'data:text/plain;base64,QWRhIExvdmVsYWNl' },
      },
    })
  );
  await setup.close();
});

test.afterAll(async () => context?.close());

test('the floating panel fills the form, attaches the resume and lists what is left', async () => {
  const page = await context.newPage();
  await page.goto('https://job-boards.greenhouse.io/acme/jobs/1');

  const panel = page.locator('#autoapply-panel');
  await expect(panel).toContainText('Greenhouse');
  await panel.getByRole('button', { name: 'Autofill application' }).click();

  await expect(panel).toContainText('1 required still need you', { timeout: 30_000 });
  await expect(panel).toContainText('Why do you want to work at Acme?');

  await expect(page.locator('#first_name')).toHaveValue('Ada');
  await expect(page.locator('#email')).toHaveValue('ada@example.com');
  await expect(page.locator('#q_auth option:checked')).toHaveText('Yes');
  await expect(page.locator('#q_sponsor option:checked')).toHaveText('No');
  await expect(page.locator('#veteran option:checked')).toHaveText("I don't wish to answer");
  expect(await page.locator('#resume').evaluate((el: HTMLInputElement) => el.files?.[0]?.name)).toBe('resume.txt');
  await expect(page.locator('.autoapply-needs-attention')).toHaveCount(1);
});
