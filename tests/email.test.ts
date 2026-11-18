import { describe, expect, it } from 'vitest';
import { decodeEmail, encodeEmail } from '../src/lib/email';

describe('email obfuscation', () => {
  it('round-trips', () => {
    expect(decodeEmail(encodeEmail('someone@example.com'))).toBe('someone@example.com');
  });

  it('keeps the address out of the token', () => {
    const token = encodeEmail('someone@example.com');
    expect(token).toMatch(/^[0-9a-f]+$/);
    expect(token).not.toContain('example');
  });
});
