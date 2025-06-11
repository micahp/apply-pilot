import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { onMessage } from 'webext-bridge/popup';
import EditProfile from './EditProfile';
import ProfileDisplay from './ProfileDisplay';
import { PartialProfile, ATSMessageData, ATSFieldDescriptor } from '../types/profile';
import './styles.css';

const Popup: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PartialProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [detectedATS, setDetectedATS] = useState<string | null>(null);
  const [isOnApplicationPage, setIsOnApplicationPage] = useState<boolean>(false);
  const [showAutoApplyButton, setShowAutoApplyButton] = useState<boolean>(false);
  const [atsFormFields, setAtsFormFields] = useState<ATSFieldDescriptor[] | null>(null);
  const [isWorkExperienceOpen, setIsWorkExperienceOpen] = useState(false);
  const [isOnGreenhouseSite, setIsOnGreenhouseSite] = useState<boolean>(false);

  useEffect(() => {
    chrome.storage.local.get(['profile'], (result) => {
      setLoading(false);
      if (result.profile) {
        setProfile(result.profile);
      } else {
        setIsEditing(true);
      }
    });

    // Check if on Greenhouse for a specific button
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url?.includes('greenhouse.io')) {
        setIsOnGreenhouseSite(true);
      }
    });

    const cleanupAtsAppPage = onMessage<ATSMessageData, 'ats-application-page-detected'>('ats-application-page-detected', ({ data }) => {
      console.log('Popup: ATS Application Page Detected:', data.ats, data.fields);
      setDetectedATS(data.ats);
      setIsOnApplicationPage(true);
      setShowAutoApplyButton(true);
      setAtsFormFields(data.fields || null);
    });

    const cleanupAtsSite = onMessage<ATSMessageData, 'ats-site-detected-not-app-page'>('ats-site-detected-not-app-page', ({ data }) => {
      console.log('Popup: ATS Site Detected (not app page):', data.ats);
      setDetectedATS(data.ats);
      setIsOnApplicationPage(false);
      setShowAutoApplyButton(false);
      setAtsFormFields(null);
    });

    const cleanupNoAts = onMessage('no-ats-detected', () => {
      console.log('Popup: No ATS Detected');
      setDetectedATS(null);
      setIsOnApplicationPage(false);
      setShowAutoApplyButton(false);
      setAtsFormFields(null);
    });

    return () => {
      cleanupAtsAppPage();
      cleanupAtsSite();
      cleanupNoAts();
    };
  }, []);

  const handleSaveProfile = (updatedProfile: PartialProfile) => {
    chrome.storage.local.set({ profile: updatedProfile }, () => {
      setProfile(updatedProfile);
      setIsEditing(false);
    });
  };

  const handleFillPageOrAutoApply = () => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]?.id && profile) {
        const action = isOnApplicationPage && atsFormFields ? 'autoApplyWithATSFields' : 'fillFields';
        const messagePayload: any = {
          action,
          profileData: profile,
        };
        if (action === 'autoApplyWithATSFields') {
          messagePayload.atsFields = atsFormFields;
          messagePayload.atsName = detectedATS;
        }
        chrome.tabs.sendMessage(tabs[0].id, messagePayload);
        console.log(`Sent ${action} to tab ${tabs[0].id}`, messagePayload);
      }
    });
  };

  const openOptionsPage = () => {
    chrome.runtime.openOptionsPage();
  };

  const openJobListingsPage = () => {
    const url = chrome.runtime.getURL('src/jobs/index.html');
    console.log('Opening jobs page at URL:', url);
    chrome.tabs.create({ url });
  };

  if (loading) {
    return <div className="popup loading">Loading profile...</div>;
  }

  return (
    <div className="popup">
      <div className="header">
        <h1>AutoApply</h1>
        <div className="header-buttons">
          <button 
            className="options-btn" 
            onClick={openOptionsPage}
            title="Open full settings page"
          >
            Settings
          </button>
          <button 
            className="jobs-btn"
            onClick={openJobListingsPage}
            title="Find job listings"
          >
            Find Jobs
          </button>
        </div>
      </div>

      <div className="action-header">
        {detectedATS && (
          <p className="ats-info">
            Detected: <strong>{detectedATS}</strong>
            {isOnApplicationPage ? " (Application Page)" : detectedATS ? " (Site)" : ""}
          </p>
        )}
        {/* Greenhouse-specific button */}
        {isOnGreenhouseSite && profile && (
          <button
            className="fill-btn primary-action greenhouse-btn"
            onClick={handleFillPageOrAutoApply}
            title="Fill Greenhouse page with your profile data"
          >
            Autofill Greenhouse Page
          </button>
        )}
        {/* Generic AutoApply button (will not show if Greenhouse button is shown and we hide it) */}
        {!isOnGreenhouseSite && showAutoApplyButton && profile && (
          <button
            className="fill-btn primary-action"
            onClick={handleFillPageOrAutoApply}
            title={isOnApplicationPage && atsFormFields ? `Auto-fill ${detectedATS} application with your profile` : "Fill page with your profile data"}
          >
            {isOnApplicationPage && detectedATS ? `Auto Apply to ${detectedATS}` : "Fill Current Page"}
          </button>
        )}
      </div>

      <div className="content">
        {isEditing || !profile ? (
          <EditProfile 
            initialProfile={profile || {}} 
            onSave={handleSaveProfile} 
            onCancel={profile ? () => setIsEditing(false) : undefined}
          />
        ) : (
          <ProfileDisplay 
            profile={profile} 
            onEdit={() => setIsEditing(true)}
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