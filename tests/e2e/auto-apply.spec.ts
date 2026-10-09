import { test, expect, chromium, type Browser, type BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { applyToJob } = require('../../scripts/auto-apply-playwright.js');

const FIXTURES = path.resolve(__dirname, '../fixtures/forms');
const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

const baseProfile = {
  personal: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '512-555-0100', city: 'Austin', state: 'TX', linkedIn: 'https://linkedin.com/in/ada' },
  workExperience: [{ company: 'Analytical Engines', title: 'Engineer', startDate: '2020-01', current: true }],
  preferences: { workAuthorized: true, requiresSponsorship: false },
  eeo: {},
  resumePath: path.resolve(__dirname, '../fixtures/resume.txt'),
  customAnswers: [
    { question: 'Why do you want to work at', answer: 'I want to build {{company}} products.' },
    { question: 'privacy notice', answer: 'Yes' },
  ],
};

type Pages = Record<string, string>;

/** A Browser stand-in whose contexts serve `pages` and record what the mock ATS received. */
function routedBrowser(browser: Browser, pages: Pages, submissions: unknown[]) {
  return {
    async newContext(options: Parameters<Browser['newContext']>[0]): Promise<BrowserContext> {
      const context = await browser.newContext(options);
      await context.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === '/__submit') {
          submissions.push(route.request().postDataJSON());
          return route.fulfill({ status: 204 });
        }
        if (url.pathname.endsWith('/mock-submit.js')) return route.fulfill({ contentType: 'text/javascript', body: fixture('mock-submit.js') });
        const body = pages[url.origin + url.pathname.replace(/\/+$/, '')];
        return body ? route.fulfill({ contentType: 'text/html', body }) : route.fulfill({ status: 404, body: 'not found' });
      });
      return context;
    },
  };
}

const opts = (dir: string, submit: boolean) => ({ submit, headless: true, screenshotDir: dir });

let browser: Browser;
let tmp: string;
test.beforeAll(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-apply-'));
});
test.afterAll(async () => browser.close());

test('submits a complete Greenhouse application and records the confirmation', async () => {
  const submissions: any[] = [];
  const url = 'https://job-boards.greenhouse.io/acme/jobs/1';
  const result = await applyToJob(routedBrowser(browser, { [url]: fixture('greenhouse.html') }, submissions), { url, title: 'Senior AI Engineer', company: 'Acme AI' }, baseProfile, opts(tmp, true));

  expect(result).toMatchObject({ status: 'submitted', attached: ['resume'], unanswered: [] });
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({
    'job_application[first_name]': 'Ada',
    'job_application[email]': 'ada@example.com',
    'job_application[resume]': 'resume.txt',
    'job_application[answers_attributes][1][boolean_value]': '1',
    'job_application[answers_attributes][2][boolean_value]': '0',
    'job_application[answers_attributes][3][text_value]': 'I want to build Acme AI products.',
    'job_application[gender]': '3',
    'job_application[website_confirm]': '',
  });
});

test('stops for review instead of submitting when a required question has no answer', async () => {
  const submissions: unknown[] = [];
  const url = 'https://job-boards.greenhouse.io/acme/jobs/2';
  const profile = { ...baseProfile, customAnswers: [] };
  const result = await applyToJob(routedBrowser(browser, { [url]: fixture('greenhouse.html') }, submissions), { url, title: 'Senior AI Engineer', company: 'Acme AI' }, profile, opts(tmp, true));

  expect(result.status).toBe('needs-review');
  expect(result.unanswered).toEqual([{ question: 'Why do you want to work at Acme?', status: 'unrecognized' }]);
  expect(fs.existsSync(path.resolve(__dirname, '../..', result.screenshot))).toBe(true);
  expect(submissions).toHaveLength(0);
});

test('opens the Lever /apply form from the posting URL and submits radio/checkbox answers', async () => {
  const submissions: any[] = [];
  const result = await applyToJob(
    routedBrowser(browser, { 'https://jobs.lever.co/acme/abc-123/apply': fixture('lever.html') }, submissions),
    { url: 'https://jobs.lever.co/acme/abc-123', title: 'ML Engineer', company: 'Acme AI' },
    baseProfile,
    opts(tmp, true)
  );

  expect(result.status).toBe('submitted');
  expect(submissions[0]).toMatchObject({ name: 'Ada Lovelace', org: 'Analytical Engines', 'cards[abc][field0]': 'No', 'cards[abc][field2]': 'ack' });
});

test('hands off to a human when a CAPTCHA challenge is showing', async () => {
  const submissions: unknown[] = [];
  const url = 'https://job-boards.greenhouse.io/acme/jobs/3';
  const html = fixture('greenhouse.html').replace(
    '<button type="submit"',
    '<iframe src="https://www.google.com/recaptcha/api2/anchor?k=test" width="304" height="78"></iframe><button type="submit"'
  );
  const result = await applyToJob(routedBrowser(browser, { [url]: html }, submissions), { url, title: 'Senior AI Engineer', company: 'Acme AI' }, baseProfile, opts(tmp, true));

  expect(result.status).toBe('needs-human');
  expect(submissions).toHaveLength(0);
});

test('clicks through from a job description page to the form', async () => {
  const submissions: unknown[] = [];
  const pages = {
    'https://careers.example.com/jobs/7': '<html><body><h1>Platform Engineer</h1><p>About the role</p><a href="/jobs/7/form">Apply now</a></body></html>',
    'https://careers.example.com/jobs/7/form': fixture('greenhouse.html'),
  };
  const result = await applyToJob(routedBrowser(browser, pages, submissions), { url: 'https://careers.example.com/jobs/7', title: 'Platform Engineer', company: 'Example' }, baseProfile, opts(tmp, false));

  expect(result.status).toBe('ready');
  expect(submissions).toHaveLength(0);
});

test('reports no-form when there is nothing to fill', async () => {
  const pages = { 'https://careers.example.com/jobs/8': '<html><body><h1>Role</h1><p>Email jobs@example.com to apply.</p></body></html>' };
  const result = await applyToJob(routedBrowser(browser, pages, []), { url: 'https://careers.example.com/jobs/8', title: 'Role', company: 'Example' }, baseProfile, opts(tmp, true));
  expect(result.status).toBe('no-form');
});
