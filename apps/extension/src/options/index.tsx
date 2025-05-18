import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Profile, PartialProfile } from '../types/profile';
import { ProfileForm } from '../components/ProfileForm';
import './styles.css';

// API configuration
const API_BASE_URL = 'http://localhost:3000';
const API_ENDPOINTS = {
  HEALTH: `${API_BASE_URL}/health`,
  PARSE_RESUME: `${API_BASE_URL}/parse-resume`
};

// Add this tooltip component to show resume format guidance
function ResumeFormatTip() {
  const [showTip, setShowTip] = useState(false);
  
  return (
    <div className="resume-format-tip">
      <button 
        className="tip-button"
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onClick={() => setShowTip(!showTip)}
      >
        ?
      </button>
      {showTip && (
        <div className="tip-popup">
          <h4>Resume Format Tips</h4>
          <p>For best results:</p>
          <ul>
            <li>Use a single-column layout</li>
            <li>Use standard section headings: EXPERIENCE, EDUCATION, SKILLS</li>
            <li>PDF format is preferred</li>
            <li>Use text-based PDFs (not scanned images)</li>
            <li>Use standard fonts (Arial, Times New Roman, Calibri)</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function Options() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [resumeData, setResumeData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<'uploading' | 'success' | 'error'>('uploading');
  const [apiStatus, setApiStatus] = useState<'checking' | 'running' | 'down'>('checking');

  useEffect(() => {
    // Load profile from storage
    chrome.storage.local.get('profile', (result) => {
      console.log('Loaded profile from storage:', result.profile);
      setProfile(result.profile || null);
      setLoading(false);
    });

    // Check if the resume API is running
    checkApiStatus();
  }, []);

  // Function to check if the resume API server is running
  const checkApiStatus = async () => {
    console.log('Checking Resume API status...');
    try {
      const response = await fetch(API_ENDPOINTS.HEALTH, { 
        method: 'GET',
        // Set a timeout to avoid hanging if the server is down
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        console.log('Resume API is running, health check successful');
        
        // If health check is successful, also test CORS
        testCorsConnection();
        
        setApiStatus('running');
      } else {
        console.warn(`Resume API returned non-OK status: ${response.status} ${response.statusText}`);
        setApiStatus('down');
      }
    } catch (error) {
      console.error('Failed to connect to Resume API:', error);
      setApiStatus('down');
    }
  };
  
  // Test CORS connectivity to API
  const testCorsConnection = async () => {
    try {
      console.log('Testing CORS connection to API...');
      const corsTestUrl = `${API_BASE_URL}/cors-test`;
      
      const response = await fetch(corsTestUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('CORS test successful:', data);
      } else {
        console.error('CORS test failed with status:', response.status);
      }
    } catch (error) {
      console.error('CORS test error:', error);
    }
  };

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

  const handleClearProfile = () => {
    if (window.confirm('Are you sure you want to clear your profile? This action cannot be undone.')) {
      chrome.storage.local.set({ profile: null }, () => {
        setProfile(null);
        alert('Profile cleared successfully!');
      });
    }
  };

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      console.log('No file selected');
      return;
    }
    
    // First check if the API is running
    if (apiStatus !== 'running') {
      console.warn('Resume parsing service is not available. API status:', apiStatus);
      alert('Resume parsing service is not available. Please make sure the API server is running.');
      return;
    }
    
    setUploadStatus('uploading');
    setResumeUploading(true);
    setUploadProgress(0);
    
    try {
      const file = event.target.files[0];
      console.log('Uploading resume file:', file.name, 'Type:', file.type, 'Size:', file.size);
      
      // Set up progress simulation
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newValue = prev < 95 ? prev + 5 : prev;
          console.log('Upload progress:', newValue + '%');
          return newValue;
        });
      }, 100);
      
      try {
        // Create form data and send to API
        const formData = new FormData();
        formData.append('file', file);
        
        console.log('Sending resume to API endpoint:', API_ENDPOINTS.PARSE_RESUME);
        
        // Call the resume parsing API
        const response = await fetch(API_ENDPOINTS.PARSE_RESUME, {
          method: 'POST',
          body: formData,
        });
        
        console.log('API response status:', response.status, response.statusText);
        
        if (!response.ok) {
          console.error('Resume API returned error status:', response.status);
          const errorData = await response.json();
          console.error('API error details:', errorData);
          throw new Error(errorData.error || 'Failed to parse resume');
        }
        
        // Get the parsed data from API
        const apiData = await response.json();
        console.log('Resume API raw response:', apiData);
        
        if (apiData.structuredData) {
          console.log('API returned structured data:', {
            personalFields: Object.keys(apiData.structuredData.personal || {}),
            workExperience: (apiData.structuredData.workExperience || []).length + ' entries',
            education: (apiData.structuredData.education || []).length + ' entries',
            skills: (apiData.structuredData.skills || []).length + ' skills'
          });
        } else {
          console.warn('API response does not contain structured data');
        }
        
        // Convert API response to our profile format
        console.log('Converting API response to profile format...');
        const parsedData = convertApiResponseToProfile(apiData);
        
        // Get the current profile from storage
        console.log('Retrieving current profile from storage');
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
        
        setResumeData({
          personal: mergedProfile.personal || {},
          workExperience: mergedProfile.workExperience || [],
          education: mergedProfile.education || [],
          skills: mergedProfile.skills || []
        });

        // Show a more detailed success message
        const personalInfoCount = Object.values(mergedProfile.personal || {}).filter(Boolean).length;
        alert(`Resume parsed successfully! 

Found:
${personalInfoCount > 0 ? `✓ Personal info: ${personalInfoCount} fields` : '✗ No personal info detected'}
${mergedProfile.workExperience?.length ? `✓ Work experience: ${mergedProfile.workExperience.length} entries` : '✗ No work experience detected'}
${mergedProfile.education?.length ? `✓ Education: ${mergedProfile.education.length} entries` : '✗ No education detected'}
${mergedProfile.skills?.length ? `✓ Skills: ${mergedProfile.skills.length} skills` : '✗ No skills detected'}

Review your profile to verify the information and make any necessary corrections.
`);
      } finally {
        // Always clean up the interval
        clearInterval(progressInterval);
        
        // Reset the file input
        event.target.value = '';
      }
    } catch (error) {
      console.error('Resume parsing error details:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      setUploadStatus('error');
      setUploadProgress(0);
      setResumeUploading(false);
      
      // Show more helpful error message if the API is down
      if (apiStatus !== 'running') {
        alert('Unable to connect to the resume parsing service. Please make sure the API server is running and try again.');
      } else {
        alert(`Error parsing resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  // Function to convert API response to our profile format
  const convertApiResponseToProfile = (apiData: any): Partial<Profile> => {
    console.log('convertApiResponseToProfile: Processing API response');
    
    // If the API returned structured data, use that directly
    if (apiData.structuredData) {
      console.log('Using structured data from API with fields:', Object.keys(apiData.structuredData));
      
      try {
        const { personal, workExperience, education, skills } = apiData.structuredData;
        
        console.log('Personal data fields:', Object.keys(personal || {}));
        console.log('Work experience entries:', (workExperience || []).length);
        console.log('Education entries:', (education || []).length);
        console.log('Skills entries:', (skills || []).length);
        
        // Return the structured data in our profile format
        const formattedProfile = {
          personal: {
            ...personal,
            // Ensure we have proper typing for any missing fields
            firstName: personal?.firstName || '',
            lastName: personal?.lastName || '',
            email: personal?.email || '',
            phone: personal?.phone || ''
          },
          workExperience: (workExperience || []).map((exp: any) => ({
            company: exp.company || '',
            title: exp.title || '',
            startDate: exp.startDate || '',
            endDate: exp.endDate || '',
            description: exp.description || '',
            location: exp.location || ''
          })),
          education: (education || []).map((edu: any) => ({
            institution: edu.institution || '',
            degree: edu.degree || '',
            fieldOfStudy: edu.fieldOfStudy || '',
            startDate: edu.startDate || '',
            endDate: edu.endDate || ''
          })),
          skills: (skills || []).map((skill: any) => ({
            name: typeof skill === 'string' ? skill : skill.name || ''
          }))
        };
        
        console.log('Formatted profile:', formattedProfile);
        return formattedProfile;
      } catch (error) {
        console.error('Error processing structured data:', error);
        console.error('Falling back to manual extraction');
        // Fall through to the text extraction below
      }
    }
    
    // If there's no structured data, fall back to parsing the text
    const text = apiData.text || '';
    console.log('No structured data found, parsing text manually. Text length:', text.length);
    
    // Extract personal information
    const personal: any = {};
    
    // Email
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailRegex);
    if (emails && emails.length > 0) {
      personal.email = emails[0];
    }
    
    // Phone
    const phoneRegex = /\b(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
    const phones = text.match(phoneRegex);
    if (phones && phones.length > 0) {
      personal.phone = phones[0];
    }
    
    // Name - basic extraction, look for patterns
    const nameMatch = text.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)/);
    if (nameMatch) {
      personal.firstName = nameMatch[1];
      personal.lastName = nameMatch[2];
    }
    
    // Find sections in the text
    const sections: {[key: string]: string} = {};
    
    // Look for common section headers
    const sectionPatterns = [
      { name: 'experience', regex: /\b(EXPERIENCE|EMPLOYMENT|WORK HISTORY)[\s:]*\n/i },
      { name: 'education', regex: /\b(EDUCATION|ACADEMIC|QUALIFICATION)[\s:]*\n/i },
      { name: 'skills', regex: /\b(SKILLS|EXPERTISE|COMPETENCIES|ABILITIES)[\s:]*\n/i },
    ];
    
    // Find the start of each section
    for (const section of sectionPatterns) {
      const match = text.match(section.regex);
      if (match) {
        const startIndex = match.index! + match[0].length;
        sections[section.name] = text.substring(startIndex);
      }
    }
    
    // Extract work experience (simplified)
    const workExperience: Array<{
      company: string;
      title: string;
      startDate: string;
      endDate: string;
      description: string;
      location?: string;
    }> = [];
    
    if (sections.experience) {
      // Simple extraction, in a real implementation this would be more robust
      const lines = sections.experience.split('\n').filter(line => line.trim().length > 0);
      
      let currentCompany = '';
      let currentTitle = '';
      
      for (let i = 0; i < Math.min(lines.length, 10); i++) {
        const line = lines[i].trim();
        
        // Look for patterns that might indicate job titles or companies
        if (line.match(/^[A-Z][a-zA-Z\s]+$/) && !currentCompany) {
          currentCompany = line;
        } else if (line.match(/(engineer|developer|manager|director|analyst|specialist|consultant)/i) && !currentTitle) {
          currentTitle = line;
        }
        
        // If we have both, add an experience entry
        if (currentCompany && currentTitle) {
          workExperience.push({
            company: currentCompany,
            title: currentTitle,
            startDate: '',
            endDate: '',
            description: 'Extracted from resume'
          });
          
          // Reset for next entry
          currentCompany = '';
          currentTitle = '';
        }
      }
    }
    
    // Extract skills (simplified)
    const skills: Array<{ name: string }> = [];
    
    if (sections.skills) {
      // Split by common separators
      const skillItems = sections.skills.split(/[,|•;\n]/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 30);
      
      // Filter out common non-skill words
      const filteredSkills = skillItems.filter(skill => {
        const lowerSkill = skill.toLowerCase();
        return !['and', 'the', 'with', 'for', 'experience', 'years'].includes(lowerSkill);
      });
      
      // Take up to 15 skills
      for (let i = 0; i < Math.min(filteredSkills.length, 15); i++) {
        skills.push({ name: filteredSkills[i] });
      }
    }
    
    // Extract education (simplified)
    const education: Array<{
      institution: string;
      degree: string;
      fieldOfStudy: string;
      startDate: string;
      endDate: string;
    }> = [];
    
    if (sections.education) {
      // Simple extraction
      const lines = sections.education.split('\n').filter(line => line.trim().length > 0);
      
      let currentInstitution = '';
      let currentDegree = '';
      
      for (let i = 0; i < Math.min(lines.length, 10); i++) {
        const line = lines[i].trim();
        
        // Look for institutions
        if (line.match(/(university|college|institute|school)/i) && !currentInstitution) {
          currentInstitution = line;
        } 
        // Look for degrees
        else if (line.match(/(bachelor|master|phd|bs|ba|ms|ma|degree)/i) && !currentDegree) {
          currentDegree = line;
        }
        
        // If we have both, add an education entry
        if (currentInstitution && currentDegree) {
          education.push({
            institution: currentInstitution,
            degree: currentDegree,
            fieldOfStudy: '',
            startDate: '',
            endDate: ''
          });
          
          // Reset for next entry
          currentInstitution = '';
          currentDegree = '';
        }
      }
    }
    
    return {
      personal,
      workExperience,
      education,
      skills
    };
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
                    disabled={resumeUploading || apiStatus === 'down'}
                  >
                    {resumeUploading ? 'Parsing Resume...' : 'Import from Resume'}
                  </button>
                  <ResumeFormatTip />
                </div>

                {apiStatus === 'down' && (
                  <div className="api-status-warning">
                    ⚠️ Resume parsing service is not available. 
                    <a href="#" onClick={(e) => { e.preventDefault(); checkApiStatus(); }}>Retry connection</a>
                    <button 
                      className="test-api-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        
                        // Show connection details
                        alert(`API connection details:
- Base URL: ${API_BASE_URL}
- Health endpoint: ${API_ENDPOINTS.HEALTH}
- Parse endpoint: ${API_ENDPOINTS.PARSE_RESUME}

Please make sure the Resume API server is running at this address.
You can start it using the proper command in your terminal.`);
                      }}
                    >
                      Connection Info
                    </button>
                  </div>
                )}

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
              onClear={handleClearProfile}
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