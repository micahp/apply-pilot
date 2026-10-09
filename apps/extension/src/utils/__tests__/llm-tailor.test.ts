import { buildCoverLetterPrompt, generateCoverLetter, parseCoverLetter } from '../llm-tailor';
import { normalizeProfile } from '../../autofill/profile';

const profile = normalizeProfile({
  personal: { firstName: 'Ada', lastName: 'Lovelace', city: 'Austin', state: 'TX' },
  workExperience: [{ company: 'Analytical Engines', title: 'Engineer', startDate: '2020', current: true, description: 'Built the first program.' }],
  skills: ['Python'],
});
const job = { title: 'ML Engineer', company: 'Acme', description: 'Build LLM systems.' };

function fakeFetch(status: number, body: unknown) {
  return jest.fn(async () => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) })) as unknown as typeof fetch;
}

describe('llm-tailor', () => {
  it('builds the prompt only from profile facts', () => {
    const prompt = buildCoverLetterPrompt(job, profile);
    expect(prompt).toContain('Engineer at Analytical Engines (2020 – present): Built the first program.');
    expect(prompt).toContain('Build LLM systems.');
    expect(prompt).not.toMatch(/YapGPT|Keller Williams/);
  });

  it('calls the Claude Messages API and parses the letter', async () => {
    const fetchImpl = fakeFetch(200, { content: [{ type: 'text', text: '{"body":"Dear Acme...","highlights":["Engineer at Analytical Engines"]}' }] });
    const letter = await generateCoverLetter({ provider: 'anthropic', apiKey: 'k' }, job, profile, fetchImpl);

    expect(letter).toEqual({ body: 'Dear Acme...', highlights: ['Engineer at Analytical Engines'] });
    const [url, init] = (fetchImpl as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('k');
    expect(JSON.parse(init.body).model).toBe('claude-sonnet-5-5');
  });

  it('surfaces API errors instead of returning a canned letter', async () => {
    await expect(generateCoverLetter({ provider: 'openai', apiKey: 'k' }, job, profile, fakeFetch(401, { error: 'bad key' }))).rejects.toThrow(/OpenAI API error 401/);
  });

  it('refuses to write a letter with no work history to draw on', async () => {
    await expect(generateCoverLetter({ provider: 'anthropic', apiKey: 'k' }, job, normalizeProfile({}), fakeFetch(200, {}))).rejects.toThrow(/work experience/);
  });

  it('rejects malformed model output', () => {
    expect(() => parseCoverLetter('Sure! Here is your letter.')).toThrow(/JSON/);
    expect(() => parseCoverLetter('{"body": ""}')).toThrow(/empty/);
  });
});
