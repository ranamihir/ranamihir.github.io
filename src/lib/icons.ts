// Shared SVG path data, so icons rendered from components and from HTML
// strings (src/lib/text.ts) stay identical.

/** ↗ "opens elsewhere" arrow, drawn on a 13×13 grid with a 1.4 stroke. */
export const ARROW_UP_RIGHT = { viewBox: '0 0 13 13', d: 'M3 10 10 3m0 0H4m6 0v6' } as const;
