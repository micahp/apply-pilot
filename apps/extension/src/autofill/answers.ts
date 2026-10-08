import type { FieldKey } from './classify';
import { renderTemplate, toBool, type ApplicantProfile } from './profile';
import { countryVariants, stateVariants, type Answer } from './options';
import { normalize } from './text';

export interface JobContext {
  company?: string;
  title?: string;
}

const GENDER_ALIASES: Record<string, string[]> = {
  male: ['Man', 'Male'],
  man: ['Man', 'Male'],
  female: ['Woman', 'Female'],
  woman: ['Woman', 'Female'],
};

const DEGREE_ALIASES: Array<[RegExp, string[]]> = [
  [/^(bs|ba|b\.?s\.?|b\.?a\.?|bachelor)/i, ["Bachelor's Degree", "Bachelor's", 'Bachelor', 'BS', 'BA']],
  [/^(ms|ma|m\.?s\.?|m\.?a\.?|master)/i, ["Master's Degree", "Master's", 'Master', 'MS', 'MA']],
  [/^(phd|ph\.?d|doctor)/i, ['Doctor of Philosophy (Ph.D.)', 'PhD', 'Ph.D.', 'Doctorate']],
  [/^(associate)/i, ["Associate's Degree", "Associate's", 'Associate']],
  [/^(mba)/i, ['Master of Business Administration (M.B.A.)', 'MBA']],
];

function text(value: string | undefined, aliases: string[] = []): Answer | null {
  return value ? { type: 'text', value, aliases } : null;
}

function bool(value: boolean | undefined): Answer | null {
  return value === undefined ? null : { type: 'bool', value };
}

const DECLINE_WORDS = /\b(decline|prefer not)\b/;

/** Empty EEO answers decline; yes/no-style answers match yes/no options; anything else matches by text. */
function eeo(value: string | undefined, aliases: string[] = []): Answer {
  if (!value) return { type: 'decline' };
  if (DECLINE_WORDS.test(normalize(value))) return { type: 'decline' };
  const asBool = toBool(value);
  return asBool === undefined ? { type: 'text', value, aliases } : { type: 'bool', value: asBool };
}

function currentJob(profile: ApplicantProfile) {
  return profile.workExperience.find((w) => w.current) || profile.workExperience[0];
}

/**
 * Pattern from a custom answer: `/regex/flags` or a plain case-insensitive substring.
 */
function customMatches(pattern: string, question: string): boolean {
  const regex = pattern.match(/^\/(.+)\/([a-z]*)$/);
  if (regex) {
    try {
      return new RegExp(regex[1], regex[2].includes('i') ? regex[2] : regex[2] + 'i').test(question);
    } catch {
      return false;
    }
  }
  return normalize(question).includes(normalize(pattern));
}

export function customAnswerFor(profile: ApplicantProfile, question: string, job: JobContext = {}): Answer | null {
  if (!question) return null;
  const hit = profile.customAnswers.find((a) => customMatches(a.question, question));
  return hit ? { type: 'text', value: renderTemplate(hit.answer, job) } : null;
}

export function resolveAnswer(key: FieldKey, profile: ApplicantProfile, job: JobContext = {}): Answer | null {
  const p = profile.personal;
  const prefs = profile.preferences;
  const edu = profile.education[0];

  switch (key) {
    case 'firstName': return text(p.firstName);
    case 'lastName': return text(p.lastName);
    case 'preferredName': return text(p.preferredName || p.firstName);
    case 'fullName': return text([p.firstName, p.lastName].filter(Boolean).join(' '));
    case 'email': return text(p.email);
    case 'phone': return text(p.phone);
    case 'address': return text(p.address);
    case 'city': return text(p.city);
    case 'state': return p.state ? text(p.state, stateVariants(p.state)) : null;
    case 'zipCode': return text(p.zipCode);
    case 'country': return p.country ? text(p.country, countryVariants(p.country)) : null;
    case 'location': {
      if (!p.city) return null;
      const states = p.state ? stateVariants(p.state) : [];
      const primary = [p.city, p.state].filter(Boolean).join(', ');
      return text(primary, [...states.map((s) => `${p.city}, ${s}`), p.city]);
    }
    case 'linkedIn': return text(p.linkedIn);
    case 'github': return text(p.github);
    case 'twitter': return text(p.twitter);
    case 'website': return text(p.website);
    case 'pronouns': return text(p.pronouns);
    case 'currentCompany': return text(currentJob(profile)?.company);
    case 'currentTitle': return text(currentJob(profile)?.title);
    case 'school': return text(edu?.institution);
    case 'degree': {
      if (!edu?.degree) return null;
      const aliases = DEGREE_ALIASES.find(([re]) => re.test(edu.degree!.trim()))?.[1] || [];
      return text(edu.degree, aliases);
    }
    case 'fieldOfStudy': return text(edu?.fieldOfStudy);
    case 'gpa': return text(edu?.gpa);
    case 'workAuthorized': return bool(prefs.workAuthorized);
    case 'requiresSponsorship': return bool(prefs.requiresSponsorship);
    case 'willingToRelocate': return bool(prefs.willingToRelocate);
    case 'desiredSalary': return text(prefs.desiredSalary);
    case 'availableStartDate': return text(prefs.availableStartDate);
    case 'noticePeriod': return text(prefs.noticePeriod);
    case 'howDidYouHear': return text(prefs.howDidYouHear);
    case 'eeoGender': return eeo(profile.eeo.gender, GENDER_ALIASES[normalize(profile.eeo.gender)] || []);
    case 'eeoRace': return eeo(profile.eeo.race);
    case 'eeoHispanic': return eeo(profile.eeo.hispanicOrLatino);
    case 'eeoVeteran': return eeo(profile.eeo.veteranStatus);
    case 'eeoDisability': return eeo(profile.eeo.disabilityStatus);
    case 'coverLetter': return profile.coverLetter ? text(renderTemplate(profile.coverLetter, job)) : null;
    case 'resume':
    case 'coverLetterFile':
      return null; // Files are attached by the caller, not typed.
  }
}
