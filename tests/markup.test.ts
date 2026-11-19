// Guards against words running together in the built HTML ("Avalue model",
// "you’llopen", "$ cd~/mihir").
//
// Why it happens: with compressHTML (Astro's default), whitespace that holds a
// line break and touches a tag is dropped, not collapsed to a space. So text
// that ends a line, followed by an inline element on the next line, renders
// with no space between them (and the same for an inline element ending a line
// followed by text). Prettier's Astro plugin treats those line breaks as
// insignificant and won't add the space back. When the space matters, write
// {' '} at the end of the first line (Prettier does this itself when it wraps).

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Elements that sit inline in running text, plus components (capitalized). */
const INLINE =
  '(?:a|abbr|b|button|cite|code|em|i|img|kbd|label|mark|q|s|small|span|strong|sub|sup|svg|time|u|[A-Z][A-Za-z0-9]*)';
/** Text that wants a space after it: ends in a word, a closing quote, or sentence punctuation. */
const TEXT_END = /[\p{L}\p{N}.,;:!?’”)\]]$/u;
/** Text that wants a space before it: starts with a word or an opening quote/paren. */
const TEXT_START = /^[\p{L}\p{N}(“‘]/u;
const OPENS_INLINE = new RegExp(`^<${INLINE}[\\s/>]`);
const CLOSES_INLINE = new RegExp(`</${INLINE}>$`);

/** Blank out everything that isn't markup (frontmatter, scripts, styles, comments), keeping line numbers. */
function markupOnly(source: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, '');
  return source
    .replace(/^---\n[\s\S]*?\n---\n/, blank)
    .replace(/<script\b[\s\S]*?<\/script>/g, blank)
    .replace(/<style\b[\s\S]*?<\/style>/g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank);
}

/** Line pairs where a space the author meant to have will vanish. */
export function missingSpaces(source: string): { line: number; text: string }[] {
  const lines = markupOnly(source).split('\n');
  const found: { line: number; text: string }[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i].trim();
    const b = lines[i + 1].trim();
    if (!a || !b) continue;
    const textThenTag = TEXT_END.test(a) && !a.endsWith('>') && OPENS_INLINE.test(b);
    const tagThenText = CLOSES_INLINE.test(a) && TEXT_START.test(b);
    const textThenExpr =
      TEXT_END.test(a) && !a.endsWith('>') && b.startsWith('{') && !b.startsWith("{' '}");
    if (textThenTag || tagThenText || textThenExpr)
      found.push({ line: i + 1, text: `${a.slice(-40)} ⏎ ${b.slice(0, 40)}` });
  }
  return found;
}

function astroFiles(dir: string): string[] {
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((f) => f.endsWith('.astro'))
    .map((f) => join(dir, f));
}

describe('missingSpaces', () => {
  it('catches text running into an inline element on the next line', () => {
    expect(
      missingSpaces('<p>\n  hide it? A\n  <strong>value model</strong> weighs\n</p>'),
    ).toHaveLength(1);
    expect(missingSpaces('<p>\n  $ cd\n  <a href="/">~/mihir</a>\n</p>')).toHaveLength(1);
    expect(missingSpaces('<p>\n  Opens.\n  <Icon name="x" />\n</p>')).toHaveLength(1);
  });

  it('catches an inline element running into text on the next line', () => {
    expect(missingSpaces('<p>\n  <span>a</span>\n  Prefer a terminal?\n</p>')).toHaveLength(1);
  });

  it('catches text running into an expression on the next line', () => {
    expect(missingSpaces('<p>\n  Hello\n  {name}\n</p>')).toHaveLength(1);
  });

  it('accepts an explicit space, same-line text, block elements, and punctuation', () => {
    expect(missingSpaces("<p>\n  hide it? A{' '}\n  <strong>value model</strong>\n</p>")).toEqual(
      [],
    );
    expect(missingSpaces('<p>one <strong>two</strong> three</p>')).toEqual([]);
    expect(missingSpaces('<div>\n  Some text\n  <p>A paragraph</p>\n</div>')).toEqual([]);
    expect(missingSpaces('<p>\n  <a href="#">Pixabay</a>\n  .\n</p>')).toEqual([]);
    expect(missingSpaces("<p>\n  Hello\n  {' '}\n  <b>x</b>\n</p>")).toEqual([]);
  });

  it('ignores frontmatter, scripts, styles, and comments', () => {
    const src =
      '---\nconst a = 1\n{ b }\n---\n<script>\n  run()\n  {x}\n</script>\n<!-- word\n<b>x</b> -->';
    expect(missingSpaces(src)).toEqual([]);
  });
});

describe('site markup', () => {
  it.each(astroFiles('src'))('%s keeps its spaces between text and inline elements', (file) => {
    expect(missingSpaces(readFileSync(file, 'utf8'))).toEqual([]);
  });
});
