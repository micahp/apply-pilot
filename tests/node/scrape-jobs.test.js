const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { htmlToText, parseAshby, parseGreenhouse, parseHnItem, parseLever, rankJobs, scoreJob } = require('../../scripts/scrape-jobs.js');

// Trimmed real responses captured from each public API.
const api = (name) => require(path.join(__dirname, '../fixtures/api', name));

test('htmlToText decodes Greenhouse entity-escaped HTML', () => {
  assert.equal(htmlToText('&lt;h2&gt;&lt;strong&gt;About Anthropic&lt;/strong&gt;&lt;/h2&gt;&lt;p&gt;Safe &amp;amp; useful&lt;/p&gt;'), 'About Anthropic\nSafe & useful');
  assert.equal(htmlToText('TypeScript &#x2F; Postgres &#x27;24'), "TypeScript / Postgres '24");
});

test('parses a real Greenhouse board', () => {
  const jobs = parseGreenhouse(api('greenhouse.json'), { name: 'Anthropic', slug: 'anthropic' });
  assert.equal(jobs.length, 4);
  assert.match(jobs[0].url, /^https:\/\/job-boards\.greenhouse\.io\/anthropic\/jobs\/\d+$/);
  assert.equal(jobs[0].company, 'Anthropic');
  assert.ok(jobs[0].location);
  assert.ok(!jobs[0].description.includes('&lt;'), 'description is decoded plain text');
});

test('parses a real Lever board', () => {
  const jobs = parseLever(api('lever.json'), { name: 'Palantir', slug: 'palantir' });
  assert.equal(jobs.length, 4);
  assert.match(jobs[0].url, /^https:\/\/jobs\.lever\.co\/palantir\//);
  assert.equal(jobs[0].location, 'Singapore, Singapore');
  assert.equal(jobs[0].department, 'Administrative');
});

test('parses a real Ashby board', () => {
  const jobs = parseAshby(api('ashby.json'), { name: 'OpenAI', slug: 'openai' });
  assert.equal(jobs.length, 4);
  assert.match(jobs[0].url, /^https:\/\/jobs\.ashbyhq\.com\/openai\//);
  assert.equal(jobs[0].location, 'San Francisco');
  assert.match(jobs[0].compensation, /\$/);
});

test('parses HN "Who is hiring?" comment headers', () => {
  const jobs = parseHnItem(api('hn-item.json'));
  assert.ok(jobs.length >= 4);
  const sidekick = jobs.find((j) => j.company === 'Sidekick Labs');
  assert.ok(sidekick);
  assert.match(sidekick.title, /Engineer/);
  assert.equal(sidekick.remote, true);
  assert.match(sidekick.discussionUrl, /news\.ycombinator\.com\/item\?id=\d+/);
});

test('scoreJob matches whole words only and weights titles', () => {
  assert.equal(scoreJob('Maintenance Coordinator', 'maintain the brain trail').score, 0);
  const ml = scoreJob('Machine Learning Engineer', 'Train LLM models with PyTorch');
  assert.ok(ml.score >= 40);
  assert.deepEqual(ml.matched.sort(), ['llm', 'machine learning', 'pytorch']);
  assert.ok(scoreJob('Engineer', 'ai '.repeat(50) + 'llm rag pytorch evals agents inference embeddings mlops nlp').score <= 40, 'description alone caps at 40');
});

test('rankJobs dedupes, drops non-engineering roles, filters location', () => {
  const base = { description: 'LLM agents', remote: false };
  const jobs = [
    { ...base, url: 'a', title: 'ML Engineer', location: 'Austin, TX' },
    { ...base, url: 'a', title: 'ML Engineer', location: 'Austin, TX' },
    { ...base, url: 'b', title: 'Recruiter, AI/ML Research', location: 'Austin, TX' },
    { ...base, url: 'c', title: 'AI Engineer', location: 'Berlin' },
    { ...base, url: 'd', title: 'AI Engineer', location: 'Anywhere', remote: true },
  ];
  const ranked = rankJobs(jobs, { keywords: ['ml', 'ai', 'llm'], location: 'austin|remote', minScore: 0, anyRole: false });
  assert.deepEqual(ranked.map((j) => j.url).sort(), ['a', 'd']);
});
