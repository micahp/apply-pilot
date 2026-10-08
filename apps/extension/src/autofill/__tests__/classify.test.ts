import { classifyField } from '../classify';

describe('classifyField', () => {
  it.each([
    ['First Name', 'firstName'],
    ['Legal first name *', 'firstName'],
    ['Last Name', 'lastName'],
    ['Preferred First Name', 'preferredName'],
    ['Full name', 'fullName'],
    ['Name', 'fullName'],
    ['Email', 'email'],
    ['E-mail address', 'email'],
    ['Phone', 'phone'],
    ['Mobile number', 'phone'],
    ['LinkedIn Profile', 'linkedIn'],
    ['GitHub URL', 'github'],
    ['Website', 'website'],
    ['Portfolio link', 'website'],
    ['Current location', 'location'],
    ['Location (City)', 'city'],
    ['State', 'state'],
    ['Country', 'country'],
    ['Zip / Postal code', 'zipCode'],
    ['Current company', 'currentCompany'],
    ['Current title', 'currentTitle'],
    ['School', 'school'],
    ['Degree', 'degree'],
    ['Discipline', 'fieldOfStudy'],
    ['Are you legally authorized to work in the United States?', 'workAuthorized'],
    ['Are you authorized to work in the US without the need for visa sponsorship?', 'workAuthorized'],
    ['Will you now or in the future require sponsorship for employment visa status (e.g. H-1B)?', 'requiresSponsorship'],
    ['Are you willing to relocate to San Francisco?', 'willingToRelocate'],
    ['What are your salary expectations?', 'desiredSalary'],
    ['What is the earliest date you can start?', 'availableStartDate'],
    ['How did you hear about this job?', 'howDidYouHear'],
    ['Gender', 'eeoGender'],
    ['Are you Hispanic/Latino?', 'eeoHispanic'],
    ['Please identify your race', 'eeoRace'],
    ['Veteran Status', 'eeoVeteran'],
    ['Disability Status', 'eeoDisability'],
    ['Cover Letter', 'coverLetter'],
  ])('%s -> %s', (question, key) => {
    expect(classifyField({ question })).toBe(key);
  });

  it('does not mistake screening questions for contact fields', () => {
    expect(classifyField({ question: 'Why do you want to work at our company? Tell us about a project you are proud of.' })).toBeNull();
    expect(classifyField({ question: 'Please state your reasons for applying' })).toBeNull();
    expect(classifyField({ question: 'What is the name of the person who referred you to this role?' })).toBeNull();
  });

  it('uses attributes when there is no visible label', () => {
    expect(classifyField({ question: '', attributes: 'job application first name' })).toBe('firstName');
  });

  it('prefers the autocomplete attribute', () => {
    expect(classifyField({ question: 'Something odd', autocomplete: 'section-a given-name' })).toBe('firstName');
  });

  it('only applies file rules to file inputs', () => {
    expect(classifyField({ question: 'Resume/CV', isFile: true })).toBe('resume');
    expect(classifyField({ question: 'Cover Letter', isFile: true })).toBe('coverLetterFile');
    expect(classifyField({ question: 'Attach', isFile: true })).toBeNull();
    expect(classifyField({ question: 'Email', isFile: true })).toBeNull();
  });
});
