// Tiny inline formatter for copy in src/data:
//   **bold**        → <strong>
//   [text](https…)  → external link (http/https only)
// One parser (`segments`) feeds both the page (`inlineMarkup`, HTML) and the
// terminal (plain segments rendered with textContent). Text is escaped on the
// way out, so data strings can't inject markup.

import { ARROW_UP_RIGHT } from './icons';

export interface TextSegment {
  text: string;
  bold?: boolean;
  href?: string;
}

const LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
const BOLD = /\*\*(.+?)\*\*/g;

/** Split copy into plain, bold, and link segments (links win; `**` inside a link is dropped). */
export function segments(s: string): TextSegment[] {
  const out: TextSegment[] = [];
  const pushText = (chunk: string) => {
    let last = 0;
    for (const m of chunk.matchAll(BOLD)) {
      if (m.index > last) out.push({ text: chunk.slice(last, m.index) });
      out.push({ text: m[1], bold: true });
      last = m.index + m[0].length;
    }
    if (last < chunk.length) out.push({ text: chunk.slice(last) });
  };
  let last = 0;
  for (const m of s.matchAll(LINK)) {
    pushText(s.slice(last, m.index));
    out.push({ text: m[1].replace(BOLD, '$1'), href: m[2] });
    last = m.index + m[0].length;
  }
  pushText(s.slice(last));
  return out;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Same ↗ arrow as the project Code links, sized to the surrounding text.
const ARROW =
  `<svg class="ml-[0.25em] inline-block size-[0.72em] align-[-0.02em]" viewBox="${ARROW_UP_RIGHT.viewBox}" fill="none" aria-hidden="true">` +
  `<path d="${ARROW_UP_RIGHT.d}" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Copy → HTML for `set:html`. */
export const inlineMarkup = (
  s: string,
  { bold = 'font-semibold text-ink', link = 'link-underline font-medium text-ink' } = {},
) =>
  segments(s)
    .map(({ text, bold: isBold, href }) => {
      if (href) {
        // Keep the last word and the arrow together so the arrow never wraps alone.
        const i = text.lastIndexOf(' ');
        const head = escapeHtml(text.slice(0, i + 1));
        const tail = escapeHtml(text.slice(i + 1));
        return (
          `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="${link}">` +
          `${head}<span class="whitespace-nowrap">${tail}${ARROW}</span></a>`
        );
      }
      return isBold ? `<strong class="${bold}">${escapeHtml(text)}</strong>` : escapeHtml(text);
    })
    .join('');

/** Copy stripped to its visible text. */
export const plain = (s: string) =>
  segments(s)
    .map((seg) => seg.text)
    .join('');
