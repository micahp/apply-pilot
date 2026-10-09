/**
 * Cover letter generation with Claude (default) or OpenAI.
 *
 * Errors are thrown, never papered over: a failed request must not turn into a
 * canned letter that looks tailored but isn't.
 */
import type { ApplicantProfile } from '../autofill/profile';

export type LLMProvider = 'anthropic' | 'openai';

export interface TailorConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
}

export interface JobDescription {
  title: string;
  company: string;
  description: string;
  location?: string;
}

export interface GeneratedCoverLetter {
  body: string;
  /** Profile facts the letter leans on, so the user can check nothing was invented. */
  highlights: string[];
}

export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-5-5',
  openai: 'gpt-4o-mini',
};

const SYSTEM_PROMPT =
  'You write concise, specific cover letters. Use only facts present in the candidate profile; ' +
  'never invent employers, titles, metrics, projects or skills. If the profile lacks something the job asks for, do not claim it.';

function describeCandidate(profile: ApplicantProfile): string {
  const name = [profile.personal.firstName, profile.personal.lastName].filter(Boolean).join(' ');
  const work = profile.workExperience
    .map((w) => `- ${w.title} at ${w.company} (${w.startDate || '?'} – ${w.current ? 'present' : w.endDate || '?'})${w.description ? `: ${w.description}` : ''}`)
    .join('\n');
  const education = profile.education.map((e) => `- ${[e.degree, e.fieldOfStudy].filter(Boolean).join(' in ')} — ${e.institution}`).join('\n');
  return [
    `Name: ${name}`,
    profile.personal.city ? `Location: ${[profile.personal.city, profile.personal.state].filter(Boolean).join(', ')}` : '',
    work ? `Experience:\n${work}` : 'Experience: (none listed)',
    education ? `Education:\n${education}` : '',
    profile.skills.length ? `Skills: ${profile.skills.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildCoverLetterPrompt(job: JobDescription, profile: ApplicantProfile): string {
  return `Write a cover letter for this job.

<job>
Title: ${job.title}
Company: ${job.company}
${job.location ? `Location: ${job.location}\n` : ''}Description:
${job.description.slice(0, 8000)}
</job>

<candidate>
${describeCandidate(profile)}
</candidate>

Requirements:
- 3 short paragraphs, under 300 words, plain text, no placeholders like [Company].
- Connect 2–3 specific items from the candidate's experience to specific needs in the job description.
- Sign off with the candidate's name.

Respond with only a JSON object: {"body": "<the letter>", "highlights": ["<each candidate fact you relied on>"]}`;
}

export function parseCoverLetter(text: string): GeneratedCoverLetter {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error('The model did not return JSON.');
  const parsed = JSON.parse(json);
  if (typeof parsed.body !== 'string' || parsed.body.trim() === '') throw new Error('The model returned an empty letter.');
  return {
    body: parsed.body.trim(),
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights.filter((h: unknown) => typeof h === 'string') : [],
  };
}

async function complete(config: TailorConfig, prompt: string, fetchImpl: typeof fetch): Promise<string> {
  const model = config.model || DEFAULT_MODELS[config.provider];
  const signal = AbortSignal.timeout(60_000);

  if (config.provider === 'anthropic') {
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        // Required for calls made directly from a browser/extension context.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model, max_tokens: 1500, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return (data.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
  }

  const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function generateCoverLetter(
  config: TailorConfig,
  job: JobDescription,
  profile: ApplicantProfile,
  fetchImpl: typeof fetch = fetch
): Promise<GeneratedCoverLetter> {
  if (!config.apiKey) throw new Error('Add an API key first.');
  if (!job.description.trim()) throw new Error('Paste the job description first.');
  if (profile.workExperience.length === 0) throw new Error('Add work experience to your profile; the letter is built only from it.');
  return parseCoverLetter(await complete(config, buildCoverLetterPrompt(job, profile), fetchImpl));
}
