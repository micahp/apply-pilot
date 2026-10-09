import { detectATS } from './utils/ats-platforms';
import {
  extractJobInfo,
  fillForm,
  findApplicationRoot,
  normalizeProfile,
  validateProfile,
  type FillReport,
} from './autofill';
import { dataUrlToFile } from './autofill/dom';
import { initFloatingPanel } from './ui/floatingPanel';

const HIGHLIGHT_CLASS = 'autoapply-needs-attention';

async function loadStoredProfile(): Promise<unknown> {
  const { profile } = await chrome.storage.local.get('profile');
  return profile ?? null;
}

/** Outline required questions we could not answer so the user can find them. */
function highlightUnanswered(report: FillReport): void {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => el.classList.remove(HIGHLIGHT_CLASS));
  for (const field of report.requiredUnanswered) {
    document.querySelectorAll(`[data-autoapply-id="${field.id}"]`).forEach((el) => {
      (el.closest('.field, .application-question, fieldset, [class*="question"]') || el).classList.add(HIGHLIGHT_CLASS);
    });
  }
}

/** Fill the application form on this page from the stored (or given) profile. */
async function runAutofill(rawProfile?: unknown): Promise<FillReport> {
  const raw = rawProfile ?? (await loadStoredProfile());
  if (!raw) throw new Error('No profile saved yet. Open the AutoApply popup and fill in your profile.');

  const profile = normalizeProfile(raw);
  const problems = validateProfile(profile);
  if (problems.length > 0) throw new Error(`Profile incomplete: ${problems.join('; ')}`);

  const job = extractJobInfo(document);
  const resume = profile.resumeFile ? dataUrlToFile(profile.resumeFile.dataUrl, profile.resumeFile.name, profile.resumeFile.type) : undefined;
  const report = await fillForm(findApplicationRoot(document), profile, {
    job: { company: job.company, title: job.title },
    files: { resume },
  });
  highlightUnanswered(report);
  return report;
}

let panel: HTMLElement | null = null;

function syncPanel(): void {
  const ats = detectATS(window.location.href);
  if (!ats) {
    panel?.remove();
    panel = null;
    return;
  }
  if (panel) return;
  panel = initFloatingPanel({
    atsName: ats.name,
    onFill: () => runAutofill(),
    onClose: () => {
      panel?.remove();
      panel = null;
    },
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message?.action) {
    case 'fillFields':
      runAutofill(message.profileData)
        .then((report) => sendResponse({ success: true, report }))
        .catch((error: Error) => sendResponse({ success: false, error: error.message }));
      return true;
    case 'checkATS': {
      const ats = detectATS(window.location.href);
      sendResponse({ detected: Boolean(ats), ats: ats?.name });
      return false;
    }
    case 'getJobInfo':
      sendResponse(extractJobInfo(document));
      return false;
    default:
      if (message?.type === 'ATS_PAGE_LOADED') {
        syncPanel();
        sendResponse({ success: true });
      }
      return false;
  }
});

function start(): void {
  const style = document.createElement('style');
  style.textContent = `.${HIGHLIGHT_CLASS} { outline: 2px solid #e67e22 !important; outline-offset: 4px; border-radius: 4px; }`;
  document.head.appendChild(style);
  syncPanel();

  // Single-page apps change the URL without reloading; re-check whether this is an ATS page.
  let lastUrl = window.location.href;
  new MutationObserver(() => {
    if (window.location.href === lastUrl) return;
    lastUrl = window.location.href;
    syncPanel();
  }).observe(document, { subtree: true, childList: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
