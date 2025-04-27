import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Profile, PartialProfile } from '../types/profile';
import { ProfileForm } from '../components/ProfileForm';
import { parseResumeFile } from '../utils/resumeParser';
import './styles.css';

function Options() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [resumeData, setResumeData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<'uploading' | 'success' | 'error'>('uploading');

  useEffect(() => {
    // Load profile from storage
    chrome.storage.local.get('profile', (result) => {
      console.log('Loaded profile from storage:', result.profile);
      setProfile(result.profile || null);
      setLoading(false);
    });
  }, []);

  const handleSaveProfile = (updatedProfile: Partial<Profile>) => {
    try {
      console.log('Saving profile:', updatedProfile);
      chrome.storage.local.set({ profile: updatedProfile }, () => {
        setProfile(updatedProfile as Profile);
        // Show success message
        alert('Profile saved successfully!');
      });
    } catch (error) {
      setError('Failed to save profile');
      console.error('AutoApply: Error saving profile', error);
    }
  };

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }
    
    setUploadStatus('uploading');
    setResumeUploading(true);
    
    try {
      const file = event.target.files[0];
      console.log('Uploading resume file:', file.name, file.type, file.size);
      
      // Progress simulation
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => (prev < 95 ? prev + 5 : prev));
      }, 100);
      
      try {
        // Parse the resume file
        const parsedData = await parseResumeFile(file);
        
        console.log('Resume parsing complete. Extracted data:', parsedData);
        
        // Get the current profile from storage
        const { profile: currentProfile } = await chrome.storage.local.get('profile');
        
        // Create a merged profile by combining the current profile and parsed data
        // Give priority to parsed data where available
        const mergedProfile: Partial<Profile> = {
          ...currentProfile,
          ...parsedData,
          personal: {
            ...(currentProfile?.personal || {}),
            ...(parsedData.personal || {})
          },
          workExperience: [
            ...(parsedData.workExperience || []),
            ...((currentProfile?.workExperience || []).filter(exp => 
              !(parsedData.workExperience || []).some(newExp => 
                newExp.company === exp.company && newExp.title === exp.title
              )
            ))
          ],
          education: [
            ...(parsedData.education || []),
            ...((currentProfile?.education || []).filter(edu => 
              !(parsedData.education || []).some(newEdu => 
                newEdu.institution === edu.institution && newEdu.degree === edu.degree
              )
            ))
          ],
          skills: [
            ...(parsedData.skills || []),
            ...((currentProfile?.skills || []).filter(skill => 
              !(parsedData.skills || []).some(newSkill => 
                typeof skill === 'object' && typeof newSkill === 'object' && newSkill.name === skill.name
              )
            ))
          ]
        };
        
        // Show what we found in the logs
        console.log('Merged profile:', mergedProfile);
        console.log('Personal info found:', mergedProfile.personal || 'None');
        console.log('Work experience found:', mergedProfile.workExperience?.length || 0, 'entries');
        console.log('Education found:', mergedProfile.education?.length || 0, 'entries');
        console.log('Skills found:', mergedProfile.skills?.length || 0, 'skills');
        
        // Save the profile to Chrome storage
        await chrome.storage.local.set({ profile: mergedProfile });
        
        clearInterval(progressInterval);
        setUploadProgress(100);
        setUploadStatus('success');
        setProfile(mergedProfile as Profile);
        setResumeUploading(false);
        
        // Display success message
        alert(`Resume parsed successfully! 
Found: 
- Personal info: ${Object.values(mergedProfile.personal || {}).filter(Boolean).length > 0 ? 'Yes' : 'No'}
- Work experience: ${mergedProfile.workExperience?.length || 0} entries
- Education: ${mergedProfile.education?.length || 0} entries
- Skills: ${mergedProfile.skills?.length || 0} skills
        `);
      } finally {
        // Always clean up the interval
        clearInterval(progressInterval);
        
        // Reset the file input
        event.target.value = '';
      }
    } catch (error) {
      console.error('Resume parsing error:', error);
      setUploadStatus('error');
      setUploadProgress(0);
      setResumeUploading(false);
      alert(`Error parsing resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="options-page">
      <header>
        <div className="logo">
          <h1>AutoApply</h1>
        </div>
        <div className="header-actions">
          <a 
            href="https://www.autoapply.ai/faq" 
            target="_blank"
            rel="noopener noreferrer"
            className="help-link"
          >
            Help
          </a>
        </div>
      </header>

      <div className="content-container">
        <div className="main-content">
          {error && <div className="error-message">{error}</div>}

          <div className="profile-container">
            <div className="profile-header">
              <div>
                <h2>Your Profile</h2>
                <p className="section-description">
                  Complete your profile to enable automatic application filling. 
                  This information will be used to fill out job applications.
                </p>
              </div>
              <div className="resume-upload">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleResumeUpload}
                  accept=".pdf,.doc,.docx,.txt,.rtf"
                  style={{ display: 'none' }}
                />
                <div className="upload-buttons">
                  <button 
                    className="upload-button"
                    onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
                    disabled={resumeUploading}
                  >
                    {resumeUploading ? 'Parsing Resume...' : 'Import from Resume'}
                  </button>
                </div>

                {resumeUploading && (
                  <div className="progress-container">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <span className="progress-text">{uploadProgress}%</span>
                  </div>
                )}

                {resumeData && !resumeUploading && (
                  <div className="resume-success">
                    <p>✓ Resume data imported!</p>
                  </div>
                )}
              </div>
            </div>

            <ProfileForm 
              initialProfile={profile || undefined}
              onSubmit={handleSaveProfile}
            />
          </div>
          
          <div className="settings-container">
            <h2>Extension Settings</h2>
            <div className="setting-group">
              <div className="setting-row">
                <div className="setting-label">
                  <h3>Auto-detect ATS</h3>
                  <p>Automatically detect Application Tracking Systems</p>
                </div>
                <div className="setting-control">
                  <label className="toggle">
                    <input type="checkbox" checked={true} readOnly />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>

              <div className="setting-row">
                <div className="setting-label">
                  <h3>Auto-fill on load</h3>
                  <p>Automatically fill out forms when a job application page loads</p>
                </div>
                <div className="setting-control">
                  <label className="toggle">
                    <input type="checkbox" checked={false} readOnly />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
              
              <div className="setting-row">
                <div className="setting-label">
                  <h3>Notifications</h3>
                  <p>Receive notifications when AutoApply performs actions</p>
                </div>
                <div className="setting-control">
                  <label className="toggle">
                    <input type="checkbox" checked={true} readOnly />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer>
        <p>AutoApply &copy; {new Date().getFullYear()} | <a href="https://www.autoapply.ai/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a></p>
      </footer>
    </div>
  );
}

// Render the Options React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Options />);
} 