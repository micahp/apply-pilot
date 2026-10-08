import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
const { act } = React;
import { fillForm, scanFields } from '../engine';
import { normalizeProfile } from '../profile';
import { detectConfirmation, findApplicationRoot, findSubmitButton } from '../page';
import { extractJobInfo } from '../job-info';

const FIXTURES = path.resolve(__dirname, '../../../../../tests/fixtures/forms');

function loadFixture(name: string): void {
  const html = fs.readFileSync(path.join(FIXTURES, name), 'utf8');
  document.documentElement.innerHTML = html.replace(/^<!doctype html>/i, '');
}

const profile = normalizeProfile({
  personal: {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    phone: '512-555-0100',
    city: 'Austin',
    state: 'TX',
    country: 'United States',
    linkedIn: 'https://linkedin.com/in/ada',
    github: 'https://github.com/ada',
  },
  workExperience: [{ company: 'Analytical Engines', title: 'Engineer', startDate: '2020-01', current: true }],
  preferences: { usWorkAuth: 'Yes', sponsorshipRequired: 'No' },
  eeo: { gender: 'Female', veteranStatus: 'No' },
  customAnswers: { 'privacy notice': 'Yes', 'which office': 'Remote' },
});

function byQuestion(report: Awaited<ReturnType<typeof fillForm>>, question: RegExp) {
  const hit = report.results.find((r) => question.test(r.question));
  if (!hit) throw new Error(`no result for ${question}`);
  return hit;
}

describe('fillForm on a Greenhouse-style form', () => {
  beforeEach(() => loadFixture('greenhouse.html'));

  it('fills contact, screening and EEO questions and reports what it could not answer', async () => {
    const root = findApplicationRoot(document);
    expect(root.id).toBe('application_form');

    const report = await fillForm(root, profile, { job: { company: 'Acme AI', title: 'Senior AI Engineer' } });

    expect((document.getElementById('first_name') as HTMLInputElement).value).toBe('Ada');
    expect((document.getElementById('last_name') as HTMLInputElement).value).toBe('Lovelace');
    expect((document.getElementById('email') as HTMLInputElement).value).toBe('ada@example.com');
    expect((document.getElementById('q_linkedin') as HTMLInputElement).value).toBe('https://linkedin.com/in/ada');

    const selected = (id: string) => {
      const s = document.getElementById(id) as HTMLSelectElement;
      return s.options[s.selectedIndex].text;
    };
    expect(selected('q_auth')).toBe('Yes');
    expect(selected('q_sponsor')).toBe('No');
    expect(selected('gender')).toBe('Female');
    expect(selected('hispanic')).toBe('Decline To Self Identify');
    expect(selected('veteran')).toBe('I am not a protected veteran');
    expect(selected('disability')).toBe('I do not want to answer');

    // The honeypot and the site search box are never touched.
    expect((document.querySelector('[name="job_application[website_confirm]"]') as HTMLInputElement).value).toBe('');
    expect((document.querySelector('input[type="search"]') as HTMLInputElement).value).toBe('');

    expect(byQuestion(report, /^Resume/).status).toBe('needs-file');
    expect(report.filesNeeded.map((f) => f.key)).toEqual(['resume']);
    expect(byQuestion(report, /Why do you want/).status).toBe('unrecognized');
    expect(byQuestion(report, /How did you hear/).status).toBe('no-answer');
    expect(report.requiredUnanswered.map((r) => r.question)).toEqual(['Resume/CV', 'Why do you want to work at Acme?']);

    expect(report.captcha).toEqual({ present: true, blocking: false, kinds: ['recaptcha'] });
  });

  it('answers custom questions and does not overwrite existing values', async () => {
    (document.getElementById('first_name') as HTMLInputElement).value = 'Augusta';
    const withAnswer = { ...profile, customAnswers: [{ question: '/why do you want to work at/', answer: 'Because {{company}} builds great things.' }] };

    const report = await fillForm(findApplicationRoot(document), withAnswer, { job: { company: 'Acme AI' } });

    expect((document.getElementById('first_name') as HTMLInputElement).value).toBe('Augusta');
    expect(byQuestion(report, /^First Name/).status).toBe('already-filled');
    expect((document.getElementById('q_why') as HTMLTextAreaElement).value).toBe('Because Acme AI builds great things.');
    expect(byQuestion(report, /Why do you want/).key).toBe('custom');
    expect(report.requiredUnanswered.map((r) => r.question)).toEqual(['Resume/CV']);
  });

  it('finds the submit button and the job posting', () => {
    expect(findSubmitButton(findApplicationRoot(document))?.id).toBe('submit_app');
    expect(extractJobInfo(document)).toEqual({ title: 'Senior AI Engineer', company: 'Acme AI', location: 'Austin, TX', description: 'Build LLM systems.' });
  });
});

describe('fillForm on a Lever-style form', () => {
  beforeEach(() => loadFixture('lever.html'));

  it('handles full name, radio groups, checkbox groups and acknowledgement checkboxes', async () => {
    const report = await fillForm(findApplicationRoot(document), profile);
    const value = (name: string) => (document.querySelector(`[name="${name}"]`) as HTMLInputElement).value;

    expect(value('name')).toBe('Ada Lovelace');
    expect(value('email')).toBe('ada@example.com');
    expect(value('org')).toBe('Analytical Engines');
    expect(value('urls[GitHub]')).toBe('https://github.com/ada');

    const checked = Array.from(document.querySelectorAll<HTMLInputElement>('input:checked')).map((i) => `${i.name}=${i.value}`);
    expect(checked).toEqual(['cards[abc][field0]=No', 'cards[abc][field1]=Remote', 'cards[abc][field2]=ack']);

    expect(byQuestion(report, /require sponsorship/)).toMatchObject({ kind: 'radio', key: 'requiresSponsorship', status: 'filled', required: true });
    expect(byQuestion(report, /privacy notice/)).toMatchObject({ kind: 'checkbox', key: 'custom', status: 'filled' });
    expect(report.requiredUnanswered.map((r) => r.question)).toEqual(['Resume/CV']);
  });

  it('scans each radio group as one question with its options', () => {
    const radio = scanFields(findApplicationRoot(document)).find((f) => f.kind === 'radio')!;
    expect(radio.options).toEqual(['Yes', 'No']);
    expect(radio.controls).toHaveLength(2);
  });
});

describe('fillForm on React-controlled inputs', () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

  function Form() {
    const [state, setState] = React.useState({ first: '', country: '' });
    return React.createElement(
      'form',
      null,
      React.createElement('label', { htmlFor: 'f' }, 'First name'),
      React.createElement('input', { id: 'f', value: state.first, onChange: (e: any) => setState((s) => ({ ...s, first: e.target.value })) }),
      React.createElement('label', { htmlFor: 'c' }, 'Country'),
      React.createElement(
        'select',
        { id: 'c', value: state.country, onChange: (e: any) => setState((s) => ({ ...s, country: e.target.value })) },
        React.createElement('option', { value: '' }, 'Select...'),
        React.createElement('option', { value: 'CA' }, 'Canada'),
        React.createElement('option', { value: 'US' }, 'United States')
      ),
      React.createElement('output', { id: 'state' }, JSON.stringify(state))
    );
  }

  it('updates component state, not just the DOM value', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById('root')!);
    await act(async () => root.render(React.createElement(Form)));

    let report: Awaited<ReturnType<typeof fillForm>> | undefined;
    await act(async () => {
      report = await fillForm(document.body, normalizeProfile({ personal: { firstName: 'Ada', country: 'USA' } }));
    });

    expect(JSON.parse(document.getElementById('state')!.textContent!)).toEqual({ first: 'Ada', country: 'US' });
    expect(report!.filled).toBe(2);
    await act(async () => root.unmount());
  });
});

describe('fillForm on an ARIA combobox', () => {
  function mountCombobox(options: string[]) {
    document.body.innerHTML = `
      <form>
        <div class="field">
          <label id="lbl" for="loc">Location <span class="asterisk">*</span></label>
          <div class="select__control"><div class="select__single-value"></div><input id="loc" role="combobox" aria-controls="loc-list" aria-labelledby="lbl"></div>
          <ul id="loc-list" role="listbox"></ul>
        </div>
      </form>`;
    const input = document.getElementById('loc') as HTMLInputElement;
    const list = document.getElementById('loc-list')!;
    const render = () => {
      list.innerHTML = '';
      options
        .filter((o) => o.toLowerCase().includes(input.value.toLowerCase().split(',')[0]))
        .forEach((o) => {
          const li = document.createElement('li');
          li.setAttribute('role', 'option');
          li.textContent = o;
          li.addEventListener('click', () => {
            document.querySelector('.select__single-value')!.textContent = o;
            input.value = '';
            list.innerHTML = '';
          });
          list.appendChild(li);
        });
    };
    input.addEventListener('input', render);
    input.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'ArrowDown' && render());
  }

  it('opens the list and clicks the best option', async () => {
    mountCombobox(['Austin, Minnesota, United States', 'Austin, Texas, United States', 'Boston, Massachusetts, United States']);
    const report = await fillForm(document.body, profile);

    expect(document.querySelector('.select__single-value')!.textContent).toBe('Austin, Texas, United States');
    expect(report.results[0]).toMatchObject({ kind: 'combobox', key: 'location', status: 'filled', required: true });
    expect(report.requiredUnanswered).toEqual([]);
  });

  it('reports no-matching-option instead of leaving a half-typed value', async () => {
    mountCombobox(['Paris, France', 'Berlin, Germany']);
    const report = await fillForm(document.body, profile);

    expect(report.results[0].status).toBe('no-matching-option');
    expect((document.getElementById('loc') as HTMLInputElement).value).toBe('');
    expect(report.requiredUnanswered).toHaveLength(1);
  });
});

describe('detectConfirmation', () => {
  it('recognizes common confirmation copy', () => {
    document.body.innerHTML = '<h1>Thank you for applying!</h1>';
    expect(detectConfirmation(document)).toBe(true);
    document.body.innerHTML = '<h1>Apply for this job</h1>';
    expect(detectConfirmation(document)).toBe(false);
  });
});
