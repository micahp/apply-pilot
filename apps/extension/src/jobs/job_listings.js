/**
 * Job Listings Display
 * 
 * Fetches and displays AI/LLM job listings from the scraper.
 * Features: search/filter, source filtering, relevance scoring, deep link to apply.
 */

// ─── State ──────────────────────────────────────────────────────────

let allJobs = [];
let filteredJobs = [];
let isLoading = false;

// ─── DOM Elements ───────────────────────────────────────────────────

const container = document.getElementById('job-listings-container');
const statusEl = document.getElementById('status');
const statsEl = document.getElementById('stats');
const searchInput = document.getElementById('search-input');
const sourceFilter = document.getElementById('source-filter');
const refreshBtn = document.getElementById('refresh-btn');

// ─── API ────────────────────────────────────────────────────────────

/**
 * Fetch jobs from the scraper endpoint or local cache
 */
async function fetchJobs() {
  if (isLoading) return;
  isLoading = true;
  refreshBtn.disabled = true;
  statusEl.innerHTML = '<span class="loading-spinner"></span> Searching for AI/LLM jobs...';
  statusEl.className = '';

  try {
    // Try to load from pre-scraped JSON first (shipped with extension)
    // In production, this would check extension storage or call a backend
    const jobs = await loadJobs();
    allJobs = jobs;
    filterAndRender();
  } catch (error) {
    statusEl.textContent = `Error loading jobs: ${error.message}`;
    statusEl.className = 'error';
  } finally {
    isLoading = false;
    refreshBtn.disabled = false;
  }
}

/**
 * Load jobs from multiple fallback sources
 */
async function loadJobs() {
  // 1. Try extension storage (cached scrape results)
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['scrapedJobs', 'scrapedJobsTimestamp'], resolve);
      });
      
      if (result.scrapedJobs && Array.isArray(result.scrapedJobs) && result.scrapedJobs.length > 0) {
        const age = Date.now() - (result.scrapedJobsTimestamp || 0);
        if (age < 24 * 60 * 60 * 1000) { // Less than 24h old
          console.log(`[Jobs] Loaded ${result.scrapedJobs.length} jobs from cache (${Math.round(age/3600000)}h old)`);
          return result.scrapedJobs;
        }
      }
    }
  } catch (e) {
    console.log('[Jobs] Storage not available:', e.message);
  }

  // 2. Try to fetch live from our bundled endpoint
  try {
    const response = await fetch('job-data.json');
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log(`[Jobs] Loaded ${data.length} jobs from bundled data`);
        return data;
      }
    }
  } catch (e) {
    console.log('[Jobs] Bundled data not available:', e.message);
  }

  // 3. Fallback: show sample AI company jobs
  console.log('[Jobs] Using fallback job data');
  return getFallbackJobs();
}

/**
 * Fallback job listings for well-known AI companies
 */
function getFallbackJobs() {
  const now = new Date().toISOString();
  return [
    {
      id: 'fb-anthropic-1',
      title: 'Research Engineer, LLMs',
      company: 'Anthropic',
      location: 'San Francisco, CA',
      description: 'Work on frontier language models. Design and run experiments to improve Claude\'s capabilities in reasoning, coding, and tool use. Collaborate with researchers on novel architectures.',
      url: 'https://www.anthropic.com/careers',
      source: 'Anthropic Careers',
      score: 95,
      postedAt: now,
    },
    {
      id: 'fb-openai-1',
      title: 'Software Engineer, ChatGPT',
      company: 'OpenAI',
      location: 'San Francisco, CA',
      description: 'Build features for ChatGPT used by hundreds of millions. Work across the full stack — from model inference optimization to UI performance — to deliver magical AI experiences.',
      url: 'https://openai.com/careers',
      source: 'OpenAI Careers',
      score: 90,
      postedAt: now,
    },
    {
      id: 'fb-scale-1',
      title: 'ML Engineer, Gen AI',
      company: 'Scale AI',
      location: 'San Francisco, CA / Remote',
      description: 'Build and optimize data pipelines for training frontier models. Work on RLHF, data quality, and evaluation frameworks. Ship improvements that directly impact model performance.',
      url: 'https://scale.com/careers',
      source: 'Scale AI Careers',
      score: 88,
      postedAt: now,
    },
    {
      id: 'fb-perplexity-1',
      title: 'Full-Stack Engineer, AI Products',
      company: 'Perplexity',
      location: 'San Francisco, CA',
      description: 'Build the next generation of AI-powered search. Work on real-time systems, streaming responses, and citation accuracy. Ship features to millions of daily users.',
      url: 'https://www.perplexity.ai/careers',
      source: 'Perplexity Careers',
      score: 85,
      postedAt: now,
    },
    {
      id: 'fb-notion-1',
      title: 'AI Engineer',
      company: 'Notion',
      location: 'San Francisco, CA / New York, NY',
      description: 'Build Notion AI features like Q&A, autofill, and writing assistant. Work with LLMs, RAG pipelines, and embeddings to make knowledge work faster.',
      url: 'https://www.notion.so/careers',
      source: 'Notion Careers',
      score: 82,
      postedAt: now,
    },
    {
      id: 'fb-cohere-1',
      title: 'Senior ML Engineer, Foundation Models',
      company: 'Cohere',
      location: 'Toronto / San Francisco / Remote',
      description: 'Train and deploy large language models for enterprise customers. Optimize training pipelines, improve inference latency, and build custom model serving infrastructure.',
      url: 'https://cohere.com/careers',
      source: 'Cohere Careers',
      score: 92,
      postedAt: now,
    },
    {
      id: 'fb-mistral-1',
      title: 'Research Engineer',
      company: 'Mistral AI',
      location: 'Paris, France / Remote',
      description: 'Advance the state of open-weight models. Work on pretraining, fine-tuning, and efficient inference. Contribute to cutting-edge research in model architecture and training.',
      url: 'https://mistral.ai/careers',
      source: 'Mistral Careers',
      score: 90,
      postedAt: now,
    },
    {
      id: 'fb-hf-1',
      title: 'ML Engineer, Open Source AI',
      company: 'Hugging Face',
      location: 'Remote (US/EU)',
      description: 'Build tools and infrastructure for the open-source ML community. Improve transformers, diffusers, and text-generation-inference libraries. Ship features used by millions of developers.',
      url: 'https://apply.workable.com/huggingface',
      source: 'Hugging Face Careers',
      score: 87,
      postedAt: now,
    },
    {
      id: 'fb-vercel-1',
      title: 'AI Engineer, v0',
      company: 'Vercel',
      location: 'Remote (US)',
      description: 'Build v0 — the AI-powered UI generation tool. Work with LLMs to generate production-ready React components. Push the boundaries of AI-assisted development.',
      url: 'https://vercel.com/careers',
      source: 'Vercel Careers',
      score: 80,
      postedAt: now,
    },
    {
      id: 'fb-elevenlabs-1',
      title: 'Applied AI Engineer',
      company: 'ElevenLabs',
      location: 'London / New York / Remote',
      description: 'Build voice AI products used by creators and enterprises. Work on text-to-speech, voice cloning, and real-time audio generation. Ship product features end-to-end.',
      url: 'https://elevenlabs.io/careers',
      source: 'ElevenLabs Careers',
      score: 83,
      postedAt: now,
    },
    {
      id: 'fb-langchain-1',
      title: 'Software Engineer, LangSmith',
      company: 'LangChain',
      location: 'San Francisco, CA / Remote',
      description: 'Build the observability and evaluation platform for LLM applications. Work on tracing, testing, and prompt management tools. Ship features that improve LLM app reliability.',
      url: 'https://www.langchain.com/careers',
      source: 'LangChain Careers',
      score: 85,
      postedAt: now,
    },
    {
      id: 'fb-character-1',
      title: 'ML Engineer, Model Training',
      company: 'Character.AI',
      location: 'Menlo Park, CA',
      description: 'Train and fine-tune large language models for conversational AI. Work on RLHF, SFT, and novel training techniques. Improve model personality, safety, and engagement.',
      url: 'https://character.ai/careers',
      source: 'Character.AI Careers',
      score: 88,
      postedAt: now,
    },
    {
      id: 'fb-replit-1',
      title: 'AI Engineer',
      company: 'Replit',
      location: 'San Francisco, CA / Remote',
      description: 'Build AI-powered coding features in the Replit IDE. Work on code generation, autocomplete, and agent-based development tools. Ship to millions of developers.',
      url: 'https://replit.com/site/careers',
      source: 'Replit Careers',
      score: 84,
      postedAt: now,
    },
    {
      id: 'fb-pinecone-1',
      title: 'Software Engineer, Vector Database',
      company: 'Pinecone',
      location: 'New York, NY / Remote',
      description: 'Build the leading vector database powering AI applications. Work on distributed systems, query optimization, and embedding storage at scale.',
      url: 'https://www.pinecone.io/careers',
      source: 'Pinecone Careers',
      score: 78,
      postedAt: now,
    },
    {
      id: 'fb-together-1',
      title: 'Systems Engineer, AI Infrastructure',
      company: 'Together AI',
      location: 'San Francisco, CA / Remote',
      description: 'Build the fastest inference engine for open-source models. Optimize GPU utilization, distributed inference, and model serving infrastructure. Ship to thousands of developers.',
      url: 'https://www.together.ai/careers',
      source: 'Together AI Careers',
      score: 82,
      postedAt: now,
    },
  ];
}

// ─── Filter & Render ────────────────────────────────────────────────

function filterAndRender() {
  const searchTerm = (searchInput?.value || '').toLowerCase();
  const sourceValue = sourceFilter?.value || 'all';

  filteredJobs = allJobs.filter(job => {
    // Source filter
    if (sourceValue !== 'all' && job.source !== sourceValue) return false;

    // Search filter
    if (searchTerm) {
      const searchable = [
        job.title, job.company, job.location, job.description, job.source
      ].join(' ').toLowerCase();
      if (!searchable.includes(searchTerm)) return false;
    }

    return true;
  });

  renderJobs(filteredJobs);
}

function renderJobs(jobs) {
  // Update stats
  if (statsEl) {
    const sources = [...new Set(jobs.map(j => j.source))];
    const avgScore = jobs.length > 0
      ? Math.round(jobs.reduce((sum, j) => sum + (j.score || 0), 0) / jobs.length)
      : 0;
    statsEl.textContent = `${jobs.length} jobs found across ${sources.length} sources · avg match: ${avgScore}%`;
  }

  if (jobs.length === 0) {
    container.innerHTML = '<div id="status">No matching jobs found. Try adjusting your filters.</div>';
    return;
  }

  // Populate source filter
  if (sourceFilter) {
    const allSources = [...new Set(allJobs.map(j => j.source))].sort();
    sourceFilter.innerHTML = '<option value="all">All Sources</option>' +
      allSources.map(s => `<option value="${s}">${s}</option>`).join('');
  }

  // Render job cards
  container.innerHTML = jobs.map(job => {
    const scoreClass = (job.score || 0) >= 80 ? 'high' : (job.score || 0) >= 50 ? 'medium' : 'low';
    const timeAgo = job.postedAt ? formatTimeAgo(job.postedAt) : '';

    return `
      <div class="job-card">
        <div class="job-card-header">
          <div>
            <div class="job-title">
              <a href="${escapeHtml(job.url)}" target="_blank" rel="noopener">${escapeHtml(job.title)}</a>
            </div>
            <div class="job-company">${escapeHtml(job.company)}</div>
          </div>
          <span class="job-score ${scoreClass}">${job.score || '?'}% match</span>
        </div>
        <div class="job-meta">
          <span>📍 ${escapeHtml(job.location || 'Remote')}</span>
          ${timeAgo ? `<span>🕐 ${timeAgo}</span>` : ''}
          <span class="job-source">${escapeHtml(job.source)}</span>
        </div>
        ${job.description ? `<div class="job-description">${escapeHtml(job.description)}</div>` : ''}
        <div class="job-actions">
          <button class="primary" onclick="window.open('${escapeHtml(job.url)}', '_blank')">Apply Now →</button>
          <button onclick="copyToClipboard('${escapeHtml(job.url)}')">Copy Link</button>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Helpers ────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTimeAgo(dateStr) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return '';
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  } catch {
    return '';
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      // Brief visual feedback
      const btns = document.querySelectorAll('button');
      btns.forEach(b => {
        if (b.textContent === 'Copied!') b.textContent = 'Copy Link';
      });
    });
  }
}

// ─── Init ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Event listeners
  if (searchInput) {
    searchInput.addEventListener('input', debounce(filterAndRender, 300));
  }
  if (sourceFilter) {
    sourceFilter.addEventListener('change', filterAndRender);
  }
  if (refreshBtn) {
    refreshBtn.addEventListener('click', fetchJobs);
  }

  // Initial load
  fetchJobs();
});

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
