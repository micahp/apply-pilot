import { matchOption, stateVariants } from '../options';
import { normalizeProfile } from '../profile';
import { resolveAnswer } from '../answers';

describe('matchOption', () => {
  it('matches yes/no and ignores placeholders', () => {
    expect(matchOption(['Select...', 'Yes', 'No'], { type: 'bool', value: true })).toBe(1);
    expect(matchOption(['Select...', 'Yes', 'No'], { type: 'bool', value: false })).toBe(2);
  });

  it('handles sentence-style veteran and disability options', () => {
    const veteran = [
      'I am not a protected veteran',
      'I identify as one or more of the classifications of protected veteran',
      "I don't wish to answer",
    ];
    expect(matchOption(veteran, { type: 'bool', value: false })).toBe(0);
    expect(matchOption(veteran, { type: 'bool', value: true })).toBe(1);
    expect(matchOption(veteran, { type: 'decline' })).toBe(2);

    const disability = [
      'Yes, I have a disability (or previously had a disability)',
      'No, I do not have a disability and have not had one in the past',
      'I do not want to answer',
    ];
    expect(matchOption(disability, { type: 'bool', value: false })).toBe(1);
    expect(matchOption(disability, { type: 'decline' })).toBe(2);
  });

  it('does not guess "yes" among unrelated options', () => {
    expect(matchOption(['Male', 'Female', 'Non-binary'], { type: 'bool', value: true })).toBe(-1);
  });

  it('matches states by abbreviation or name', () => {
    expect(stateVariants('TX')).toEqual(['Texas', 'TX']);
    expect(matchOption(['Alabama', 'Texas', 'Utah'], { type: 'text', value: 'TX', aliases: stateVariants('TX') })).toBe(1);
  });

  it('matches by prefix, containment and token overlap', () => {
    expect(matchOption(["Associate's Degree", "Bachelor's Degree", "Master's Degree"], { type: 'text', value: "Bachelor's" })).toBe(1);
    expect(matchOption(['LinkedIn', 'Company website', 'Referral'], { type: 'text', value: 'Company Website' })).toBe(1);
    expect(matchOption(['Austin, Texas, United States', 'Austin, Minnesota, United States'], { type: 'text', value: 'Austin, TX', aliases: ['Austin, Texas'] })).toBe(0);
    expect(matchOption(['Red', 'Green'], { type: 'text', value: 'Purple' })).toBe(-1);
  });
});

describe('resolveAnswer', () => {
  const profile = normalizeProfile({
    personal: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '555-010-0000', city: 'Austin', state: 'TX', country: 'USA' },
    preferences: { usWorkAuth: 'Yes', sponsorshipRequired: 'No' },
    workExperience: [{ company: 'Old Co', title: 'Engineer', startDate: '2018', endDate: '2020' }, { company: 'Now Co', title: 'Staff Engineer', startDate: '2021', current: true }],
    eeo: { gender: 'Female', veteranStatus: 'No' },
    coverLetter: 'I want to join {{company}} as {{title}}.',
  });

  it('derives answers from the profile', () => {
    expect(resolveAnswer('fullName', profile)).toEqual({ type: 'text', value: 'Ada Lovelace', aliases: [] });
    expect(resolveAnswer('workAuthorized', profile)).toEqual({ type: 'bool', value: true });
    expect(resolveAnswer('requiresSponsorship', profile)).toEqual({ type: 'bool', value: false });
    expect(resolveAnswer('currentCompany', profile)).toMatchObject({ value: 'Now Co' });
    expect(resolveAnswer('location', profile)).toMatchObject({ value: 'Austin, TX' });
    expect(resolveAnswer('country', profile)).toMatchObject({ aliases: expect.arrayContaining(['United States']) });
  });

  it('declines unanswered EEO questions and maps yes/no ones to booleans', () => {
    expect(resolveAnswer('eeoRace', profile)).toEqual({ type: 'decline' });
    expect(resolveAnswer('eeoVeteran', profile)).toEqual({ type: 'bool', value: false });
    expect(resolveAnswer('eeoGender', profile)).toMatchObject({ value: 'Female', aliases: ['Woman', 'Female'] });
  });

  it('fills cover letter templates with the job', () => {
    expect(resolveAnswer('coverLetter', profile, { company: 'Acme', title: 'CTO' })).toMatchObject({ value: 'I want to join Acme as CTO.' });
  });

  it('returns null rather than inventing data', () => {
    expect(resolveAnswer('github', profile)).toBeNull();
    expect(resolveAnswer('willingToRelocate', profile)).toBeNull();
  });
});
