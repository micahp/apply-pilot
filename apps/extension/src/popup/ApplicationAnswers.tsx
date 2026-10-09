import React from 'react';
import type { CustomAnswer, EEOData, PartialProfile, PersonalInfo, Preferences, StoredFile, YesNo } from '../types/profile';

interface Props {
  profile: PartialProfile;
  onChange: (profile: PartialProfile) => void;
}

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const YesNoSelect: React.FC<{ id: string; label: string; value?: YesNo; onChange: (v: YesNo) => void }> = ({ id, label, value, onChange }) => (
  <div className="form-group">
    <label htmlFor={id}>{label}</label>
    <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value as YesNo)}>
      <option value="">Leave unanswered</option>
      <option value="Yes">Yes</option>
      <option value="No">No</option>
    </select>
  </div>
);

/**
 * Everything the autofill engine needs beyond the resume basics: location, screening
 * answers, EEO choices, cover letter template, custom answers and the resume file.
 */
const ApplicationAnswers: React.FC<Props> = ({ profile, onChange }) => {
  const personal = profile.personal || {};
  const prefs = profile.preferences || {};
  const eeo = profile.eeo || {};
  const answers = profile.customAnswers || [];
  const [resumeError, setResumeError] = React.useState<string | null>(null);

  const setPersonal = (field: keyof PersonalInfo, value: string) => onChange({ ...profile, personal: { ...personal, [field]: value } });
  const setPref = (field: keyof Preferences, value: string) => onChange({ ...profile, preferences: { ...prefs, [field]: value } });
  const setEeo = (field: keyof EEOData, value: string) => onChange({ ...profile, eeo: { ...eeo, [field]: value } });
  const setAnswers = (next: CustomAnswer[]) => onChange({ ...profile, customAnswers: next });

  const handleResume = async (file: File | undefined) => {
    setResumeError(null);
    if (!file) return;
    if (file.size > MAX_RESUME_BYTES) {
      setResumeError('Resume must be under 5 MB.');
      return;
    }
    const resumeFile: StoredFile = { name: file.name, type: file.type || 'application/pdf', dataUrl: await readAsDataUrl(file) };
    onChange({ ...profile, resumeFile });
  };

  const text = (id: string, label: string, value: string | undefined, set: (v: string) => void, placeholder = '') => (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <input type="text" id={id} value={value || ''} placeholder={placeholder} onChange={(e) => set(e.target.value)} />
    </div>
  );

  return (
    <>
      <section className="form-section">
        <h2>Location</h2>
        <div className="form-grid">
          {text('city', 'City', personal.city, (v) => setPersonal('city', v), 'Austin')}
          {text('state', 'State', personal.state, (v) => setPersonal('state', v), 'TX')}
          {text('zipCode', 'Zip code', personal.zipCode, (v) => setPersonal('zipCode', v))}
          {text('country', 'Country', personal.country, (v) => setPersonal('country', v), 'United States')}
        </div>
      </section>

      <section className="form-section">
        <h2>Resume file</h2>
        <div className="form-group full-width">
          <label htmlFor="resumeFile">Attached to application forms automatically</label>
          <input type="file" id="resumeFile" accept=".pdf,.doc,.docx" onChange={(e) => handleResume(e.target.files?.[0])} />
          {profile.resumeFile && (
            <span className="form-hint">
              Current: {profile.resumeFile.name}{' '}
              <button type="button" className="remove-btn" onClick={() => onChange({ ...profile, resumeFile: undefined })}>Remove</button>
            </span>
          )}
          {resumeError && <span className="error-message">{resumeError}</span>}
        </div>
      </section>

      <section className="form-section">
        <h2>Screening questions</h2>
        <div className="form-grid">
          <YesNoSelect id="workAuthorized" label="Authorized to work in the US?" value={prefs.workAuthorized} onChange={(v) => setPref('workAuthorized', v)} />
          <YesNoSelect id="requiresSponsorship" label="Require visa sponsorship?" value={prefs.requiresSponsorship} onChange={(v) => setPref('requiresSponsorship', v)} />
          <YesNoSelect id="willingToRelocate" label="Willing to relocate?" value={prefs.willingToRelocate} onChange={(v) => setPref('willingToRelocate', v)} />
          {text('desiredSalary', 'Desired salary', prefs.desiredSalary, (v) => setPref('desiredSalary', v), '$180,000')}
          {text('availableStartDate', 'Earliest start date', prefs.availableStartDate, (v) => setPref('availableStartDate', v), 'Two weeks after offer')}
          {text('howDidYouHear', 'How did you hear about us?', prefs.howDidYouHear, (v) => setPref('howDidYouHear', v), 'Company website')}
        </div>
      </section>

      <section className="form-section">
        <h2>Cover letter</h2>
        <div className="form-group full-width">
          <label htmlFor="coverLetter">Template ({'{{company}}'} and {'{{title}}'} are filled in per job)</label>
          <textarea
            id="coverLetter"
            rows={5}
            value={profile.documents?.coverLetter || ''}
            onChange={(e) => onChange({ ...profile, documents: { ...profile.documents, coverLetter: e.target.value } })}
          />
        </div>
      </section>

      <section className="form-section">
        <h2>Voluntary self-identification</h2>
        <p className="form-hint">Leave blank to choose &ldquo;decline to self-identify&rdquo; when the form offers it.</p>
        <div className="form-grid">
          {text('gender', 'Gender', eeo.gender, (v) => setEeo('gender', v))}
          {text('race', 'Race', eeo.race ?? eeo.ethnicity, (v) => setEeo('race', v))}
          <YesNoSelect id="hispanicOrLatino" label="Hispanic or Latino?" value={eeo.hispanicOrLatino as YesNo} onChange={(v) => setEeo('hispanicOrLatino', v)} />
          <YesNoSelect id="veteranStatus" label="Protected veteran?" value={eeo.veteranStatus as YesNo} onChange={(v) => setEeo('veteranStatus', v)} />
          <YesNoSelect id="disabilityStatus" label="Disability?" value={eeo.disabilityStatus as YesNo} onChange={(v) => setEeo('disabilityStatus', v)} />
        </div>
      </section>

      <section className="form-section">
        <h2>Custom answers</h2>
        <p className="form-hint">Matched against question text (substring, or /regex/). Checked before the built-in answers.</p>
        {answers.map((a, i) => (
          <div key={i} className="form-grid custom-answer">
            <div className="form-group">
              <label htmlFor={`cq-${i}`}>Question contains</label>
              <input id={`cq-${i}`} value={a.question} placeholder="years of experience" onChange={(e) => setAnswers(answers.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} />
            </div>
            <div className="form-group">
              <label htmlFor={`ca-${i}`}>Answer</label>
              <input id={`ca-${i}`} value={a.answer} placeholder="8" onChange={(e) => setAnswers(answers.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} />
            </div>
            <button type="button" className="remove-btn" onClick={() => setAnswers(answers.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <button type="button" className="add-btn" onClick={() => setAnswers([...answers, { question: '', answer: '' }])}>
          + Add Answer
        </button>
      </section>
    </>
  );
};

export default ApplicationAnswers;
