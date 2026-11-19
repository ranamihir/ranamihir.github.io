// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { createHash } from 'node:crypto';
import { THEME_INIT_SCRIPT } from './src/lib/theme-init.ts';

// Astro hashes the scripts it bundles, but not is:inline ones; this is the
// only inline script, so hash it here from the same source string.
/** @param {string} s @returns {`sha256-${string}`} */
const sha256 = (s) => `sha256-${createHash('sha256').update(s).digest('base64')}`;

// https://astro.build/config
export default defineConfig({
  site: 'https://ranamihir.com',
  integrations: [sitemap()],
  // Content Security Policy, emitted as a <meta> tag (GitHub Pages can't set
  // response headers). Astro hashes every script and style it emits, so no
  // 'unsafe-inline' is needed; keep markup free of inline style="" attributes.
  // frame-ancestors and HSTS can only be sent as headers, so they're absent.
  security: {
    csp: {
      scriptDirective: { hashes: [sha256(THEME_INIT_SCRIPT)] },
      directives: [
        "default-src 'none'",
        "img-src 'self'",
        // The playground's clips (public/playground/*.mp4).
        "media-src 'self'",
        "font-src 'self'",
        "manifest-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
        "object-src 'none'",
        'upgrade-insecure-requests',
      ],
    },
  },
  // No Markdown here; Shiki's inline styles would also conflict with the CSP.
  markdown: { syntaxHighlight: false },
  vite: {
    plugins: [tailwindcss()],
  },
});
