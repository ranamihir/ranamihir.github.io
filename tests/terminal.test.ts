import { beforeEach, describe, expect, it } from 'vitest';
import {
  acronym,
  commonPrefix,
  createShell,
  pick,
  slugify,
  type Line,
  type Shell,
  type TerminalData,
} from '../src/lib/terminal';
import type { ThemePref } from '../src/lib/theme';

const data: TerminalData = {
  name: 'Ada Lovelace',
  role: 'Engineer',
  location: 'London',
  email: 'token',
  bio: ['First paragraph.', 'Second paragraph.'],
  funFacts: ['Fact one.'],
  socials: [{ label: 'GitHub', url: 'https://github.com/ada' }],
  experience: [
    {
      slug: 'analytical-engines',
      company: 'Analytical Engines',
      title: 'Programmer',
      period: '1842 – 1843',
      location: 'London',
      url: 'https://www.example.com',
      about: [[{ text: 'Wrote ' }, { text: 'Note G', href: 'https://example.com/g' }]],
      stack: ['Punch cards'],
    },
    {
      slug: 'acme',
      company: 'Acme',
      title: 'Consultant',
      period: '1844',
      location: 'Remote',
      about: [],
      stack: [],
    },
  ],
  projects: [
    { slug: 'bernoulli', title: 'Bernoulli', year: '1843', blurb: 'Numbers.', stack: [] },
    { slug: 'bells', title: 'Bells', year: '1844', blurb: 'Music.', stack: [] },
  ],
  education: [
    {
      slug: 'nyu',
      school: 'New York University',
      degree: 'M.S.',
      period: '2017 – 2019',
      location: 'NY',
      detail: 'A · B',
      coursework: [],
    },
  ],
  skills: [{ group: 'Languages', items: ['Python'] }],
};

const text = (lines: Line[]) => lines.map((l) => l.map((s) => s.text).join('')).join('\n');

let shell: Shell;
let theme: ThemePref;
let heroLr: number | undefined;

beforeEach(() => {
  theme = 'dark';
  heroLr = undefined;
  shell = createShell(data, {
    decodeEmail: () => 'ada@example.com',
    getThemePref: () => theme,
    setTheme: (pref) => {
      theme = pref;
    },
    setLearningRate: (lr) => {
      heroLr = lr;
    },
    now: () => new Date(0),
  });
});

describe('helpers', () => {
  it('slugifies and abbreviates', () => {
    expect(slugify('Visual Embeddings for RL!')).toBe('visual-embeddings-for-rl');
    expect(acronym('New York University')).toBe('nyu');
    expect(acronym('Indian Institute of Technology (IIT), Roorkee')).toBe('iit');
  });

  it('picks by exact slug, unique prefix, or 1-based index', () => {
    const items = [{ slug: 'meta' }, { slug: 'metro' }, { slug: 'tripadvisor' }];
    expect(pick(items, 'META')).toBe(items[0]);
    expect(pick(items, 'trip')).toBe(items[2]);
    expect(pick(items, 'met')).toBeUndefined(); // ambiguous
    expect(pick(items, '2')).toBe(items[1]);
    expect(pick(items, '9')).toBeUndefined();
  });

  it('finds the common prefix', () => {
    expect(commonPrefix(['bells', 'bernoulli'])).toBe('be');
    expect(commonPrefix([])).toBe('');
  });
});

describe('run', () => {
  it('ignores empty input', () => {
    expect(shell.run('   ')).toEqual({ lines: [] });
    expect(shell.history).toEqual([]);
  });

  it('prints whoami and records history', () => {
    expect(text(shell.run('whoami').lines)).toContain('Ada Lovelace · Engineer, London');
    expect(shell.history).toEqual(['whoami']);
  });

  it('resolves aliases and is case-insensitive', () => {
    expect(text(shell.run('HIRE-ME').lines)).toContain('ada@example.com');
  });

  it('renders experience detail with links', () => {
    const { lines } = shell.run('experience analytical');
    expect(text(lines)).toContain('Analytical Engines · Programmer');
    const link = lines.flat().find((s) => s.text === 'Note G');
    expect(link?.href).toBe('https://example.com/g');
    expect(text(lines)).toContain('web:   example.com');
  });

  it('explains unknown arguments and commands', () => {
    expect(text(shell.run('experience nope').lines)).toContain('no such company: nope');
    expect(text(shell.run('frobnicate').lines)).toContain('command not found: frobnicate');
  });

  it('switches and cycles the theme', () => {
    shell.run('theme light');
    expect(theme).toBe('light');
    shell.run('theme');
    expect(theme).toBe('system');
    expect(text(shell.run('theme sepia').lines)).toContain('usage: theme');
    expect(theme).toBe('system');
  });

  it('handles the fake filesystem', () => {
    expect(text(shell.run('cat projects').lines)).toContain('Is a directory');
    expect(text(shell.run('cat skills.txt').lines)).toContain('Python');
    expect(text(shell.run('ls -la').lines)).toContain('.secret');
    expect(text(shell.run('cat nope.txt').lines)).toContain('No such file or directory');
  });

  it('sets the hero learning rate', () => {
    expect(text(shell.run('lr').lines)).toContain('learning rate: 0.03');
    expect(text(shell.run('lr 10').lines)).toContain('Diverging');
    expect(heroLr).toBe(10);
    expect(text(shell.run('lr').lines)).toContain('learning rate: 10');
    shell.run('lr reset');
    expect(heroLr).toBe(0.03);
    expect(text(shell.run('lr banana').lines)).toContain('pick a number');
    expect(heroLr).toBe(0.03);
  });

  it('signals clear', () => {
    expect(shell.run('clear')).toEqual({ lines: [], clear: true });
  });
});

describe('complete', () => {
  it('completes a unique command, adding a space if it takes an argument', () => {
    expect(shell.complete('who').value).toBe('whoami');
    expect(shell.complete('exp').value).toBe('experience ');
  });

  it('extends ambiguous matches to their shared prefix', () => {
    expect(shell.complete('projects b')).toEqual({
      value: 'projects be',
      hits: ['bernoulli', 'bells'],
    });
  });

  it('completes arguments case-insensitively', () => {
    expect(shell.complete('experience ACM').value).toBe('experience acme');
    expect(shell.complete('Theme Li').value).toBe('Theme light');
  });

  it('prefers real commands over easter eggs and aliases', () => {
    expect(shell.complete('e').hits).toEqual(['experience', 'education']);
  });
});

describe('suggest', () => {
  it('prefers the most recent matching history entry', () => {
    shell.run('projects bells');
    shell.run('projects bernoulli');
    expect(shell.suggest('projects b')).toBe('projects bernoulli');
  });

  it('suggests commands and arguments', () => {
    expect(shell.suggest('he')).toBe('help');
    expect(shell.suggest('education N')).toBe('education nyu');
    expect(shell.suggest('')).toBe('');
  });
});
