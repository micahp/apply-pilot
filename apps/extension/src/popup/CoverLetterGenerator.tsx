import React, { useState, useEffect } from 'react';
import { PartialProfile } from '../types/profile';
import { LLMTailor, type JobDescription, type GeneratedCoverLetter } from '../utils/llm-tailor';
import './styles.css';

interface CoverLetterGeneratorProps {
  profile: PartialProfile | null;
  onBack: () => void;
}

const CoverLetterGenerator: React.FC<CoverLetterGeneratorProps> = ({ profile, onBack }) => {
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedCoverLetter | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load API key from storage
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['openaiApiKey'], (result) => {
        if (result.openaiApiKey) setApiKey(result.openaiApiKey);
      });
    }
  }, []);

  // Try to scrape job info from current page
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'getJobInfo' }, (response) => {
            if (response) {
              if (response.title) setJobTitle(response.title);
              if (response.company) setCompany(response.company);
              if (response.description) setJobDescription(response.description);
            }
          });
        }
      });
    }
  }, []);

  const handleGenerate = async () => {
    if (!apiKey) {
      setError('Please enter your OpenAI API key below.');
      return;
    }
    if (!jobDescription.trim()) {
      setError('Please enter a job description.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Save API key
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ openaiApiKey: apiKey });
      }

      const tailor = new LLMTailor({ apiKey });
      
      const job: JobDescription = {
        title: jobTitle || 'Position',
        company: company || 'the company',
        description: jobDescription,
      };

      const profileData = {
        name: `${profile?.personal?.firstName || 'Micah'} ${profile?.personal?.lastName || 'Peoples'}`,
        currentRole: profile?.workExperience?.[0]?.title || 'AI/Full-Stack Engineer',
        yearsExperience: 8,
        keySkills: (profile?.skills || []).map((s: any) => typeof s === 'string' ? s : s.name),
        topAchievements: (profile?.workExperience || []).slice(0, 3).map((exp: any) => ({
          title: `${exp.title} at ${exp.company}`,
          bullets: exp.description ? [exp.description] : [],
        })),
        education: {
          degree: profile?.education?.[0]?.degree || "Bachelor's in Computer Science",
          school: profile?.education?.[0]?.institution || 'University of Texas at Austin',
        },
      };

      const coverLetter = await tailor.generateCoverLetter(job, profileData);
      setResult(coverLetter);
    } catch (err: any) {
      setError(err.message || 'Failed to generate cover letter');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      const text = `${result.subject}\n\n${result.body}`;
      navigator.clipboard.writeText(text).then(() => {
        // Brief feedback
      });
    }
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
            <label>OpenAI API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
            <span className="form-hint">Stored locally, never shared</span>
          </div>

          <div className="form-group">
            <label>Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g., Senior AI Engineer"
            />
          </div>

          <div className="form-group">
            <label>Company</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g., Anthropic"
            />
          </div>

          <div className="form-group">
            <label>Job Description</label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description here..."
              rows={8}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            className="primary-btn generate-btn"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : '✨ Generate Cover Letter'}
          </button>
        </div>
      ) : (
        <div className="cl-result">
          <div className="cl-fit-score">
            Job Fit: <strong>{result.fitScore}%</strong>
          </div>

          <div className="cl-section">
            <label>Subject</label>
            <div className="cl-text">{result.subject}</div>
          </div>

          <div className="cl-section">
            <label>Cover Letter</label>
            <div className="cl-text cl-body">{result.body}</div>
          </div>

          {result.highlights.length > 0 && (
            <div className="cl-section">
              <label>Key Highlights</label>
              <ul className="cl-highlights">
                {result.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="cl-actions">
            <button className="primary-btn" onClick={handleCopy}>
              📋 Copy to Clipboard
            </button>
            <button className="secondary-btn" onClick={() => setResult(null)}>
              Generate Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoverLetterGenerator;
