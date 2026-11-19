// Small DOM helpers shared by the playground's client modules.

export const $ = <T extends Element = HTMLElement>(id: string) =>
  document.getElementById(id) as T | null;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = '',
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const NS = 'http://www.w3.org/2000/svg';
export function svg(tag: string, attrs: Record<string, string | number>, text?: string) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  return e;
}

export const pct = (p: number) => `${Math.round(p * 100)}%`;
/**
 * A score in points: probabilities are percentages, so a score of 0.99 reads as
 * 99 and adds up with the percentages beside it. Real minus sign.
 */
export const points = (v: number) => {
  const n = Math.round(v * 100);
  return (n < 0 ? '−' : '') + Math.abs(n);
};

/** A horizontal meter, 0–1. */
export function bar(frac: number, cls: string) {
  const track = el('span', 'relative block h-1.5 w-full overflow-hidden rounded-full bg-line');
  const fill = el(
    'span',
    `absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ${cls}`,
  );
  fill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  track.append(fill);
  return track;
}

/** The Instagram heart, as an SVG (currentColor outline). */
export function heartSvg(cls: string) {
  const icon = svg('svg', { viewBox: '0 0 24 24', class: cls, 'aria-hidden': 'true' });
  icon.append(
    svg('path', {
      d: 'M12 20.6s-7.6-4.6-9.4-9.3C1.4 8 3.3 4.6 6.7 4.4c2.1-.1 3.9 1 5.3 2.9 1.4-1.9 3.2-3 5.3-2.9 3.4.2 5.3 3.6 4.1 6.9-1.8 4.7-9.4 9.3-9.4 9.3z',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linejoin': 'round',
    }),
  );
  return icon;
}

export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
