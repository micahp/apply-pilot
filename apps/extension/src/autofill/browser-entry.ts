/**
 * Bundled to dist/autofill/autofill.iife.js and injected by scripts/auto-apply-playwright.js,
 * so the Playwright runner fills forms with exactly the same engine as the extension.
 */
import * as engine from './index';

declare global {
  interface Window {
    AutoApplyEngine: typeof engine;
  }
}

window.AutoApplyEngine = engine;
