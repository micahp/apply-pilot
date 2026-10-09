import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import EditProfile from './EditProfile';
import ProfileDisplay from './ProfileDisplay';
import CoverLetterGenerator from './CoverLetterGenerator';
import type { PartialProfile } from '../types/profile';
import type { FillReport } from '../autofill';
import './styles.css';

type FillState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; report: FillReport }
  | { kind: 'error'; message: string };

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

const Popup: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PartialProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [detectedATS, setDetectedATS] = useState<string | null>(null);
  const [isWorkExperienceOpen, setIsWorkExperienceOpen] = useState(false);
  const [fillState, setFillState] = useState<FillState>({ kind: 'idle' });
  const [notice, setNotice] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chrome.storage.local.get(['profile'], (result) => {
      setLoading(false);
      if (result.profile) setProfile(result.profile);
      else setIsEditing(true);
    });

    activeTabId().then((tabId) => {
      if (!tabId) return;
      chrome.tabs.sendMessage(tabId, { action: 'checkATS' }, (response) => {
        // No content script on this page (not an ATS site): lastError is expected.
        if (chrome.runtime.lastError) return;
        if (response?.detected) setDetectedATS(response.ats);
      });
    });
  }, []);

  const saveProfile = (updated: PartialProfile) => {
    chrome.storage.local.set({ profile: updated }, () => {
      if (chrome.runtime.lastError) {
        setNotice(`Could not save: ${chrome.runtime.lastError.message}`);
        return;
      }
      setProfile(updated);
      setIsEditing(false);
    });
  };

  const fillPage = async () => {
    const tabId = await activeTabId();
    if (!tabId) return;
    setFillState({ kind: 'running' });
    chrome.tabs.sendMessage(tabId, { action: 'fillFields' }, (response) => {
      if (chrome.runtime.lastError) {
        setFillState({ kind: 'error', message: 'AutoApply is not running on this page. Reload the page and try again.' });
      } else if (!response?.success) {
        setFillState({ kind: 'error', message: response?.error || 'Autofill failed.' });
      } else {
        setFillState({ kind: 'done', report: response.report });
      }
    });
  };

  const exportProfile = () => {
    if (!profile) return;
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'profile.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importProfile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !parsed.personal) throw new Error('missing "personal" section');
      saveProfile(parsed);
      setNotice(`Imported ${file.name}`);
    } catch (error) {
      setNotice(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (loading) return <div className="popup loading">Loading profile...</div>;

  return (
    <div className="popup">
      <div className="header">
        <h1>AutoApply</h1>
        <div className="header-buttons">
          <button className="options-btn" onClick={() => importInput.current?.click()} title="Load a profile.json (same format as the auto-apply script)">
            Import
          </button>
          <button className="options-btn" onClick={exportProfile} disabled={!profile} title="Save your profile as profile.json for the auto-apply script">
            Export
          </button>
          <button className="jobs-btn" onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/jobs/index.html') })}>
            Find Jobs
          </button>
          <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={(e) => importProfile(e.target.files?.[0])} />
        </div>
      </div>

      {notice && <p className="form-hint">{notice}</p>}

      {detectedATS && profile && (
        <div className="action-header">
          <p className="ats-info">Detected: <strong>{detectedATS}</strong></p>
          <button className="fill-btn primary-action" onClick={fillPage} disabled={fillState.kind === 'running'}>
            {fillState.kind === 'running' ? 'Filling…' : 'Autofill this application'}
          </button>
          {fillState.kind === 'error' && <div className="error-message">{fillState.message}</div>}
          {fillState.kind === 'done' && (
            <div className="fill-report">
              <p>Filled {fillState.report.filled} fields.</p>
              {fillState.report.requiredUnanswered.length > 0 && (
                <>
                  <p>Required questions still unanswered:</p>
                  <ul>
                    {fillState.report.requiredUnanswered.map((f) => (
                      <li key={f.id}>{f.question || '(unlabeled field)'}</li>
                    ))}
                  </ul>
                  <p className="form-hint">Add custom answers in your profile to fill these next time.</p>
                </>
              )}
              {fillState.report.captcha.blocking && <p className="error-message">Solve the CAPTCHA on the page before submitting.</p>}
            </div>
          )}
        </div>
      )}

      <div className="content">
        {showCoverLetter ? (
          <CoverLetterGenerator profile={profile} onBack={() => setShowCoverLetter(false)} />
        ) : isEditing || !profile ? (
          <EditProfile initialProfile={profile || {}} onSave={saveProfile} onCancel={profile ? () => setIsEditing(false) : undefined} />
        ) : (
          <ProfileDisplay
            profile={profile}
            onEdit={() => setIsEditing(true)}
            onGenerateCoverLetter={() => setShowCoverLetter(true)}
            isWorkExperienceOpen={isWorkExperienceOpen}
            toggleWorkExperience={() => setIsWorkExperienceOpen(!isWorkExperienceOpen)}
          />
        )}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
