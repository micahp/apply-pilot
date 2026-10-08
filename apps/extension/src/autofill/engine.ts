import { classifyField, type FieldKey } from './classify';
import { customAnswerFor, resolveAnswer, type JobContext } from './answers';
import { answerText, isPlaceholderOption, matchOption, type Answer } from './options';
import { toBool, type ApplicantProfile } from './profile';
import { detectCaptcha, type CaptchaState } from './page';
import {
  attachFile,
  chooseComboboxOption,
  comboboxDisplayValue,
  groupQuestionText,
  isCombobox,
  isDisplayed,
  isRequired,
  optionLabel,
  questionText,
  setChecked,
  setControlValue,
  type FormControl,
} from './dom';
import { humanizeIdentifier } from './text';

export type FieldKind = 'text' | 'textarea' | 'select' | 'combobox' | 'radio' | 'checkbox' | 'checkbox-group' | 'file';

export interface ScannedField {
  /** Stable id written to `data-autoapply-id` on every control of the field. */
  id: string;
  kind: FieldKind;
  question: string;
  required: boolean;
  key: FieldKey | null;
  controls: HTMLElement[];
  options: string[];
}

export type FieldStatus =
  | 'filled'
  | 'already-filled'
  /** Recognized, but the profile has no value for it. */
  | 'no-answer'
  /** The question isn't one we know; add a customAnswers entry for it. */
  | 'unrecognized'
  | 'no-matching-option'
  | 'needs-file'
  | 'failed';

export interface FieldResult {
  id: string;
  kind: FieldKind;
  question: string;
  required: boolean;
  key: FieldKey | 'custom' | null;
  status: FieldStatus;
  value?: string;
  message?: string;
}

export interface FillReport {
  results: FieldResult[];
  filled: number;
  /** Required fields still empty after filling: the form cannot be submitted as-is. */
  requiredUnanswered: FieldResult[];
  /** File inputs the caller must attach (e.g. via Playwright's setInputFiles). */
  filesNeeded: FieldResult[];
  captcha: CaptchaState;
}

export interface FillOptions {
  job?: JobContext;
  /** Replace values already present (default false: never clobber what the user typed). */
  overwrite?: boolean;
  files?: { resume?: File; coverLetter?: File };
  /** Re-scan this many extra times to catch conditional questions revealed by answers. */
  extraPasses?: number;
}

const ID_ATTR = 'data-autoapply-id';
const SKIPPED_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'search', 'password']);
let nextId = 1;

function idFor(controls: HTMLElement[]): string {
  const existing = controls.map((c) => c.getAttribute(ID_ATTR)).find(Boolean);
  const id = existing || `aa-${nextId++}`;
  controls.forEach((c) => c.setAttribute(ID_ATTR, id));
  return id;
}

function attributeText(el: Element): string {
  return humanizeIdentifier([el.getAttribute('name'), el.id, el.getAttribute('placeholder')].filter(Boolean).join(' '));
}

function isFillable(el: FormControl): boolean {
  if (el.closest('#autoapply-panel')) return false;
  if (el instanceof HTMLInputElement && SKIPPED_TYPES.has(el.type)) return false;
  if (el.getAttribute('role') === 'searchbox') return false;
  if (el.disabled) return false;
  if ((el as HTMLInputElement).readOnly && !isCombobox(el)) return false;
  if (el instanceof HTMLInputElement && el.type === 'file') return true;
  if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
    // Styled choices often hide the native input and show the label instead.
    const label = el.closest('label') || Array.from(el.ownerDocument.querySelectorAll('label[for]')).find((l) => el.id && l.getAttribute('for') === el.id);
    return isDisplayed(el) || Boolean(label && isDisplayed(label));
  }
  return isDisplayed(el);
}

/** Find every fillable question in `root`, grouping radio/checkbox inputs into single questions. */
export function scanFields(root: ParentNode, doc: Document = (root as Node).ownerDocument || document): ScannedField[] {
  const controls = Array.from(root.querySelectorAll<FormControl>('input, textarea, select')).filter(isFillable);

  // Keep document order while collecting each radio/checkbox group under its first member.
  const entries: Array<FormControl | HTMLInputElement[]> = [];
  const groups = new Map<string, HTMLInputElement[]>();
  for (const el of controls) {
    if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
      const groupKey = `${el.type}:${el.name || el.id}`;
      const group = groups.get(groupKey);
      if (group) group.push(el);
      else {
        const created = [el];
        groups.set(groupKey, created);
        entries.push(created);
      }
    } else {
      entries.push(el);
    }
  }

  return entries.map((entry) => (Array.isArray(entry) ? scanGroup(entry, doc) : scanControl(entry, doc)));
}

function scanControl(el: FormControl, doc: Document): ScannedField {
  const kind: FieldKind =
    el instanceof HTMLSelectElement ? 'select'
      : el instanceof HTMLTextAreaElement ? 'textarea'
        : el.type === 'file' ? 'file'
          : isCombobox(el) ? 'combobox'
            : 'text';
  const question = questionText(el, doc);
  return {
    id: idFor([el]),
    kind,
    question,
    required: isRequired([el], doc),
    key: classifyField({ question, attributes: attributeText(el), autocomplete: el.getAttribute('autocomplete'), isFile: kind === 'file' }),
    controls: [el],
    options: el instanceof HTMLSelectElement ? Array.from(el.options).map((o) => o.text.trim()) : [],
  };
}

function scanGroup(inputs: HTMLInputElement[], doc: Document): ScannedField {
  const kind: FieldKind = inputs[0].type === 'radio' ? 'radio' : inputs.length > 1 ? 'checkbox-group' : 'checkbox';
  const options = inputs.map((i) => optionLabel(i, doc));
  // A lone checkbox ("I agree to the privacy policy") is its own question.
  const question = groupQuestionText(inputs, doc) || (kind === 'checkbox' ? options[0] : '');
  return {
    id: idFor(inputs),
    kind,
    question,
    required: isRequired(inputs, doc),
    key: classifyField({ question, attributes: attributeText(inputs[0]) }),
    controls: inputs,
    options,
  };
}

function hasValue(field: ScannedField): boolean {
  const [el] = field.controls as FormControl[];
  switch (field.kind) {
    case 'radio':
    case 'checkbox':
    case 'checkbox-group':
      return (field.controls as HTMLInputElement[]).some((c) => c.checked);
    case 'select': {
      const select = el as HTMLSelectElement;
      return select.selectedIndex >= 0 && select.value !== '' && !isPlaceholderOption(select.options[select.selectedIndex]?.text || '');
    }
    case 'file':
      return ((el as HTMLInputElement).files?.length || 0) > 0;
    case 'combobox':
      return comboboxDisplayValue(el as HTMLInputElement) !== '';
    default:
      return el.value.trim() !== '';
  }
}

function sameText(actual: string, expected: string): boolean {
  if (actual === expected) return true;
  // Masked inputs (phone numbers) reformat what we type; compare the digits.
  const digits = (s: string) => s.replace(/\D/g, '');
  return digits(expected).length >= 7 && digits(actual) === digits(expected);
}

async function fillField(field: ScannedField, answer: Answer, options: FillOptions): Promise<Pick<FieldResult, 'status' | 'value' | 'message'>> {
  const [el] = field.controls;

  switch (field.kind) {
    case 'text':
    case 'textarea': {
      const value = answerText(answer);
      if (value === null) return { status: 'no-answer' };
      setControlValue(el as FormControl, value);
      const actual = (el as FormControl).value;
      return sameText(actual, value) ? { status: 'filled', value } : { status: 'failed', message: `value did not stick (now "${actual}")` };
    }
    case 'combobox': {
      const search = answer.type === 'text' ? [answer.value, ...(answer.aliases || [])] : answer.type === 'bool' ? [answer.value ? 'Yes' : 'No'] : ['Decline', 'Prefer not'];
      const chosen = await chooseComboboxOption(el as HTMLInputElement, search, (opts) => matchOption(opts, answer));
      return chosen ? { status: 'filled', value: chosen } : { status: 'no-matching-option', message: `no option matched "${search[0]}"` };
    }
    case 'select': {
      const select = el as HTMLSelectElement;
      const index = matchOption(field.options, answer);
      if (index < 0) return { status: 'no-matching-option', message: `options: ${field.options.filter((o) => !isPlaceholderOption(o)).slice(0, 8).join(' | ')}` };
      setControlValue(select, select.options[index].value);
      return select.selectedIndex === index ? { status: 'filled', value: field.options[index] } : { status: 'failed', message: 'selection did not stick' };
    }
    case 'radio':
    case 'checkbox-group': {
      const index = matchOption(field.options, answer);
      if (index < 0) return { status: 'no-matching-option', message: `options: ${field.options.join(' | ')}` };
      const input = field.controls[index] as HTMLInputElement;
      setChecked(input, true);
      return input.checked ? { status: 'filled', value: field.options[index] } : { status: 'failed', message: 'could not check option' };
    }
    case 'checkbox': {
      const checked = answer.type === 'bool' ? answer.value : answer.type === 'text' ? toBool(answer.value) : undefined;
      if (checked === undefined) return { status: 'no-matching-option', message: 'single checkbox needs a yes/no answer' };
      const input = el as HTMLInputElement;
      setChecked(input, checked);
      return input.checked === checked ? { status: 'filled', value: checked ? 'checked' : 'unchecked' } : { status: 'failed', message: 'could not toggle checkbox' };
    }
    case 'file': {
      const file = field.key === 'resume' ? options.files?.resume : field.key === 'coverLetterFile' ? options.files?.coverLetter : undefined;
      if (!file) return { status: 'needs-file' };
      return attachFile(el as HTMLInputElement, file) ? { status: 'filled', value: file.name } : { status: 'needs-file', message: 'browser refused programmatic file attach' };
    }
  }
}

async function fillOne(field: ScannedField, profile: ApplicantProfile, options: FillOptions): Promise<FieldResult> {
  const base = { id: field.id, kind: field.kind, question: field.question, required: field.required };

  if (!options.overwrite && hasValue(field)) return { ...base, key: field.key, status: 'already-filled' };

  const custom = customAnswerFor(profile, field.question, options.job);
  const key: FieldResult['key'] = custom ? 'custom' : field.key;

  if (field.kind === 'file' && !custom) {
    if (!field.key) return { ...base, key, status: 'unrecognized' };
    return { ...base, key, ...(await fillField(field, { type: 'text', value: '' }, options)) };
  }

  const answer = custom || (field.key ? resolveAnswer(field.key, profile, options.job) : null);
  if (!answer) return { ...base, key, status: field.key ? 'no-answer' : 'unrecognized' };

  try {
    return { ...base, key, ...(await fillField(field, answer, options)) };
  } catch (error) {
    return { ...base, key, status: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Fill every recognizable question in `root` from `profile` and report, field by field,
 * what happened. Never submits.
 */
export async function fillForm(root: ParentNode, profile: ApplicantProfile, options: FillOptions = {}): Promise<FillReport> {
  const doc = (root as Node).ownerDocument || document;
  const byId = new Map<string, FieldResult>();
  const passes = 1 + (options.extraPasses ?? 2);

  for (let pass = 0; pass < passes; pass++) {
    const pending = scanFields(root, doc).filter((f) => !byId.has(f.id));
    if (pending.length === 0) break;
    for (const field of pending) byId.set(field.id, await fillOne(field, profile, options));
  }

  // Re-check required fields against the live DOM; answering one question can clear another.
  const live = new Map(scanFields(root, doc).map((f) => [f.id, f]));
  const results = Array.from(byId.values()).filter((r) => live.has(r.id));
  const requiredUnanswered = results.filter((r) => r.required && !hasValue(live.get(r.id)!));

  return {
    results,
    filled: results.filter((r) => r.status === 'filled').length,
    requiredUnanswered,
    filesNeeded: results.filter((r) => r.status === 'needs-file'),
    captcha: detectCaptcha(doc),
  };
}
