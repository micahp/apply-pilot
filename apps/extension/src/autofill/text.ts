/** Lowercase, strip punctuation/diacritics and collapse whitespace so labels compare reliably. */
export function normalize(text: string | null | undefined): string {
  return (text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9+#.@/ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Turn attribute names like `job_application[firstName]` into `job application first name`. */
export function humanizeIdentifier(id: string | null | undefined): string {
  return (id || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-[\].]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Collapse whitespace and drop the trailing required-marker asterisk. */
export function cleanLabel(text: string | null | undefined): string {
  return (text || '').replace(/\s+/g, ' ').replace(/\s*[*✱]\s*$/, '').trim();
}

export function tokens(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean);
}

/** Token-overlap similarity in [0, 1] relative to the smaller token set. */
export function overlap(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size);
}
