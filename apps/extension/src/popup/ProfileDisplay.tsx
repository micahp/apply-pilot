import React from 'react';
import { PartialProfile } from '../types/profile';
import './styles.css';

interface ProfileDisplayProps {
  profile: PartialProfile;
  onEdit: () => void;
  isWorkExperienceOpen: boolean;
  toggleWorkExperience: () => void;
}

const ProfileDisplay: React.FC<ProfileDisplayProps> = ({ profile, onEdit, isWorkExperienceOpen, toggleWorkExperience }) => {
  return (
    <div className="profile-display">
      <div className="profile-section">
        <h2>Personal Information</h2>
        <div className="info-grid">
          <div className="info-item">
            <div className="info-label">Name</div>
            <div className="info-value">
              {profile.personal?.firstName} {profile.personal?.lastName}
            </div>
          </div>
          <div className="info-item">
            <div className="info-label">Email</div>
            <div className="info-value email-value">
              {profile.personal?.email || 'Not provided'}
            </div>
          </div>
          <div className="info-item">
            <div className="info-label">Phone</div>
            <div className="info-value">
              {profile.personal?.phone || 'Not provided'}
            </div>
          </div>
          {profile.personal?.linkedIn && (
            <div className="info-item">
              <div className="info-label">LinkedIn</div>
              <div className="info-value">
                <a href={profile.personal.linkedIn} target="_blank" rel="noopener noreferrer">
                  {profile.personal.linkedIn}
                </a>
              </div>
            </div>
          )}
          {profile.personal?.github && (
            <div className="info-item">
              <div className="info-label">GitHub</div>
              <div className="info-value">
                <a href={profile.personal.github} target="_blank" rel="noopener noreferrer">
                  {profile.personal.github}
                </a>
              </div>
            </div>
          )}
          {profile.personal?.website && (
            <div className="info-item">
              <div className="info-label">Website</div>
              <div className="info-value">
                <a href={profile.personal.website} target="_blank" rel="noopener noreferrer">
                  {profile.personal.website}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {profile.workExperience && profile.workExperience.length > 0 && (
        <div className="profile-section work-experience-section">
          <h2 onClick={toggleWorkExperience} className="collapsible-header">
            Work Experience {isWorkExperienceOpen ? '\u25BC' /* ▼ */ : '\u25B6' /* ► */}
          </h2>
          {isWorkExperienceOpen && (
            <div className="collapsible-content">
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
        <button className="primary-btn" onClick={onEdit}>
          Edit Profile
        </button>
      </div>
    </div>
  );
};

export default ProfileDisplay; 