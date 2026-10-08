import { cleanLabel } from './text';
import { isDisplayed } from './dom';

export interface CaptchaState {
  /** A CAPTCHA widget exists on the page (including invisible/score-based ones). */
  present: boolean;
  /** A challenge a human must solve is currently showing; automation must stop. */
  blocking: boolean;
  kinds: string[];
}

const CAPTCHA_FRAMES: Array<[string, RegExp]> = [
  ['recaptcha', /recaptcha\/(api2|enterprise)\/(anchor|bframe)/],
  ['hcaptcha', /hcaptcha\.com\/.*(checkbox|challenge)/],
  ['turnstile', /challenges\.cloudflare\.com/],
];

function frameIsShowing(frame: HTMLIFrameElement): boolean {
  if (!isDisplayed(frame)) return false;
  const rect = frame.getBoundingClientRect();
  // reCAPTCHA keeps an off-screen/zero-size challenge frame mounted until it triggers.
  return rect.width > 60 && rect.height > 60 && rect.bottom > 0 && rect.right > 0;
}

export function detectCaptcha(doc: Document = document): CaptchaState {
  const kinds = new Set<string>();
  let blocking = false;

  for (const frame of Array.from(doc.querySelectorAll<HTMLIFrameElement>('iframe[src]'))) {
    for (const [kind, pattern] of CAPTCHA_FRAMES) {
      if (!pattern.test(frame.src)) continue;
      kinds.add(kind);
      const invisibleBadge = Boolean(frame.closest('.grecaptcha-badge')) || frame.closest('[data-size="invisible"]');
      if (!invisibleBadge && frameIsShowing(frame)) blocking = true;
    }
  }
  if (doc.querySelector('.g-recaptcha, [data-sitekey]')) kinds.add('recaptcha');
  if (doc.querySelector('.h-captcha')) kinds.add('hcaptcha');
  if (doc.querySelector('.cf-turnstile')) kinds.add('turnstile');

  return { present: kinds.size > 0, blocking, kinds: Array.from(kinds) };
}

const SUBMIT_TEXT = /^(submit|submit application|send application|apply|apply now|complete application|send)$/i;

/** The control that submits the application, scoped to the form when there is one. */
export function findSubmitButton(root: ParentNode): HTMLElement | null {
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>('button, input[type="submit"], [role="button"]')
  ).filter((el) => isDisplayed(el) && !(el as HTMLButtonElement).disabled);

  const typed = candidates.find((el) => (el as HTMLButtonElement).type === 'submit' && SUBMIT_TEXT.test(buttonText(el)));
  if (typed) return typed;
  const byText = candidates.find((el) => SUBMIT_TEXT.test(buttonText(el)));
  if (byText) return byText;
  return candidates.find((el) => (el as HTMLButtonElement).type === 'submit' && el.tagName !== 'A') || null;
}

function buttonText(el: HTMLElement): string {
  return cleanLabel(el instanceof HTMLInputElement ? el.value : el.textContent);
}

const CONFIRMATION = [
  /thank(s| you) for (applying|your application|your interest|submitting)/i,
  /application (has been |was |is )?(successfully )?(submitted|received|complete)/i,
  /we('ve| have) received your application/i,
  /your application (has been|was) (sent|submitted|received)/i,
  /successfully (applied|submitted)/i,
];

/** True when the page shows an application-received message. */
export function detectConfirmation(doc: Document = document): boolean {
  const text = (doc.body?.innerText ?? doc.body?.textContent ?? '').slice(0, 20000);
  return CONFIRMATION.some((re) => re.test(text));
}

/** Visible validation messages, for reporting why a submit did not go through. */
export function validationErrors(root: ParentNode): string[] {
  const messages = new Set<string>();
  root.querySelectorAll<HTMLElement>('[role="alert"], .error, .error-message, .field-error, [class*="error-message"], [class*="errorMessage"], [aria-live="assertive"]').forEach((el) => {
    const text = cleanLabel(el.textContent);
    if (text && text.length < 300 && isDisplayed(el)) messages.add(text);
  });
  root.querySelectorAll<HTMLElement>('[aria-invalid="true"]').forEach((el) => {
    const name = el.getAttribute('aria-label') || el.getAttribute('name') || el.id;
    if (name) messages.add(`Invalid field: ${name}`);
  });
  return Array.from(messages).slice(0, 20);
}

/** The element holding the application form: the form with the most fillable controls. */
export function findApplicationRoot(doc: Document = document): HTMLElement {
  const forms = Array.from(doc.querySelectorAll('form')).filter((f) => !f.closest('#autoapply-panel'));
  let best: HTMLElement | null = null;
  let bestCount = 0;
  for (const form of forms) {
    const count = form.querySelectorAll('input:not([type="hidden"]):not([type="search"]), textarea, select').length;
    const looksLikeApplication = form.querySelector('input[type="file"], input[type="email"], input[name*="email" i]');
    if (looksLikeApplication && count > bestCount) {
      best = form;
      bestCount = count;
    }
  }
  return best || doc.querySelector<HTMLElement>('#application-form, #application, [data-qa="application-form"]') || doc.body;
}
