/**
 * Canonical applicant profile used by the autofill engine.
 *
 * `normalizeProfile` accepts both the shape the extension stores (see types/profile.ts)
 * and the `profile.json` shape used by the Playwright script, so there is exactly one
 * place that knows how loosely-typed user data maps onto form answers.
 */

export interface ApplicantProfile {
  personal: {
    firstName: string;
    lastName: string;
    preferredName?: string;
    email: string;
    phone: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    linkedIn?: string;
    github?: string;
    website?: string;
    twitter?: string;
    pronouns?: string;
  };
  workExperience: Array<{
    company: string;
    title: string;
    startDate?: string;
    endDate?: string;
    current?: boolean;
    location?: string;
    description?: string;
  }>;
  education: Array<{
    institution: string;
    degree?: string;
    fieldOfStudy?: string;
    startDate?: string;
    endDate?: string;
    gpa?: string;
  }>;
  skills: string[];
  preferences: {
    workAuthorized?: boolean;
    requiresSponsorship?: boolean;
    willingToRelocate?: boolean;
    desiredSalary?: string;
    availableStartDate?: string;
    noticePeriod?: string;
    howDidYouHear?: string;
  };
  /** Empty values mean "decline to self-identify" when the form offers that option. */
  eeo: {
    gender?: string;
    race?: string;
    hispanicOrLatino?: string;
    veteranStatus?: string;
    disabilityStatus?: string;
  };
  /** Supports {{company}} and {{title}} placeholders. */
  coverLetter?: string;
  /** Answers to screening questions; `question` is a case-insensitive substring or a /regex/. */
  customAnswers: Array<{ question: string; answer: string }>;
  /** Local path to the resume file (Playwright script). */
  resumePath?: string;
  /** Resume stored in the extension as a data URL. */
  resumeFile?: { name: string; type: string; dataUrl: string };
}

export function toBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  const v = value.trim().toLowerCase();
  if (/^(y|yes|true|1)\b/.test(v)) return true;
  if (/^(n|no|false|0)\b/.test(v)) return false;
  return undefined;
}

function str(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const s = String(value).trim();
  return s === '' ? undefined : s;
}

function customAnswersFrom(raw: unknown): ApplicantProfile['customAnswers'] {
  if (Array.isArray(raw)) {
    return raw
      .filter((a) => a && str(a.question) && str(a.answer))
      .map((a) => ({ question: String(a.question), answer: String(a.answer) }));
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, answer]) => str(answer))
      .map(([question, answer]) => ({ question, answer: String(answer) }));
  }
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeProfile(raw: any): ApplicantProfile {
  const p = raw?.personal || {};
  const prefs = raw?.preferences || {};
  const eeo = raw?.eeo || {};

  return {
    personal: {
      firstName: str(p.firstName) || '',
      lastName: str(p.lastName) || '',
      preferredName: str(p.preferredName),
      email: str(p.email) || '',
      phone: str(p.phone) || '',
      address: str(p.address),
      city: str(p.city),
      state: str(p.state),
      zipCode: str(p.zipCode),
      country: str(p.country),
      linkedIn: str(p.linkedIn),
      github: str(p.github),
      website: str(p.website),
      twitter: str(p.twitter),
      pronouns: str(p.pronouns),
    },
    workExperience: (raw?.workExperience || [])
      .filter((w: any) => w && (str(w.company) || str(w.title)))
      .map((w: any) => ({
        company: str(w.company) || '',
        title: str(w.title) || '',
        startDate: str(w.startDate),
        endDate: str(w.endDate),
        current: Boolean(w.current ?? w.currentlyWorkHere) || (!str(w.endDate) && Boolean(str(w.startDate))),
        location: str(w.location),
        description: str(w.description),
      })),
    education: (raw?.education || [])
      .filter((e: any) => e && str(e.institution))
      .map((e: any) => ({
        institution: str(e.institution) || '',
        degree: str(e.degree),
        fieldOfStudy: str(e.fieldOfStudy),
        startDate: str(e.startDate),
        endDate: str(e.endDate),
        gpa: str(e.gpa),
      })),
    skills: (raw?.skills || [])
      .map((s: any) => (typeof s === 'string' ? s : s?.name))
      .filter((s: unknown): s is string => typeof s === 'string' && s.trim() !== ''),
    preferences: {
      workAuthorized: toBool(prefs.workAuthorized ?? prefs.usWorkAuth),
      requiresSponsorship: toBool(prefs.requiresSponsorship ?? prefs.sponsorshipRequired),
      willingToRelocate: toBool(prefs.willingToRelocate),
      desiredSalary: str(prefs.desiredSalary),
      availableStartDate: str(prefs.availableStartDate),
      noticePeriod: str(prefs.noticePeriod),
      howDidYouHear: str(prefs.howDidYouHear),
    },
    eeo: {
      gender: str(eeo.gender),
      race: str(eeo.race ?? eeo.ethnicity),
      hispanicOrLatino: str(eeo.hispanicOrLatino),
      veteranStatus: str(eeo.veteranStatus),
      disabilityStatus: str(eeo.disabilityStatus),
    },
    coverLetter: str(raw?.coverLetter ?? raw?.documents?.coverLetter ?? raw?.documents?.coverLetterText ?? raw?.coverLetterBase),
    customAnswers: customAnswersFrom(raw?.customAnswers),
    resumePath: str(raw?.resumePath),
    resumeFile: raw?.resumeFile?.dataUrl ? raw.resumeFile : undefined,
  };
}

/** Problems that make a profile unusable for applying; empty when the profile is complete enough. */
export function validateProfile(profile: ApplicantProfile): string[] {
  const problems: string[] = [];
  if (!profile.personal.firstName) problems.push('personal.firstName is required');
  if (!profile.personal.lastName) problems.push('personal.lastName is required');
  if (!/^\S+@\S+\.\S+$/.test(profile.personal.email)) problems.push('personal.email must be a valid email address');
  if (!profile.personal.phone) problems.push('personal.phone is required');
  return problems;
}

export function renderTemplate(template: string, vars: { company?: string; title?: string }): string {
  return template
    .replace(/\{\{\s*company\s*\}\}/gi, vars.company || 'your company')
    .replace(/\{\{\s*title\s*\}\}/gi, vars.title || 'this role');
}
