import React, { useState } from 'react';
import { Profile, PartialProfile, WorkExperience, Education, Skill } from '../types/profile';
import './styles.css';

interface EditProfileProps {
  initialProfile: PartialProfile;
  onSave: (profile: PartialProfile) => void;
  onCancel?: () => void;
}

const EditProfile: React.FC<EditProfileProps> = ({ initialProfile, onSave, onCancel }) => {
  const [profile, setProfile] = useState<PartialProfile>({
    personal: initialProfile.personal || {},
    workExperience: initialProfile.workExperience || [{ company: '', title: '', startDate: '', description: '' }],
    education: initialProfile.education || [{ institution: '', degree: '', fieldOfStudy: '', startDate: '' }],
    skills: initialProfile.skills || [],
    eeo: initialProfile.eeo || {},
    documents: initialProfile.documents || {}
  });

  // Personal information handler
  const handlePersonalChange = (field: string, value: string) => {
    setProfile({
      ...profile,
      personal: {
        ...profile.personal,
        [field]: value
      }
    });
  };

  // Work experience handlers
  const handleWorkExperienceChange = (index: number, field: keyof WorkExperience, value: string) => {
    const updatedExperiences = [...(profile.workExperience || [])];
    if (!updatedExperiences[index]) {
      updatedExperiences[index] = {} as Partial<WorkExperience>;
    }
    updatedExperiences[index] = { ...updatedExperiences[index], [field]: value };
    setProfile({ ...profile, workExperience: updatedExperiences });
  };

  const addWorkExperience = () => {
    setProfile({
      ...profile,
      workExperience: [...(profile.workExperience || []), { company: '', title: '', startDate: '', description: '' }]
    });
  };

  const removeWorkExperience = (index: number) => {
    const updatedExperiences = [...(profile.workExperience || [])];
    updatedExperiences.splice(index, 1);
    setProfile({ ...profile, workExperience: updatedExperiences });
  };

  // Education handlers
  const handleEducationChange = (index: number, field: keyof Education, value: string) => {
    const updatedEducation = [...(profile.education || [])];
    if (!updatedEducation[index]) {
      updatedEducation[index] = {} as Partial<Education>;
    }
    updatedEducation[index] = { ...updatedEducation[index], [field]: value };
    setProfile({ ...profile, education: updatedEducation });
  };

  const addEducation = () => {
    setProfile({
      ...profile,
      education: [...(profile.education || []), { institution: '', degree: '', fieldOfStudy: '', startDate: '' }]
    });
  };

  const removeEducation = (index: number) => {
    const updatedEducation = [...(profile.education || [])];
    updatedEducation.splice(index, 1);
    setProfile({ ...profile, education: updatedEducation });
  };

  // Skills handlers
  const handleSkillChange = (index: number, value: string) => {
    const updatedSkills = [...(profile.skills || [])];
    updatedSkills[index] = { name: value };
    setProfile({ ...profile, skills: updatedSkills });
  };

  const addSkill = () => {
    setProfile({
      ...profile,
      skills: [...(profile.skills || []), { name: '' }]
    });
  };

  const removeSkill = (index: number) => {
    const updatedSkills = [...(profile.skills || [])];
    updatedSkills.splice(index, 1);
    setProfile({ ...profile, skills: updatedSkills });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(profile);
  };

  return (
    <div className="edit-profile">
      <form onSubmit={handleSubmit}>
        {/* Personal Information Section */}
        <section className="form-section">
          <h2>Personal Information</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                value={profile.personal?.firstName || ''}
                onChange={(e) => handlePersonalChange('firstName', e.target.value)}
                placeholder="John"
              />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                value={profile.personal?.lastName || ''}
                onChange={(e) => handlePersonalChange('lastName', e.target.value)}
                placeholder="Doe"
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={profile.personal?.email || ''}
                onChange={(e) => handlePersonalChange('email', e.target.value)}
                placeholder="john.doe@example.com"
              />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone</label>
              <input
                type="tel"
                id="phone"
                value={profile.personal?.phone || ''}
                onChange={(e) => handlePersonalChange('phone', e.target.value)}
                placeholder="(123) 456-7890"
              />
            </div>
            <div className="form-group">
              <label htmlFor="linkedIn">LinkedIn URL</label>
              <input
                type="url"
                id="linkedIn"
                value={profile.personal?.linkedIn || ''}
                onChange={(e) => handlePersonalChange('linkedIn', e.target.value)}
                placeholder="https://linkedin.com/in/johndoe"
              />
            </div>
            <div className="form-group">
              <label htmlFor="github">GitHub URL</label>
              <input
                type="url"
                id="github"
                value={profile.personal?.github || ''}
                onChange={(e) => handlePersonalChange('github', e.target.value)}
                placeholder="https://github.com/johndoe"
              />
            </div>
            <div className="form-group">
              <label htmlFor="website">Personal Website</label>
              <input
                type="url"
                id="website"
                value={profile.personal?.website || ''}
                onChange={(e) => handlePersonalChange('website', e.target.value)}
                placeholder="https://johndoe.com"
              />
            </div>
          </div>
        </section>

        {/* Work Experience Section */}
        <section className="form-section">
          <h2>Work Experience</h2>
          {profile.workExperience?.map((exp, index) => (
            <div key={index} className="experience-item">
              <div className="item-header">
                <h3>Experience {index + 1}</h3>
                <button 
                  type="button" 
                  className="remove-btn" 
                  onClick={() => removeWorkExperience(index)}
                  disabled={profile.workExperience?.length === 1}
                >
                  Remove
                </button>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor={`company-${index}`}>Company</label>
                  <input
                    type="text"
                    id={`company-${index}`}
                    value={exp.company || ''}
                    onChange={(e) => handleWorkExperienceChange(index, 'company', e.target.value)}
                    placeholder="Company Name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`title-${index}`}>Job Title</label>
                  <input
                    type="text"
                    id={`title-${index}`}
                    value={exp.title || ''}
                    onChange={(e) => handleWorkExperienceChange(index, 'title', e.target.value)}
                    placeholder="Software Engineer"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`startDate-${index}`}>Start Date</label>
                  <input
                    type="date"
                    id={`startDate-${index}`}
                    value={exp.startDate || ''}
                    onChange={(e) => handleWorkExperienceChange(index, 'startDate', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`endDate-${index}`}>End Date</label>
                  <input
                    type="date"
                    id={`endDate-${index}`}
                    value={exp.endDate || ''}
                    onChange={(e) => handleWorkExperienceChange(index, 'endDate', e.target.value)}
                  />
                </div>
                <div className="form-group full-width">
                  <label htmlFor={`description-${index}`}>Description</label>
                  <textarea
                    id={`description-${index}`}
                    value={exp.description || ''}
                    onChange={(e) => handleWorkExperienceChange(index, 'description', e.target.value)}
                    placeholder="Describe your responsibilities and achievements"
                    rows={3}
                  />
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
          {profile.education?.map((edu, index) => (
            <div key={index} className="education-item">
              <div className="item-header">
                <h3>Education {index + 1}</h3>
                <button 
                  type="button" 
                  className="remove-btn" 
                  onClick={() => removeEducation(index)}
                  disabled={profile.education?.length === 1}
                >
                  Remove
                </button>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor={`institution-${index}`}>Institution</label>
                  <input
                    type="text"
                    id={`institution-${index}`}
                    value={edu.institution || ''}
                    onChange={(e) => handleEducationChange(index, 'institution', e.target.value)}
                    placeholder="University Name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`degree-${index}`}>Degree</label>
                  <input
                    type="text"
                    id={`degree-${index}`}
                    value={edu.degree || ''}
                    onChange={(e) => handleEducationChange(index, 'degree', e.target.value)}
                    placeholder="Bachelor's, Master's, etc."
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`fieldOfStudy-${index}`}>Field of Study</label>
                  <input
                    type="text"
                    id={`fieldOfStudy-${index}`}
                    value={edu.fieldOfStudy || ''}
                    onChange={(e) => handleEducationChange(index, 'fieldOfStudy', e.target.value)}
                    placeholder="Computer Science"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`eduStartDate-${index}`}>Start Date</label>
                  <input
                    type="date"
                    id={`eduStartDate-${index}`}
                    value={edu.startDate || ''}
                    onChange={(e) => handleEducationChange(index, 'startDate', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`eduEndDate-${index}`}>End Date</label>
                  <input
                    type="date"
                    id={`eduEndDate-${index}`}
                    value={edu.endDate || ''}
                    onChange={(e) => handleEducationChange(index, 'endDate', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`gpa-${index}`}>GPA (optional)</label>
                  <input
                    type="text"
                    id={`gpa-${index}`}
                    value={edu.gpa || ''}
                    onChange={(e) => handleEducationChange(index, 'gpa', e.target.value)}
                    placeholder="3.8"
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
          <div className="skills-container">
            {profile.skills?.map((skill, index) => (
              <div key={index} className="skill-chip">
                <input
                  type="text"
                  placeholder="Enter skill"
                  value={typeof skill === 'string' ? skill : skill.name}
                  onChange={(e) => handleSkillChange(index, e.target.value)}
                />
                <button 
                  type="button" 
                  className="remove-skill-btn" 
                  onClick={() => removeSkill(index)}
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="add-skill-btn" onClick={addSkill}>
              + Add Skill
            </button>
          </div>
        </section>

        <div className="form-actions">
          {onCancel && (
            <button type="button" className="cancel-btn" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="save-btn">
            Save Profile
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditProfile; 