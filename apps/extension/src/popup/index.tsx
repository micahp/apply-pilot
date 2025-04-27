import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import ProfileForm from './ProfileForm';
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
          {profile && !isEditing && (
            <button 
              className="settings-btn" 
              onClick={() => setIsEditing(true)}
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>
      <div className="content">
        {isEditing || !profile ? (
          <ProfileForm 
            initialProfile={profile || {}} 
            onSubmit={handleSaveProfile} 
            onCancel={profile ? () => setIsEditing(false) : undefined}
          />
        ) : (
          <div className="profile-display">
            <div className="profile-section">
              <h2>Personal Information</h2>
              <div className="info-grid">
                <div className="info-item">
                  <div className="info-label">Name</div>
                  <div className="info-value">{profile.personal?.firstName} {profile.personal?.lastName}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Email</div>
                  <div className="info-value email-value">{profile.personal?.email || 'Not provided'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Phone</div>
                  <div className="info-value">{profile.personal?.phone || 'Not provided'}</div>
                </div>
              </div>
            </div>

            {profile.workExperience && profile.workExperience.length > 0 && (
              <div className="profile-section">
                <h2>Work Experience</h2>
                {profile.workExperience.map((exp, index) => (
                  <div key={index} className="experience-item">
                    <h3>{exp.title}</h3>
                    <div className="experience-details">
                      <div className="experience-company">{exp.company}</div>
                      {exp.startDate && (
                        <div className="experience-dates">
                          {exp.startDate} {exp.endDate ? `- ${exp.endDate}` : '- Present'}
                        </div>
                      )}
                    </div>
                    {exp.description && (
                      <div className="experience-description">{exp.description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {profile.education && profile.education.length > 0 && (
              <div className="profile-section">
                <h2>Education</h2>
                {profile.education.map((edu, index) => (
                  <div key={index} className="education-item">
                    <h3>{edu.degree}</h3>
                    <div className="education-details">
                      <div className="education-institution">{edu.institution}</div>
                      {edu.startDate && (
                        <div className="education-dates">
                          {edu.startDate} {edu.endDate ? `- ${edu.endDate}` : '- Present'}
                        </div>
                      )}
                      {edu.fieldOfStudy && (
                        <div className="education-field">{edu.fieldOfStudy}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {profile.skills && profile.skills.length > 0 && (
              <div className="profile-section">
                <h2>Skills</h2>
                <div className="skills-list">
                  {profile.skills.map((skill, index) => (
                    <div key={index} className="skill-tag">
                      {typeof skill === 'string' ? skill : skill.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="profile-actions">
              <button 
                className="primary-btn" 
                onClick={() => setIsEditing(true)}
              >
                Edit Profile
              </button>
              <button 
                className="secondary-btn"
                onClick={() => {
                  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    if (tabs[0]?.id) {
                      chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'fillFields',
                        profileData: profile
                      });
                    }
                  });
                }}
              >
                Fill Current Page
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />); 