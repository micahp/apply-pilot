import React from 'react';
import { Profile, Skill } from '../types/profile';

interface ProfileDisplayProps {
  profile: Profile;
  onEdit?: () => void;
}

export const ProfileDisplay: React.FC<ProfileDisplayProps> = ({ profile, onEdit }) => {
  return (
    <div className="profile-display">
      <section className="profile-section">
        <h2>Personal Information</h2>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Name</span>
            <span className="info-value">
              {profile.personal.firstName} {profile.personal.lastName}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Email</span>
            <span className="info-value email-value">{profile.personal.email}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Phone</span>
            <span className="info-value">{profile.personal.phone}</span>
          </div>
        </div>
      </section>

      <section className="profile-section">
        <h2>Work Experience</h2>
        {profile.workExperience.length === 0 ? (
          <p className="empty-message">No work experience added.</p>
        ) : (
          <div className="experience-list">
            {profile.workExperience.map((exp, index) => (
              <div key={index} className="experience-item">
                <h3>{exp.title} at {exp.company}</h3>
                <div className="experience-details">
                  {exp.startDate && (
                    <span className="experience-dates">
                      {exp.startDate} - {exp.endDate || 'Present'}
                    </span>
                  )}
                  {exp.location && (
                    <span className="experience-location">{exp.location}</span>
                  )}
                </div>
                {exp.description && (
                  <p className="experience-description">{exp.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="profile-section">
        <h2>Education</h2>
        {profile.education.length === 0 ? (
          <p className="empty-message">No education added.</p>
        ) : (
          <div className="education-list">
            {profile.education.map((edu, index) => (
              <div key={index} className="education-item">
                <h3>{edu.degree} in {edu.fieldOfStudy}</h3>
                <div className="education-details">
                  <span className="education-institution">{edu.institution}</span>
                  <span className="education-dates">
                    {edu.startDate} - {edu.endDate || 'Present'}
                  </span>
                  {edu.gpa && <span className="education-gpa">GPA: {edu.gpa}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="profile-section">
        <h2>EEO Information</h2>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Gender</span>
            <span className="info-value">
              {!profile.eeo.gender ? 'Not specified' : 
              profile.eeo.gender === 'PREFER_NOT_TO_SAY' 
                ? 'Prefer not to say' 
                : profile.eeo.gender?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Ethnicity</span>
            <span className="info-value">
              {!profile.eeo.ethnicity ? 'Not specified' :
              profile.eeo.ethnicity === 'OTHER' 
                ? 'Other' 
                : profile.eeo.ethnicity?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
            </span>
          </div>
        </div>
      </section>

      <section className="profile-section">
        <h2>Skills</h2>
        {profile.skills.length === 0 ? (
          <p className="empty-message">No skills added.</p>
        ) : (
          <div className="skills-list">
            {profile.skills.map((skill: Skill, index) => (
              <span key={index} className="skill-tag">{skill.name}</span>
            ))}
          </div>
        )}
      </section>

      {onEdit && (
        <div className="profile-actions">
          <button className="primary-btn" onClick={onEdit}>
            Edit Profile
          </button>
        </div>
      )}
    </div>
  );
}; 