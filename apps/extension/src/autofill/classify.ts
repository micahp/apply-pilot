import { normalize } from './text';

export type FieldKey =
  | 'firstName' | 'lastName' | 'fullName' | 'preferredName' | 'email' | 'phone'
  | 'address' | 'city' | 'state' | 'zipCode' | 'country' | 'location'
  | 'linkedIn' | 'github' | 'twitter' | 'website'
  | 'currentCompany' | 'currentTitle'
  | 'school' | 'degree' | 'fieldOfStudy' | 'gpa'
  | 'workAuthorized' | 'requiresSponsorship' | 'willingToRelocate'
  | 'desiredSalary' | 'availableStartDate' | 'noticePeriod' | 'howDidYouHear' | 'pronouns'
  | 'eeoGender' | 'eeoRace' | 'eeoHispanic' | 'eeoVeteran' | 'eeoDisability'
  | 'coverLetter' | 'resume' | 'coverLetterFile';

interface Rule {
  key: FieldKey;
  pattern: RegExp;
  /** Contact-style rules only apply to short labels; long text is a screening question. */
  maxLength?: number;
  exclude?: RegExp;
  files?: boolean;
}

/**
 * Ordered most-specific first. Each pattern runs against the normalized question text,
 * falling back to the humanized name/id when the question has no visible label.
 */
const RULES: Rule[] = [
  { key: 'resume', pattern: /\b(resume|cv|curriculum vitae)\b/, files: true },
  { key: 'coverLetterFile', pattern: /\bcover letter\b/, files: true },

  { key: 'eeoHispanic', pattern: /\bhispanic\b|\blatin[oax]\b/ },
  { key: 'eeoGender', pattern: /\bgender\b|\bsex\b/, exclude: /orientation|pronoun/ },
  { key: 'eeoRace', pattern: /\brace\b|\bethnicit/ },
  { key: 'eeoVeteran', pattern: /\bveteran\b|\bmilitary service\b/ },
  { key: 'eeoDisability', pattern: /\bdisabilit/ },
  { key: 'pronouns', pattern: /\bpronouns?\b/ },

  // "Authorized to work without sponsorship?" is an authorization question, answered Yes.
  { key: 'workAuthorized', pattern: /\bwithout (the need for |needing |requiring )?(visa |employer )?sponsor/ },
  { key: 'requiresSponsorship', pattern: /\bsponsor|\bvisa\b|\bh ?1 ?b\b/ },
  { key: 'workAuthorized', pattern: /\b(authori[sz]ed|eligible|right|permitted) to work\b|\bwork (authori[sz]ation|permit)\b|\blegally (able|allowed)\b/ },
  { key: 'willingToRelocate', pattern: /\breloca/ },
  { key: 'desiredSalary', pattern: /\bsalary\b|\bcompensation (expectation|requirement)|\b(desired|expected|target) (pay|compensation|salary)/ },
  { key: 'noticePeriod', pattern: /\bnotice period\b/ },
  { key: 'availableStartDate', pattern: /\bearliest\b.*\bstart\b|\bwhen can you start\b|\bavailab\w* to start\b|\bdate available\b|\bavailable start\b/ },
  { key: 'howDidYouHear', pattern: /\bhow did you (hear|find|learn)\b|\breferral source\b|\bwhere did you (hear|find)\b/ },

  { key: 'coverLetter', pattern: /\bcover letter\b/ },
  { key: 'linkedIn', pattern: /\blinked ?in\b/, maxLength: 80 },
  { key: 'github', pattern: /\bgit ?hub\b/, maxLength: 80 },
  { key: 'twitter', pattern: /\btwitter\b|\bx\.com\b/, maxLength: 60 },
  { key: 'website', pattern: /\bwebsite\b|\bportfolio\b|\bpersonal (site|url|page)\b|\bblog\b/, maxLength: 80 },

  { key: 'email', pattern: /\be ?mail\b/, maxLength: 60 },
  { key: 'phone', pattern: /\bphone\b|\bmobile\b|\bcell\b|\btelephone\b/, maxLength: 60 },
  { key: 'preferredName', pattern: /\bpreferred (first )?name\b|\bnickname\b/, maxLength: 50 },
  { key: 'firstName', pattern: /\bfirst name\b|\bgiven name\b|\bforename\b|\bfname\b/, maxLength: 50 },
  { key: 'lastName', pattern: /\blast name\b|\bsurname\b|\bfamily name\b|\blname\b/, maxLength: 50 },
  { key: 'currentCompany', pattern: /\b(current|most recent) (company|employer)\b|^(company|employer|organization)( name)?$/, maxLength: 50 },
  { key: 'currentTitle', pattern: /\b(current|most recent) (job )?(title|role|position)\b|^(job )?title$/, maxLength: 50 },
  { key: 'school', pattern: /\bschool\b|\buniversity\b|\bcollege\b|\binstitution\b/, maxLength: 50 },
  { key: 'degree', pattern: /\bdegree\b/, maxLength: 40 },
  { key: 'fieldOfStudy', pattern: /\bdiscipline\b|\bfield of study\b|\bmajor\b/, maxLength: 40 },
  { key: 'gpa', pattern: /\bgpa\b|\bgrade point\b/, maxLength: 40 },
  { key: 'fullName', pattern: /^(your )?(full |legal |full legal )?name$/, maxLength: 30 },
  { key: 'zipCode', pattern: /\bzip\b|\bpostal\b|\bpostcode\b/, maxLength: 40 },
  { key: 'address', pattern: /\bstreet\b|\baddress( line)?( 1)?$/, maxLength: 40, exclude: /mail|web|url/ },
  { key: 'city', pattern: /\bcity\b|\btown\b/, maxLength: 40 },
  { key: 'state', pattern: /\bstate\b|\bprovince\b/, maxLength: 40, exclude: /\b(please|briefly) state\b|\bstate (your|the|why|how|what)\b/ },
  { key: 'country', pattern: /\bcountry\b/, maxLength: 40 },
  { key: 'location', pattern: /\blocation\b|\bwhere are you (located|based)\b|\bcurrent(ly)? (based|located)\b/, maxLength: 60 },
];

/** Values of the HTML `autocomplete` attribute are the most reliable signal when present. */
const AUTOCOMPLETE: Record<string, FieldKey> = {
  'given-name': 'firstName',
  'family-name': 'lastName',
  name: 'fullName',
  email: 'email',
  tel: 'phone',
  'tel-national': 'phone',
  'street-address': 'address',
  'address-line1': 'address',
  'address-level2': 'city',
  'address-level1': 'state',
  'postal-code': 'zipCode',
  country: 'country',
  'country-name': 'country',
  organization: 'currentCompany',
  'organization-title': 'currentTitle',
  url: 'website',
};

export interface ClassifyInput {
  question: string;
  /** Humanized name/id/placeholder, used only if the question text yields nothing. */
  attributes?: string;
  autocomplete?: string | null;
  isFile?: boolean;
}

export function classifyField({ question, attributes = '', autocomplete, isFile = false }: ClassifyInput): FieldKey | null {
  const auto = autocomplete?.trim().toLowerCase().split(/\s+/).pop();
  if (!isFile && auto && AUTOCOMPLETE[auto]) return AUTOCOMPLETE[auto];

  for (const text of [normalize(question), normalize(attributes)]) {
    if (!text) continue;
    for (const rule of RULES) {
      if (Boolean(rule.files) !== isFile) continue;
      if (rule.maxLength && text.length > rule.maxLength) continue;
      if (rule.exclude?.test(text)) continue;
      if (rule.pattern.test(text)) return rule.key;
    }
  }
  return null;
}
