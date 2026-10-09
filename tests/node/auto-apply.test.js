const test = require('node:test');
const assert = require('node:assert/strict');
const { applicationUrl, decide, detectPlatform, selectJobs } = require('../../scripts/auto-apply-playwright.js');

test('applicationUrl goes straight to each platform form', () => {
  assert.equal(applicationUrl('https://jobs.lever.co/acme/123'), 'https://jobs.lever.co/acme/123/apply');
  assert.equal(applicationUrl('https://jobs.lever.co/acme/123/apply'), 'https://jobs.lever.co/acme/123/apply');
  assert.equal(applicationUrl('https://jobs.ashbyhq.com/openai/abc'), 'https://jobs.ashbyhq.com/openai/abc/application');
  assert.equal(applicationUrl('https://job-boards.greenhouse.io/anthropic/jobs/1'), 'https://job-boards.greenhouse.io/anthropic/jobs/1');
  assert.equal(detectPlatform('https://boards.greenhouse.io/x/jobs/1'), 'greenhouse');
});

test('selectJobs never re-applies to submitted jobs and only retries when asked', () => {
  const jobs = [
    { url: 'a', score: 90 },
    { url: 'b', score: 80 },
    { url: 'c', score: 70, location: 'Berlin' },
    { url: 'd', score: 10 },
  ];
  const previous = new Map([['a', { status: 'submitted' }], ['b', { status: 'needs-review' }]]);
  const base = { minScore: 20, limit: 10, retry: false };
  assert.deepEqual(selectJobs(jobs, previous, base).map((j) => j.url), ['c']);
  assert.deepEqual(selectJobs(jobs, previous, { ...base, retry: true }).map((j) => j.url), ['b', 'c']);
  assert.deepEqual(selectJobs(jobs, new Map(), { ...base, location: 'austin' }).map((j) => j.url), []);
});

test('decide only clears a form for submission when nothing blocks it', () => {
  const clean = { captcha: { blocking: false, kinds: [] }, requiredUnanswered: [] };
  assert.equal(decide(clean).status, 'ready');
  assert.equal(decide({ ...clean, requiredUnanswered: [{}] }).status, 'needs-review');
  assert.equal(decide({ ...clean, captcha: { blocking: true, kinds: ['hcaptcha'] } }).status, 'needs-human');
});
