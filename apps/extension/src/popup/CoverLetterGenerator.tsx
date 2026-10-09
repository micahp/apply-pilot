import React, { useEffect, useState } from 'react';
import type { PartialProfile } from '../types/profile';
import type { JobInfo } from '../autofill';
import { normalizeProfile } from '../autofill/profile';
import { DEFAULT_MODELS, generateCoverLetter, type GeneratedCoverLetter, type LLMProvider } from '../utils/llm-tailor';
import './styles.css';

interface CoverLetterGeneratorProps {
  profile: PartialProfile | null;
  onBack: () => void;
}

const KEY_STORAGE: Record<LLMProvider, string> = { anthropic: 'anthropicApiKey', openai: 'openaiApiKey' };

const CoverLetterGenerator: React.FC<CoverLetterGeneratorProps> = ({ profile, onBack }) => {
  const [provider, setProvider] = useState<LLMProvider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedCoverLetter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(['llmProvider', ...Object.values(KEY_STORAGE)], (stored) => {
      const p: LLMProvider = stored.llmProvider === 'openai' ? 'openai' : 'anthropic';
      setProvider(p);
      setApiKey(stored[KEY_STORAGE[p]] || '');
    });

    // Prefill from the job posting open in the current tab, when there is one.
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getJobInfo' }, (info: JobInfo | undefined) => {
        if (chrome.runtime.lastError || !info) return;
        setJobTitle((v) => v || info.title);
        setCompany((v) => v || info.company);
        setLocation((v) => v || info.location);
        setJobDescription((v) => v || info.description);
      });
    });
  }, []);

  const switchProvider = (p: LLMProvider) => {
    setProvider(p);
    chrome.storage.local.get([KEY_STORAGE[p]], (stored) => setApiKey(stored[KEY_STORAGE[p]] || ''));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      chrome.storage.local.set({ llmProvider: provider, [KEY_STORAGE[provider]]: apiKey });
      const letter = await generateCoverLetter(
        { provider, apiKey },
        { title: jobTitle, company, location, description: jobDescription },
        normalizeProfile(profile || {})
      );
      setResult(letter);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="cover-letter-generator">
      <div className="cl-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>Tailor Cover Letter</h2>
      </div>

      {!result ? (
        <div className="cl-form">
          <div className="form-group">
            <label htmlFor="cl-provider">Model provider</label>
            <select id="cl-provider" value={provider} onChange={(e) => switchProvider(e.target.value as LLMProvider)}>
              <option value="anthropic">Claude ({DEFAULT_MODELS.anthropic})</option>
              <option value="openai">OpenAI ({DEFAULT_MODELS.openai})</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="cl-key">API key</label>
            <input id="cl-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'} />
            <span className="form-hint">Stored in this browser only; sent only to the provider.</span>
          </div>
          <div className="form-group">
            <label htmlFor="cl-title">Job title</label>
            <input id="cl-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="cl-company">Company</label>
            <input id="cl-company" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="cl-desc">Job description</label>
            <textarea id="cl-desc" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the job description here..." rows={8} />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button className="primary-btn generate-btn" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? 'Generating…' : 'Generate cover letter'}
          </button>
        </div>
      ) : (
        <div className="cl-result">
          <div className="cl-section">
            <label>Cover letter</label>
            <div className="cl-text cl-body">{result.body}</div>
          </div>
          {result.highlights.length > 0 && (
            <div className="cl-section">
              <label>Built from these profile facts (check them)</label>
              <ul className="cl-highlights">
                {result.highlights.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}
          <div className="cl-actions">
            <button className="primary-btn" onClick={handleCopy}>{copied ? 'Copied' : 'Copy to clipboard'}</button>
            <button className="secondary-btn" onClick={() => setResult(null)}>Generate another</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoverLetterGenerator;
