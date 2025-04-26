import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

interface Profile {
  personal: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  experience: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate?: string;
  }>;
}

function Popup() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load profile from storage
    chrome.storage.local.get('profile', (result) => {
      setProfile(result.profile || null);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="popup">
      <header>
        <h1>AutoApply</h1>
        <button className="settings-btn">⚙️</button>
      </header>

      {profile ? (
        <div className="profile">
          <h2>Your Profile</h2>
          <div className="field">
            <label>Name</label>
            <span>{profile.personal.firstName} {profile.personal.lastName}</span>
          </div>
          <div className="field">
            <label>Email</label>
            <span>{profile.personal.email}</span>
          </div>
          <div className="field">
            <label>Phone</label>
            <span>{profile.personal.phone}</span>
          </div>
          
          <h3>Experience</h3>
          {profile.experience.map((exp, i) => (
            <div key={i} className="experience">
              <div className="field">
                <label>Company</label>
                <span>{exp.company}</span>
              </div>
              <div className="field">
                <label>Title</label>
                <span>{exp.title}</span>
              </div>
              <div className="field">
                <label>Duration</label>
                <span>{exp.startDate} - {exp.endDate || 'Present'}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>No profile found</p>
          <button onClick={() => chrome.tabs.create({ url: 'https://app.autoapply.dev/onboarding' })}>
            Create Profile
          </button>
        </div>
      )}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />); 