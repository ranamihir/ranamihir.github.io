import { describe, expect, it } from 'vitest';
import { isThemePref, nextThemePref, resolveTheme } from '../src/lib/theme';

describe('theme preferences', () => {
  it('cycles dark → light → system → dark', () => {
    expect(nextThemePref('dark')).toBe('light');
    expect(nextThemePref('light')).toBe('system');
    expect(nextThemePref('system')).toBe('dark');
  });

  it('resolves system from the device setting', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('validates stored values', () => {
    expect(isThemePref('light')).toBe(true);
    expect(isThemePref('sepia')).toBe(false);
    expect(isThemePref(null)).toBe(false);
  });
});
