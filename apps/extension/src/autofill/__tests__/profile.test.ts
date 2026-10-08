import { normalizeProfile, renderTemplate, validateProfile } from '../profile';

describe('normalizeProfile', () => {
  it('accepts the extension storage shape', () => {
    const p = normalizeProfile({
      personal: { firstName: ' Ada ', lastName: 'Lovelace', email: 'ada@example.com', phone: '1' },
      documents: { coverLetter: 'Hello {{company}}' },
      skills: [{ name: 'Python' }, 'Rust', { name: '' }],
      eeo: { veteranStatus: false, ethnicity: 'Asian' },
      workExperience: [{ company: 'A', title: 'B', startDate: '2020' }, { company: '', title: '' }],
    });
    expect(p.personal.firstName).toBe('Ada');
    expect(p.coverLetter).toBe('Hello {{company}}');
    expect(p.skills).toEqual(['Python', 'Rust']);
    expect(p.eeo).toMatchObject({ veteranStatus: 'No', race: 'Asian' });
    expect(p.workExperience).toEqual([expect.objectContaining({ company: 'A', current: true })]);
  });

  it('accepts the profile.json shape', () => {
    const p = normalizeProfile({
      personal: { firstName: 'Ada' },
      preferences: { usWorkAuth: 'Yes', sponsorshipRequired: 'No', willingToRelocate: 'maybe' },
      coverLetterBase: 'Base letter',
      customAnswers: { 'years of experience': 8, empty: '' },
    });
    expect(p.preferences).toMatchObject({ workAuthorized: true, requiresSponsorship: false, willingToRelocate: undefined });
    expect(p.coverLetter).toBe('Base letter');
    expect(p.customAnswers).toEqual([{ question: 'years of experience', answer: '8' }]);
  });
});

describe('validateProfile', () => {
  it('lists missing essentials', () => {
    expect(validateProfile(normalizeProfile({ personal: { firstName: 'Ada', email: 'nope' } }))).toEqual([
      'personal.lastName is required',
      'personal.email must be a valid email address',
      'personal.phone is required',
    ]);
  });
});

describe('renderTemplate', () => {
  it('substitutes company and title', () => {
    expect(renderTemplate('{{ title }} at {{company}}', { company: 'Acme', title: 'CTO' })).toBe('CTO at Acme');
  });
});
