import { normalize, overlap } from './text';
import { toBool } from './profile';

export type Answer =
  | { type: 'text'; value: string; aliases?: string[] }
  | { type: 'bool'; value: boolean }
  /** Choose the "decline to self-identify" option; text inputs are left empty. */
  | { type: 'decline' };

const PLACEHOLDER = /^(select|choose|please select|please choose|select one|select an option|none selected|--+|)$/;
const DECLINE = /\b(decline|prefer not|dont wish|do not wish|dont want|do not want|not to (answer|say|disclose|self identify)|choose not|rather not)\b/;
const NEGATIVE = /\b(no|not|dont|do not|will not|wont|cannot|cant|am not|never|none)\b/;
const AFFIRMATIVE = /^(yes|y|true|i am|i do|i will|i have|i can|i identify|i require|i would)\b/;

export const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

/** Both spellings of a US state ("TX" and "Texas"), or just the input when it isn't one. */
export function stateVariants(state: string): string[] {
  const upper = state.trim().toUpperCase();
  if (US_STATES[upper]) return [US_STATES[upper], upper];
  const abbr = Object.keys(US_STATES).find((k) => US_STATES[k].toLowerCase() === state.trim().toLowerCase());
  return abbr ? [US_STATES[abbr], abbr] : [state];
}

const US_NAMES = ['united states', 'united states of america', 'usa', 'us', 'u.s.', 'u.s.a.', 'america'];
export function countryVariants(country: string): string[] {
  return US_NAMES.includes(country.trim().toLowerCase())
    ? ['United States', 'United States of America', 'USA', 'US']
    : [country];
}

export function isPlaceholderOption(text: string): boolean {
  return PLACEHOLDER.test(normalize(text));
}

function isDecline(n: string): boolean {
  return DECLINE.test(n);
}

function matchBool(options: string[], value: boolean): number {
  const normalized = options.map(normalize);
  const exact = normalized.findIndex((o) => o === (value ? 'yes' : 'no'));
  if (exact >= 0) return exact;
  const real = normalized
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => o && !isPlaceholderOption(o) && !isDecline(o));
  if (!value) return real.find(({ o }) => NEGATIVE.test(o))?.i ?? -1;

  const affirmative = real.find(({ o }) => AFFIRMATIVE.test(o) && !NEGATIVE.test(o));
  if (affirmative) return affirmative.i;
  // A two-way choice where one side is clearly negative: the other side is the "yes".
  const positives = real.filter(({ o }) => !NEGATIVE.test(o));
  return real.length === 2 && positives.length === 1 ? positives[0].i : -1;
}

function matchText(options: string[], candidates: string[]): number {
  const normalized = options.map((o) => (isPlaceholderOption(o) ? '' : normalize(o)));
  const wanted = candidates.map(normalize).filter(Boolean);

  for (const c of wanted) {
    const i = normalized.findIndex((o) => o === c);
    if (i >= 0) return i;
  }
  for (const c of wanted) {
    const i = normalized.findIndex((o) => o && (o.startsWith(c + ' ') || c.startsWith(o + ' ')));
    if (i >= 0) return i;
  }
  for (const c of wanted) {
    if (c.length < 4) continue;
    const i = normalized.findIndex((o) => o.length >= 4 && (o.includes(c) || c.includes(o)));
    if (i >= 0) return i;
  }
  let best = -1;
  let bestScore = 0.6;
  normalized.forEach((o, i) => {
    if (!o) return;
    for (const c of wanted) {
      const score = overlap(o, c);
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    }
  });
  return best;
}

/** Index of the option that best represents `answer`, or -1 when none is a confident match. */
export function matchOption(options: string[], answer: Answer): number {
  if (answer.type === 'decline') return options.findIndex((o) => isDecline(normalize(o)));
  if (answer.type === 'bool') return matchBool(options, answer.value);

  const byText = matchText(options, [answer.value, ...(answer.aliases || [])]);
  if (byText >= 0) return byText;
  const asBool = toBool(answer.value);
  return asBool === undefined ? -1 : matchBool(options, asBool);
}

/** The string to type into a free-text input for this answer, if any. */
export function answerText(answer: Answer): string | null {
  if (answer.type === 'text') return answer.value;
  if (answer.type === 'bool') return answer.value ? 'Yes' : 'No';
  return null;
}
