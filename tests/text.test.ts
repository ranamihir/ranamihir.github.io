import { describe, expect, it } from 'vitest';
import { inlineMarkup, plain, segments } from '../src/lib/text';

describe('segments', () => {
  it('splits plain, bold, and link runs', () => {
    expect(segments('I built **this** at [Acme](https://acme.test/x).')).toEqual([
      { text: 'I built ' },
      { text: 'this', bold: true },
      { text: ' at ' },
      { text: 'Acme', href: 'https://acme.test/x' },
      { text: '.' },
    ]);
  });

  it('ignores non-http(s) link targets', () => {
    expect(segments('[x](javascript:alert(1))')).toEqual([{ text: '[x](javascript:alert(1))' }]);
  });

  it('drops bold markers inside link text', () => {
    expect(segments('[**b**](https://a.test)')).toEqual([{ text: 'b', href: 'https://a.test' }]);
  });
});

describe('inlineMarkup', () => {
  it('escapes HTML in copy', () => {
    const html = inlineMarkup('<img src=x onerror=alert(1)> & "q"');
    expect(html).toBe('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;');
  });

  it('renders bold and external links', () => {
    const html = inlineMarkup('**Hi** [two words](https://a.test/?a=1&b=2)');
    expect(html).toContain('<strong class="font-semibold text-ink">Hi</strong>');
    expect(html).toContain('href="https://a.test/?a=1&amp;b=2"');
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    // The last word and the arrow never wrap apart.
    expect(html).toMatch(/two <span class="whitespace-nowrap">words<svg/);
  });
});

describe('plain', () => {
  it('strips markup to visible text', () => {
    expect(plain('**a** [b](https://c.test) d')).toBe('a b d');
  });
});
