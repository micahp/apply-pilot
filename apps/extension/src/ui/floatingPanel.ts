import type { FieldResult, FillReport } from '../autofill';

interface FloatingPanelOptions {
  atsName: string;
  onFill: () => Promise<FillReport>;
  onClose: () => void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, css: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.style.cssText = css;
  if (text !== undefined) node.textContent = text;
  return node;
}

function scrollToField(field: FieldResult): void {
  const target = document.querySelector<HTMLElement>(`[data-autoapply-id="${field.id}"]`);
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target?.focus();
}

function renderReport(container: HTMLElement, report: FillReport): void {
  container.replaceChildren();
  const ok = report.requiredUnanswered.length === 0 && !report.captcha.blocking;
  container.appendChild(
    el('p', `margin:0 0 8px;font-weight:600;color:${ok ? '#27ae60' : '#e67e22'}`, ok
      ? `Filled ${report.filled} fields. Review, then submit.`
      : `Filled ${report.filled} fields. ${report.requiredUnanswered.length} required still need you:`)
  );

  if (report.requiredUnanswered.length > 0) {
    const list = el('ul', 'margin:0 0 8px;padding-left:18px;max-height:160px;overflow:auto;font-size:12px');
    for (const field of report.requiredUnanswered) {
      const item = el('li', 'cursor:pointer;margin-bottom:4px;color:#2c3e50;text-decoration:underline', field.question || '(unlabeled field)');
      item.title = field.status === 'unrecognized' ? 'Add a custom answer for this question in your profile' : field.message || field.status;
      item.addEventListener('click', () => scrollToField(field));
      list.appendChild(item);
    }
    container.appendChild(list);
  }

  if (report.captcha.blocking) {
    container.appendChild(el('p', 'margin:0 0 6px;font-size:12px;color:#c0392b', 'A CAPTCHA is showing; solve it before submitting.'));
  }

  const notFilled = report.results.filter((r) => !r.required && (r.status === 'no-matching-option' || r.status === 'failed'));
  if (notFilled.length > 0) {
    container.appendChild(el('p', 'margin:0;font-size:12px;color:#7f8c8d', `Optional fields skipped: ${notFilled.map((r) => r.question).join(', ')}`));
  }
}

/** Floating control on ATS pages: one button to autofill, plus a per-field outcome summary. */
export function initFloatingPanel(options: FloatingPanelOptions): HTMLElement {
  const panel = el('div', `
    position:fixed;bottom:20px;right:20px;width:300px;background:#fff;border-radius:8px;
    box-shadow:0 4px 12px rgba(0,0,0,.15);font:14px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    z-index:2147483646;padding:16px;color:#2c3e50`);
  panel.id = 'autoapply-panel';

  const header = el('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;cursor:move');
  header.appendChild(el('h3', 'margin:0;font-size:16px;font-weight:600', `AutoApply · ${options.atsName}`));
  const close = el('button', 'background:none;border:none;font-size:20px;cursor:pointer;color:#7f8c8d;padding:0 4px', '×');
  close.setAttribute('aria-label', 'Close AutoApply panel');
  close.addEventListener('click', options.onClose);
  header.appendChild(close);

  const fill = el('button', 'width:100%;background:#3498db;color:#fff;border:none;border-radius:4px;padding:10px 16px;font-size:14px;font-weight:500;cursor:pointer', 'Autofill application');
  const status = el('div', 'margin-top:10px;font-size:13px');

  fill.addEventListener('click', async () => {
    fill.disabled = true;
    fill.textContent = 'Filling…';
    status.replaceChildren();
    try {
      renderReport(status, await options.onFill());
    } catch (error) {
      status.appendChild(el('p', 'margin:0;color:#c0392b', error instanceof Error ? error.message : String(error)));
    } finally {
      fill.disabled = false;
      fill.textContent = 'Autofill again';
    }
  });

  panel.append(header, fill, status);
  document.body.appendChild(panel);
  makeDraggable(panel, header);
  return panel;
}

function makeDraggable(element: HTMLElement, handle: HTMLElement): void {
  handle.addEventListener('mousedown', (down) => {
    if ((down.target as HTMLElement).tagName === 'BUTTON') return;
    down.preventDefault();
    const rect = element.getBoundingClientRect();
    const offsetX = down.clientX - rect.left;
    const offsetY = down.clientY - rect.top;
    const move = (e: MouseEvent) => {
      element.style.left = `${e.clientX - offsetX}px`;
      element.style.top = `${e.clientY - offsetY}px`;
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}
