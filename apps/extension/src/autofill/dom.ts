import { cleanLabel } from './text';

export type FormControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const QUESTION_CONTAINERS = [
  'fieldset',
  '[role="group"]',
  '[role="radiogroup"]',
  '.application-question',
  '.field',
  '.form-field',
  '.form-group',
  '[class*="field-wrapper"]',
  '[class*="fieldEntry"]',
  '[class*="question"]',
].join(',');

function textOf(el: Element | null | undefined): string {
  if (!el) return '';
  // Ignore the text of nested controls and option lists so a label doesn't absorb its answers.
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('select, option, input, textarea, [role="listbox"], [role="option"], ul, script, style').forEach((n) => n.remove());
  return cleanLabel(clone.textContent);
}

function byIds(ids: string | null, doc: Document): string {
  if (!ids) return '';
  return ids
    .split(/\s+/)
    .map((id) => textOf(doc.getElementById(id)))
    .filter(Boolean)
    .join(' ');
}

function labelElementFor(el: Element, doc: Document): Element | null {
  const id = el.getAttribute('id');
  if (!id) return null;
  return Array.from(doc.querySelectorAll('label[for]')).find((l) => l.getAttribute('for') === id) || null;
}

function labelFor(el: Element, doc: Document): string {
  return textOf(labelElementFor(el, doc));
}

/** Question-level text for a group container (legend, group label, or a leading label element). */
function containerQuestion(container: Element, doc: Document): string {
  const legend = container.querySelector(':scope > legend');
  if (legend) return textOf(legend);
  const labelled = byIds(container.getAttribute('aria-labelledby'), doc) || container.getAttribute('aria-label');
  if (labelled) return cleanLabel(labelled);
  const label = container.querySelector(
    ':scope > label, :scope > .application-label, :scope > [class*="label"], :scope > [class*="title"], :scope > div > label:first-child'
  );
  return label ? textOf(label) : '';
}

/** The question a single control is asking, e.g. "First Name" or "Do you require sponsorship?". */
export function questionText(el: Element, doc: Document = el.ownerDocument): string {
  const direct =
    byIds(el.getAttribute('aria-labelledby'), doc) ||
    labelFor(el, doc) ||
    (el.closest('label') ? textOf(el.closest('label')) : '') ||
    cleanLabel(el.getAttribute('aria-label'));
  if (direct) return direct;

  for (let node = el.parentElement, depth = 0; node && depth < 5; node = node.parentElement, depth++) {
    if (node.matches(QUESTION_CONTAINERS)) {
      const q = containerQuestion(node, doc);
      if (q) return q;
    }
  }
  return cleanLabel(el.getAttribute('placeholder'));
}

/** The question for a radio/checkbox group: the group's legend/label, not an individual option label. */
export function groupQuestionText(inputs: HTMLInputElement[], doc: Document): string {
  const first = inputs[0];
  for (let node = first.parentElement, depth = 0; node && depth < 6; node = node.parentElement, depth++) {
    if (inputs.every((i) => node!.contains(i)) && node.matches(QUESTION_CONTAINERS)) {
      const q = containerQuestion(node, doc);
      if (q) return q;
    }
  }
  return inputs.length === 1 ? questionText(first, doc) : '';
}

/** Visible label of one radio/checkbox option. */
export function optionLabel(input: HTMLInputElement, doc: Document = input.ownerDocument): string {
  return (
    labelFor(input, doc) ||
    (input.closest('label') ? textOf(input.closest('label')) : '') ||
    cleanLabel(input.getAttribute('aria-label')) ||
    cleanLabel(input.nextElementSibling?.textContent) ||
    input.value
  );
}

function hasRequiredMarker(label: Element | null | undefined): boolean {
  return Boolean(label && (/\*/.test(label.textContent || '') || label.querySelector('.asterisk, [class*="required"]')));
}

/** `required`/`aria-required`, or an asterisk on the control's label or its group's legend. */
export function isRequired(controls: Element[], doc: Document): boolean {
  if (controls.some((c) => (c as HTMLInputElement).required || c.getAttribute('aria-required') === 'true')) return true;
  const el = controls[0];
  if (hasRequiredMarker(labelElementFor(el, doc)) || (controls.length === 1 && hasRequiredMarker(el.closest('label')))) return true;
  for (let node = el.parentElement, depth = 0; node && depth < 5; node = node.parentElement, depth++) {
    if (!node.matches(QUESTION_CONTAINERS)) continue;
    if (node.getAttribute('aria-required') === 'true') return true;
    const label = node.querySelector(':scope > legend, :scope > label, :scope > .application-label, :scope > [class*="label"]');
    if (label) return hasRequiredMarker(label);
  }
  return false;
}

/**
 * Rendered and not deliberately hidden. Honeypot fields are usually display:none or
 * visibility:hidden, so this also keeps us from filling them.
 */
export function isDisplayed(el: Element): boolean {
  const win = el.ownerDocument.defaultView;
  for (let node: Element | null = el; node; node = node.parentElement) {
    if ((node as HTMLElement).hidden || node.getAttribute('aria-hidden') === 'true') return false;
    const style = win?.getComputedStyle(node);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  }
  return true;
}

function dispatch(el: Element, type: string, init: EventInit = {}): void {
  const win = el.ownerDocument.defaultView || window;
  const Ctor = type.startsWith('key') ? win.KeyboardEvent : type.startsWith('mouse') || type === 'click' ? win.MouseEvent : win.Event;
  el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, ...init }));
}

/**
 * Set a value the way a user would, so React/Vue controlled inputs see it: use the
 * prototype setter (bypassing React's value tracker) and fire input + change + blur.
 */
export function setControlValue(el: FormControl, value: string): void {
  const win = el.ownerDocument.defaultView || window;
  const proto =
    el instanceof win.HTMLTextAreaElement ? win.HTMLTextAreaElement.prototype
      : el instanceof win.HTMLSelectElement ? win.HTMLSelectElement.prototype
        : win.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  el.focus?.();
  if (setter) setter.call(el, value);
  else el.value = value;
  dispatch(el, 'input');
  dispatch(el, 'change');
  el.blur?.();
  dispatch(el, 'focusout');
}

export function setChecked(input: HTMLInputElement, checked: boolean): void {
  if (input.checked === checked) return;
  input.click();
  if (input.checked !== checked) {
    // Some frameworks swallow synthetic clicks; fall back to the property + change event.
    const win = input.ownerDocument.defaultView || window;
    Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'checked')?.set?.call(input, checked);
    dispatch(input, 'change');
  }
}

export function attachFile(input: HTMLInputElement, file: File): boolean {
  const win = input.ownerDocument.defaultView || window;
  if (typeof win.DataTransfer !== 'function') return false;
  const transfer = new win.DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  dispatch(input, 'input');
  dispatch(input, 'change');
  return input.files?.length === 1;
}

export function dataUrlToFile(dataUrl: string, name: string, type: string): File {
  const [, base64 = ''] = dataUrl.split(',');
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new File([bytes], name, { type });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function isCombobox(el: Element): boolean {
  return (
    el.getAttribute('role') === 'combobox' ||
    el.getAttribute('aria-autocomplete') === 'list' ||
    el.getAttribute('aria-haspopup') === 'listbox' ||
    /(^|\s|_|-)select__input/.test(el.className)
  );
}

function visibleOptions(input: Element): HTMLElement[] {
  const doc = input.ownerDocument;
  const listId = input.getAttribute('aria-controls') || input.getAttribute('aria-owns');
  const list = listId ? doc.getElementById(listId) : null;
  const scope: ParentNode = list || doc;
  return Array.from(scope.querySelectorAll<HTMLElement>('[role="option"], [class*="select__option"]')).filter(isDisplayed);
}

async function waitForOptions(input: Element, timeoutMs: number): Promise<HTMLElement[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const options = visibleOptions(input);
    if (options.length > 0 || Date.now() >= deadline) return options;
    await sleep(50);
  }
}

/**
 * Drive a custom combobox (react-select, ARIA listbox autocompletes): open it, optionally
 * type a search, and click the option chosen by `pick`. Returns the chosen option text.
 */
export async function chooseComboboxOption(
  input: HTMLInputElement,
  searchTerms: string[],
  pick: (options: string[]) => number,
  timeoutMs = 1500
): Promise<string | null> {
  const attempts = ['', ...searchTerms.filter(Boolean).slice(0, 3)];
  for (const term of attempts) {
    input.focus();
    dispatch(input, 'mousedown');
    if (term) setInputValueOnly(input, term);
    dispatch(input, 'keydown', { key: 'ArrowDown', code: 'ArrowDown' } as KeyboardEventInit);

    const options = await waitForOptions(input, term ? timeoutMs : timeoutMs / 2);
    const index = pick(options.map((o) => cleanLabel(o.textContent)));
    if (index >= 0) {
      const option = options[index];
      const label = cleanLabel(option.textContent);
      dispatch(option, 'mousedown');
      dispatch(option, 'mouseup');
      dispatch(option, 'click');
      await sleep(50);
      return label;
    }
  }
  dispatch(input, 'keydown', { key: 'Escape', code: 'Escape' } as KeyboardEventInit);
  setInputValueOnly(input, '');
  return null;
}

function setInputValueOnly(input: HTMLInputElement, value: string): void {
  const win = input.ownerDocument.defaultView || window;
  Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  dispatch(input, 'input');
}

/** Text currently displayed by a combobox (react-select renders the value beside the input). */
export function comboboxDisplayValue(input: HTMLInputElement): string {
  const control = input.closest('[class*="select__control"], [class*="control"], [role="combobox"]')?.parentElement || input.parentElement;
  const single = control?.querySelector('[class*="singleValue"], [class*="single-value"], [class*="select__value"]');
  return cleanLabel(single?.textContent) || input.value;
}
