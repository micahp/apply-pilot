import React, { useState } from 'react';
import { Profile, WorkExperience, Education, Skill } from '../types/profile';

interface ProfileFormProps {
  initialProfile?: Partial<Profile>;
  onSubmit: (profile: Partial<Profile>) => void;
  onCancel?: () => void;
}

export const ProfileForm: React.FC<ProfileFormProps> = ({ 
  initialProfile = {}, 
  onSubmit,
  onCancel
}) => {
  const [profile, setProfile] = useState<Partial<Profile>>({
    personal: { firstName: '', lastName: '', email: '', phone: '' },
    workExperience: [],
    education: [],
    skills: [],
    eeo: { gender: '', ethnicity: '' },
    ...initialProfile
  });

  const [newSkill, setNewSkill] = useState('');

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    section?: string,
    index?: number
  ) => {
    const { name, value } = e.target;
    
    if (section && index !== undefined) {
      // Handle nested arrays (work experience, education)
      setProfile(prev => {
        const updatedItems = [...(prev[section as keyof Profile] as any[] || [])];
        updatedItems[index] = {
          ...updatedItems[index],
          [name]: value
        };
        
        return {
          ...prev,
          [section]: updatedItems
        };
      });
    } else if (section) {
      // Handle nested objects (personal, eeo)
      setProfile(prev => ({
        ...prev,
        [section]: {
          ...(prev[section as keyof Profile] as object || {}),
          [name]: value
        }
      }));
    } else {
      // Handle top level fields
      setProfile(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const addWorkExperience = () => {
    setProfile(prev => ({
      ...prev,
      workExperience: [
        ...(prev.workExperience || []),
        { company: '', title: '', startDate: '', endDate: '', description: '' }
      ]
    }));
  };

  const removeWorkExperience = (index: number) => {
    setProfile(prev => ({
      ...prev,
      workExperience: (prev.workExperience || []).filter((_, i) => i !== index)
    }));
  };

  const addEducation = () => {
    setProfile(prev => ({
      ...prev,
      education: [
        ...(prev.education || []),
        { institution: '', degree: '', fieldOfStudy: '', startDate: '', endDate: '' }
      ]
    }));
  };

  const removeEducation = (index: number) => {
    setProfile(prev => ({
      ...prev,
      education: (prev.education || []).filter((_, i) => i !== index)
    }));
  };

  const addSkill = () => {
    if (newSkill.trim() === '') return;
    
    const skill: Skill = { name: newSkill.trim() };
    
    setProfile(prev => ({
      ...prev,
      skills: [...(prev.skills || []), skill]
    }));
    
    setNewSkill('');
  };

  const removeSkill = (index: number) => {
    setProfile(prev => ({
      ...prev,
      skills: (prev.skills || []).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(profile);
  };

  return (
    <div className="profile-form-container">
      <form className="profile-form" onSubmit={handleSubmit}>
        {/* Personal Information Section */}
        <section className="form-section">
          <h2>Personal Information</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={profile.personal?.firstName || ''}
                onChange={(e) => handleInputChange(e, 'personal')}
                placeholder="Enter your first name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={profile.personal?.lastName || ''}
                onChange={(e) => handleInputChange(e, 'personal')}
                placeholder="Enter your last name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={profile.personal?.email || ''}
                onChange={(e) => handleInputChange(e, 'personal')}
                placeholder="Enter your email address"
              />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={profile.personal?.phone || ''}
                onChange={(e) => handleInputChange(e, 'personal')}
                placeholder="Enter your phone number"
              />
            </div>
            <div className="form-group">
              <label htmlFor="linkedIn">LinkedIn URL</label>
              <input
                type="url"
                id="linkedIn"
                name="linkedIn"
                value={profile.personal?.linkedIn || ''}
                onChange={(e) => handleInputChange(e, 'personal')}
                placeholder="https://linkedin.com/in/yourprofile"
              />
            </div>
            <div className="form-group">
              <label htmlFor="github">GitHub URL</label>
              <input
                type="url"
                id="github"
                name="github"
                value={profile.personal?.github || ''}
                onChange={(e) => handleInputChange(e, 'personal')}
                placeholder="https://github.com/yourusername"
              />
            </div>
            <div className="form-group">
              <label htmlFor="website">Personal Website</label>
              <input
                type="url"
                id="website"
                name="website"
                value={profile.personal?.website || ''}
                onChange={(e) => handleInputChange(e, 'personal')}
                placeholder="https://yourwebsite.com"
              />
            </div>
          </div>
        </section>

        {/* Work Experience Section */}
        <section className="form-section">
          <h2>Work Experience</h2>
          {(profile.workExperience || []).map((exp, index) => (
            <div key={index} className="experience-item">
              <div className="experience-item-header">
                <div className="experience-item-title">Experience {index + 1}</div>
                <button type="button" className="remove-btn" onClick={() => removeWorkExperience(index)}>
                  Remove
                </button>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor={`company-${index}`}>Company</label>
                  <input
                    type="text"
                    id={`company-${index}`}
                    name="company"
                    value={exp.company || ''}
                    onChange={(e) => handleInputChange(e, 'workExperience', index)}
                    placeholder="Company name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`title-${index}`}>Job Title</label>
                  <input
                    type="text"
                    id={`title-${index}`}
                    name="title"
                    value={exp.title || ''}
                    onChange={(e) => handleInputChange(e, 'workExperience', index)}
                    placeholder="Your job title"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`startDate-${index}`}>Start Date</label>
                  <input
                    type="date"
                    id={`startDate-${index}`}
                    name="startDate"
                    value={exp.startDate || ''}
                    onChange={(e) => handleInputChange(e, 'workExperience', index)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`endDate-${index}`}>End Date</label>
                  <input
                    type="date"
                    id={`endDate-${index}`}
                    name="endDate"
                    value={exp.endDate || ''}
                    onChange={(e) => handleInputChange(e, 'workExperience', index)}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label htmlFor={`description-${index}`}>Description</label>
                  <textarea
                    id={`description-${index}`}
                    name="description"
                    value={exp.description || ''}
                    onChange={(e) => handleInputChange(e, 'workExperience', index)}
                    rows={3}
                    placeholder="Describe your responsibilities and achievements"
                  ></textarea>
                </div>
              </div>
            </div>
          ))}
          <button type="button" className="add-btn" onClick={addWorkExperience}>
            + Add Work Experience
          </button>
        </section>

        {/* Education Section */}
        <section className="form-section">
          <h2>Education</h2>
          {(profile.education || []).map((edu, index) => (
            <div key={index} className="education-item">
              <div className="education-item-header">
                <div className="education-item-title">Education {index + 1}</div>
                <button type="button" className="remove-btn" onClick={() => removeEducation(index)}>
                  Remove
                </button>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor={`institution-${index}`}>Institution</label>
                  <input
                    type="text"
                    id={`institution-${index}`}
                    name="institution"
                    value={edu.institution || ''}
                    onChange={(e) => handleInputChange(e, 'education', index)}
                    placeholder="School or university name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`degree-${index}`}>Degree</label>
                  <input
                    type="text"
                    id={`degree-${index}`}
                    name="degree"
                    value={edu.degree || ''}
                    onChange={(e) => handleInputChange(e, 'education', index)}
                    placeholder="Degree type (e.g., Bachelor's, Master's)"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`fieldOfStudy-${index}`}>Field of Study</label>
                  <input
                    type="text"
                    id={`fieldOfStudy-${index}`}
                    name="fieldOfStudy"
                    value={edu.fieldOfStudy || ''}
                    onChange={(e) => handleInputChange(e, 'education', index)}
                    placeholder="Your major or field of study"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`eduStartDate-${index}`}>Start Date</label>
                  <input
                    type="date"
                    id={`eduStartDate-${index}`}
                    name="startDate"
                    value={edu.startDate || ''}
                    onChange={(e) => handleInputChange(e, 'education', index)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`eduEndDate-${index}`}>End Date</label>
                  <input
                    type="date"
                    id={`eduEndDate-${index}`}
                    name="endDate"
                    value={edu.endDate || ''}
                    onChange={(e) => handleInputChange(e, 'education', index)}
                  />
                </div>
              </div>
            </div>
          ))}
          <button type="button" className="add-btn" onClick={addEducation}>
            + Add Education
          </button>
        </section>

        {/* Skills Section */}
        <section className="form-section">
          <h2>Skills</h2>
          <div className="skill-chips">
            {(profile.skills || []).map((skill, index) => (
              <div key={index} className="skill-chip">
                {skill.name}
                <button type="button" onClick={() => removeSkill(index)}>×</button>
              </div>
            ))}
          </div>
          <div className="add-skill-section">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              placeholder="Enter a skill"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
            />
            <button type="button" className="add-skill-btn" onClick={addSkill}>
              Add
            </button>
          </div>
        </section>

        {/* EEO Information Section */}
        <section className="form-section">
          <h2>EEO Information</h2>
          <p className="form-description">This information is optional and used only for Equal Employment Opportunity reporting.</p>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="gender">Gender</label>
              <select
                id="gender"
                name="gender"
                value={profile.eeo?.gender || ''}
                onChange={(e) => handleInputChange(e, 'eeo')}
              >
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non-binary">Non-binary</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="ethnicity">Ethnicity</label>
              <select
                id="ethnicity"
                name="ethnicity"
                value={profile.eeo?.ethnicity || ''}
                onChange={(e) => handleInputChange(e, 'eeo')}
              >
                <option value="">Prefer not to say</option>
                <option value="asian">Asian</option>
                <option value="black">Black or African American</option>
                <option value="hispanic">Hispanic or Latino</option>
                <option value="native">Native American or Alaska Native</option>
                <option value="pacific">Native Hawaiian or Pacific Islander</option>
                <option value="white">White</option>
                <option value="two-or-more">Two or more races</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </section>

        {/* Form Actions */}
        <div className="form-actions">
          {onCancel && (
            <button type="button" className="cancel-btn" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="primary-btn">
            Save Profile
          </button>
        </div>
      </form>
    </div>
  );
}; 