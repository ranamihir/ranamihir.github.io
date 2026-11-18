// Keeps the email address out of the built HTML so scrapers that read raw
// markup can't harvest it. The address is XOR-encoded at build time (same idea
// as Cloudflare's email protection) and decoded in the browser.
//
// Format: hex string; the first byte is the key, each following byte is one
// character XOR'd with it.

const KEY = 0x5a;

const hex = (n: number) => n.toString(16).padStart(2, '0');

/** Build time: address → opaque hex token. */
export function encodeEmail(email: string): string {
  return hex(KEY) + [...email].map((c) => hex(c.charCodeAt(0) ^ KEY)).join('');
}

/** Browser: hex token → address. */
export function decodeEmail(token: string): string {
  const key = parseInt(token.slice(0, 2), 16);
  let out = '';
  for (let i = 2; i < token.length; i += 2) {
    out += String.fromCharCode(parseInt(token.slice(i, i + 2), 16) ^ key);
  }
  return out;
}

/**
 * Browser: fill in every `[data-email]` element.
 *   href            → mailto: link
 *   [data-email-label] → title + aria-label get the address
 *   [data-email-text]  → text content becomes the address
 */
export function revealEmails(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-email]').forEach((el) => {
    const email = decodeEmail(el.dataset.email!);
    if (el instanceof HTMLAnchorElement) el.href = `mailto:${email}`;
    if ('emailLabel' in el.dataset) {
      el.title = email;
      el.setAttribute('aria-label', `Email ${email}`);
    }
    if ('emailText' in el.dataset) el.textContent = email;
    el.removeAttribute('data-email');
  });
}
