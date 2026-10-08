import { cleanLabel } from './text';

export interface JobInfo {
  title: string;
  company: string;
  location: string;
  description: string;
}

function stripHtml(html: string, doc: Document): string {
  const div = doc.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').replace(/\s+\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findJobPosting(node: any): any {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) return node.map(findJobPosting).find(Boolean) || null;
  const type = node['@type'];
  if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) return node;
  return findJobPosting(node['@graph']);
}

function meta(doc: Document, name: string): string {
  return doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute('content')?.trim() || '';
}

function firstText(doc: Document, selectors: string): string {
  return cleanLabel(doc.querySelector(selectors)?.textContent);
}

/**
 * Title/company/description of the job on the current page. Prefers schema.org JobPosting
 * JSON-LD (Greenhouse, Lever, Ashby and most career sites emit it) over DOM guessing.
 */
export function extractJobInfo(doc: Document = document): JobInfo {
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const posting = findJobPosting(JSON.parse(script.textContent || ''));
      if (posting) {
        const place = [].concat(posting.jobLocation || [])[0] as { address?: { addressLocality?: string; addressRegion?: string } } | undefined;
        return {
          title: cleanLabel(posting.title),
          company: cleanLabel(posting.hiringOrganization?.name),
          location: [place?.address?.addressLocality, place?.address?.addressRegion].filter(Boolean).join(', ') || (posting.jobLocationType === 'TELECOMMUTE' ? 'Remote' : ''),
          description: stripHtml(posting.description || '', doc).slice(0, 8000),
        };
      }
    } catch {
      // Malformed JSON-LD is common; fall through to DOM extraction.
    }
  }

  const title =
    firstText(doc, '.app-title, .posting-headline h2, [data-qa="job-title"], .job-title, .job__title h1, h1') ||
    meta(doc, 'og:title') ||
    doc.title;
  const company =
    firstText(doc, '.company-name, [data-qa="company-name"], [itemprop="hiringOrganization"] [itemprop="name"]') ||
    meta(doc, 'og:site_name');
  const descriptionEl = doc.querySelector('#content, .job__description, [data-qa="job-description"], .posting-page .section-wrapper, [class*="job-description"], main');
  return {
    title,
    company,
    location: firstText(doc, '.location, .posting-categories .location, [data-qa="job-location"]'),
    description: cleanLabel(descriptionEl?.textContent).slice(0, 8000),
  };
}
