import React, { useState } from 'react';
import { Profile, PartialProfile, WorkExperience, Education, Skill } from '../types/profile';

interface ProfileFormProps {
  initialProfile?: PartialProfile;
  onSubmit: (profile: PartialProfile) => void;
  onCancel?: () => void;
}

const ProfileForm: React.FC<ProfileFormProps> = ({ initialProfile = {}, onSubmit, onCancel }) => {
  const [profile, setProfile] = useState<PartialProfile>({
    personal: initialProfile.personal || {},
    workExperience: initialProfile.workExperience || [{ company: '', title: '', startDate: '', description: '' }],
    education: initialProfile.education || [{ institution: '', degree: '', fieldOfStudy: '', startDate: '' }],
    skills: initialProfile.skills || [],
    eeo: initialProfile.eeo || {},
    documents: initialProfile.documents || {}
  });

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
    onSubmit(profile);
  };

  return (
    <form className="profile-form" onSubmit={handleSubmit}>
      {/* Personal Information Section */}
      <section className="form-section">
        <h3>Personal Information</h3>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="firstName">First Name</label>
            <input
              type="text"
              id="firstName"
              placeholder="John"
              value={profile.personal?.firstName || ''}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  personal: { ...profile.personal, firstName: e.target.value }
                })
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="lastName">Last Name</label>
            <input
              type="text"
              id="lastName"
              placeholder="Doe"
              value={profile.personal?.lastName || ''}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  personal: { ...profile.personal, lastName: e.target.value }
                })
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              placeholder="johndoe@example.com"
              value={profile.personal?.email || ''}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  personal: { ...profile.personal, email: e.target.value }
                })
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="phone">Phone</label>
            <input
              type="tel"
              id="phone"
              placeholder="(123) 456-7890"
              value={profile.personal?.phone || ''}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  personal: { ...profile.personal, phone: e.target.value }
                })
              }
            />
          </div>
        </div>
      </section>

      {/* Work Experience Section */}
      <section className="form-section">
        <h3>Work Experience</h3>
        {profile.workExperience?.map((exp, index) => (
          <div key={index} className="experience-item">
            <div className="experience-item-header">
              <div className="experience-item-title">Experience {index + 1}</div>
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
                  placeholder="Company Name"
                  value={exp.company || ''}
                  onChange={(e) => handleWorkExperienceChange(index, 'company', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor={`title-${index}`}>Title</label>
                <input
                  type="text"
                  id={`title-${index}`}
                  placeholder="Job Title"
                  value={exp.title || ''}
                  onChange={(e) => handleWorkExperienceChange(index, 'title', e.target.value)}
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
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label htmlFor={`description-${index}`}>Description</label>
                <textarea
                  id={`description-${index}`}
                  placeholder="Job responsibilities and achievements"
                  value={exp.description || ''}
                  onChange={(e) => handleWorkExperienceChange(index, 'description', e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>
        ))}
        <button type="button" onClick={addWorkExperience} className="add-btn">
          + Add Work Experience
        </button>
      </section>

      {/* Education Section */}
      <section className="form-section">
        <h3>Education</h3>
        {profile.education?.map((edu, index) => (
          <div key={index} className="education-item">
            <div className="education-item-header">
              <div className="education-item-title">Education {index + 1}</div>
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
                  placeholder="University Name"
                  value={edu.institution || ''}
                  onChange={(e) => handleEducationChange(index, 'institution', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor={`degree-${index}`}>Degree</label>
                <input
                  type="text"
                  id={`degree-${index}`}
                  placeholder="Bachelor's, Master's, etc."
                  value={edu.degree || ''}
                  onChange={(e) => handleEducationChange(index, 'degree', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor={`fieldOfStudy-${index}`}>Field of Study</label>
                <input
                  type="text"
                  id={`fieldOfStudy-${index}`}
                  placeholder="Computer Science, Business, etc."
                  value={edu.fieldOfStudy || ''}
                  onChange={(e) => handleEducationChange(index, 'fieldOfStudy', e.target.value)}
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
            </div>
          </div>
        ))}
        <button type="button" onClick={addEducation} className="add-btn">
          + Add Education
        </button>
      </section>

      {/* Skills Section */}
      <section className="form-section">
        <h3>Skills</h3>
        <div className="skill-chips">
          {profile.skills?.map((skill, index) => (
            <div key={index} className="skill-chip">
              <input
                type="text"
                placeholder="Enter skill"
                value={typeof skill === 'string' ? skill : skill.name}
                onChange={(e) => handleSkillChange(index, e.target.value)}
              />
              <button type="button" onClick={() => removeSkill(index)}>×</button>
            </div>
          ))}
          <button type="button" onClick={addSkill} className="add-skill-btn">
            + Add Skill
          </button>
        </div>
      </section>

      {/* EEO Section */}
      <section className="form-section">
        <h3>EEO Information</h3>
        <p className="form-description">
          This information is voluntary and will be kept confidential.
        </p>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="gender">Gender</label>
            <select
              id="gender"
              value={profile.eeo?.gender || ''}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  eeo: { ...profile.eeo, gender: e.target.value }
                })
              }
            >
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="nonbinary">Non-binary</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="ethnicity">Ethnicity</label>
            <select
              id="ethnicity"
              value={profile.eeo?.ethnicity || ''}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  eeo: { ...profile.eeo, ethnicity: e.target.value }
                })
              }
            >
              <option value="">Prefer not to say</option>
              <option value="white">White</option>
              <option value="black">Black or African American</option>
              <option value="hispanic">Hispanic or Latino</option>
              <option value="asian">Asian</option>
              <option value="native">Native American or Alaska Native</option>
              <option value="pacific">Native Hawaiian or Pacific Islander</option>
              <option value="mixed">Two or More Races</option>
            </select>
          </div>
        </div>
      </section>

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
  );
};

export default ProfileForm; 