const fastify = require('fastify')({ logger: true });
const path = require('path');
const cors = require('@fastify/cors');
const staticPlugin = require('@fastify/static');

const fetchFn =
  typeof fetch === 'function'
    ? fetch
    : (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const PORT = process.env.PORT || 3001;

fastify.register(cors, { origin: true });
fastify.register(staticPlugin, {
  root: path.join(__dirname, 'public'),
  prefix: '/',
});

fastify.get('/api/jobs', async (request, reply) => {
  const jobs = [];
  try {
    const leverJobs = await fetchLeverJobs(process.env.LEVER_SLUG || 'lever');
    jobs.push(...leverJobs);
  } catch (err) {
    fastify.log.error(err);
  }
  try {
    const ghJobs = await fetchGreenhouseJobs(process.env.GREENHOUSE_SLUG || 'greenhouse');
    jobs.push(...ghJobs);
  } catch (err) {
    fastify.log.error(err);
  }
  try {
    const workableJobs = await fetchWorkableJobs(process.env.WORKABLE_SLUG || 'workable');
    jobs.push(...workableJobs);
  } catch (err) {
    fastify.log.error(err);
  }
  reply.send({ jobs });
});

async function fetchLeverJobs(company) {
  const url = `https://api.lever.co/v0/postings/${company}?mode=json`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`Lever fetch failed: ${res.status}`);
  const data = await res.json();
  return data.map(j => ({
    title: j.text,
    url: j.applyUrl,
    location: j.categories.location,
    source: 'Lever'
  }));
}

async function fetchGreenhouseJobs(company) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`Greenhouse fetch failed: ${res.status}`);
  const data = await res.json();
  return data.jobs.map(j => ({
    title: j.title,
    url: j.absolute_url,
    location: j.location?.name || 'Unknown',
    source: 'Greenhouse'
  }));
}

async function fetchWorkableJobs(company) {
  const url = `https://apply.workable.com/api/v1/widget/${company}?format=json`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`Workable fetch failed: ${res.status}`);
  const data = await res.json();
  return data.results.map(j => ({
    title: j.title,
    url: j.url,
    location: j.location?.text || 'Unknown',
    source: 'Workable'
  }));
}

fastify.get('/', async (request, reply) => {
  return reply.sendFile('index.html');
});

fastify.listen({ port: PORT, host: '0.0.0.0' }, err => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Server listening on port ${PORT}`);
});
