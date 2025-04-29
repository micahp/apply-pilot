import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import EditProfile from './EditProfile';
import ProfileDisplay from './ProfileDisplay';
import { PartialProfile } from '../types/profile';
import './styles.css';

const Popup: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PartialProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    // Load profile from storage when component mounts
    chrome.storage.local.get(['profile'], (result) => {
      setLoading(false);
      if (result.profile) {
        setProfile(result.profile);
      }
    });
  }, []);

  const handleSaveProfile = (updatedProfile: PartialProfile) => {
    chrome.storage.local.set({ profile: updatedProfile }, () => {
      setProfile(updatedProfile);
      setIsEditing(false);
    });
  };

  const handleFillPage = () => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]?.id && profile) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'fillFields',
          profileData: profile
        });
      }
    });
  };

  const openOptionsPage = () => {
    chrome.runtime.openOptionsPage();
  };

  if (loading) {
    return <div className="loading">Loading profile...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="popup">
      <div className="header">
        <h1>AutoApply</h1>
        <div className="header-buttons">
          <button 
            className="options-btn" 
            onClick={openOptionsPage}
          >
            Full Settings
          </button>
        </div>
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
            onFillPage={handleFillPage}
          />
        )}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />); 