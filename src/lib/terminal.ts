// The hero terminal's shell: commands, tab completion, and inline suggestions.
// Pure logic with no DOM access, so it can be unit-tested; the component
// (src/components/Terminal.astro) renders the lines and handles input.

import type { TextSegment } from './text';
import { DEFAULT_LR, LR_RANGE } from './descent';
import { isThemePref, nextThemePref, THEME_PREFS, type ThemePref } from './theme';

// ---- data -------------------------------------------------------------------

/** Everything the shell knows, serialised into the page at build time. */
export interface TerminalData {
  name: string;
  role: string;
  location: string;
  /** Encoded address; see src/lib/email.ts. */
  email: string;
  bio: string[];
  funFacts: string[];
  socials: { label: string; url: string }[];
  experience: {
    slug: string;
    company: string;
    title: string;
    period: string;
    location: string;
    url?: string;
    about: TextSegment[][];
    stack: string[];
  }[];
  projects: {
    slug: string;
    title: string;
    year: string;
    blurb: string;
    stack: string[];
    code?: string;
    demo?: string;
  }[];
  education: {
    slug: string;
    school: string;
    degree: string;
    period: string;
    location: string;
    detail: string;
    coursework: string[];
  }[];
  skills: { group: string; items: string[] }[];
}

/** Argument name for `experience <company>` / `projects <name>`. */
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Argument name for `education <school>`: an acronym given in parentheses ("(IIT)"), else the initials. */
export const acronym = (s: string) =>
  (
    s.match(/\(([A-Za-z]{2,})\)/)?.[1] ??
    s
      .split(/\s+/)
      .filter((w) => /^[A-Z]/.test(w))
      .map((w) => w[0])
      .join('')
  ).toLowerCase();

// ---- output -----------------------------------------------------------------

export type Seg = { text: string; cls?: string; href?: string };
export type Line = Seg[];

const t = (text: string, cls?: string): Seg => ({ text, cls });
const a = (text: string, href: string): Seg => ({
  text,
  href,
  cls: 'text-term-accent underline decoration-term-dim/50 underline-offset-2 hover:decoration-term-accent',
});
const dim = (text: string) => t(text, 'text-term-dim');
const acc = (text: string) => t(text, 'text-term-accent');
const L = (...segs: (Seg | string)[]): Line => segs.map((s) => (typeof s === 'string' ? t(s) : s));
const blank: Line = [t(' ')];
const rich = (segs: TextSegment[]): Line =>
  segs.map((s) => (s.href ? a(s.text, s.href) : t(s.text)));
const pad = (s: string, n: number) => s + ' '.repeat(Math.max(1, n - s.length));
const bareUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '');

/** The prompt, as shown before each echoed command. */
export const promptLine = (cmd: string): Line =>
  L(t('visitor@mihir', 'text-term-green'), dim(':'), acc('~'), dim('$ '), cmd);

// ---- helpers ----------------------------------------------------------------

/** Resolve an argument to an item by slug: exact, then unique prefix, then 1-based index. */
export function pick<T extends { slug: string }>(items: T[], arg: string): T | undefined {
  const q = arg.toLowerCase();
  const exact = items.find((x) => x.slug === q);
  if (exact) return exact;
  const pre = items.filter((x) => x.slug.startsWith(q));
  if (pre.length === 1) return pre[0];
  const n = Number(q);
  return Number.isInteger(n) && n >= 1 && n <= items.length ? items[n - 1] : undefined;
}

export const commonPrefix = (xs: string[]) =>
  xs.reduce((p, x) => {
    while (!x.startsWith(p)) p = p.slice(0, -1);
    return p;
  }, xs[0] ?? '');

// ---- shell ------------------------------------------------------------------

export interface ShellDeps {
  decodeEmail: (token: string) => string;
  getThemePref: () => ThemePref;
  setTheme: (pref: ThemePref) => void;
  /** Sets the learning rate of the gradient descent behind the hero. */
  setLearningRate?: (lr: number) => void;
  /** False when the screen is too narrow for the gradient descent to run (phones). */
  descentRunning?: () => boolean;
  now?: () => Date;
}

export interface RunResult {
  /** Lines to print after the echoed command (empty for `clear`). */
  lines: Line[];
  /** True if the scrollback should be wiped. */
  clear?: boolean;
}

export function createShell(data: TerminalData, deps: ShellDeps) {
  const history: string[] = [];

  const files: Record<string, string> = {
    'about.txt': 'about',
    'experience.txt': 'experience',
    'projects/': 'projects',
    'education.txt': 'education',
    'skills.txt': 'skills',
    'contact.txt': 'contact',
    'fun-facts.txt': 'fun-facts',
  };

  const help: [string, string][] = [
    ['whoami', 'the one-line version'],
    ['about', 'the slightly longer version'],
    ['experience [company]', 'where I’ve worked'],
    ['projects [name]', 'research from NYU'],
    ['education [school]', 'where I studied'],
    ['skills', 'tools I reach for'],
    ['contact', 'how to reach me'],
    ['fun-facts', 'things a résumé won’t tell you'],
    ['theme [dark|light|system]', 'switch the site theme'],
    ['lr [value|reset]', 'tune the optimizer up top'],
    ['play', 'train your own feed'],
    ['ls, cat, history, clear', 'the usual'],
  ];

  type Command = (args: string[]) => Line[] | 'clear';
  let heroLr = DEFAULT_LR;
  /** 0.001 → "1e-3", 0.25 → "0.25". */
  const fmtLr = (x: number) => (x < 0.01 ? x.toExponential() : `${x}`);

  const commands: Record<string, Command> = {
    help: () => [
      L(dim('Available commands:')),
      ...help.map(([c, d]) => L('  ', acc(pad(c, 28)), dim(d))),
      blank,
      L(dim('Gray text is a suggestion: Tab or → accepts it. ↑/↓ walks history.')),
    ],
    whoami: () => [
      L(t(data.name, 'text-term-text font-semibold'), dim(' · '), `${data.role}, ${data.location}`),
    ],
    about: () => data.bio.flatMap((p, i) => (i ? [blank, L(p)] : [L(p)])),
    experience: (args) => {
      if (args[0]) {
        const e = pick(data.experience, args[0]);
        if (!e)
          return [
            L(`experience: no such company: ${args[0]}`),
            L(dim('Try: '), acc(data.experience.map((x) => x.slug).join(', '))),
          ];
        return [
          L(acc(e.company), dim(' · '), e.title),
          L(dim(`${e.period} · ${e.location}`)),
          ...e.about.flatMap((para) => [blank, rich(para)]),
          blank,
          L(dim('stack: '), dim(e.stack.join(', '))),
          ...(e.url ? [L(dim('web:   '), a(bareUrl(e.url), e.url))] : []),
        ];
      }
      return [
        ...data.experience.flatMap((e) => [
          L(acc(e.company), dim(' · '), e.title, dim(` · ${e.period}`)),
          L(dim('  stack: '), dim(e.stack.join(', '))),
        ]),
        blank,
        L(
          dim('More: '),
          acc('experience <company>'),
          dim(', or the '),
          a('full story', '#experience'),
        ),
      ];
    },
    projects: (args) => {
      if (args[0]) {
        const p = pick(data.projects, args[0]);
        if (!p)
          return [
            L(`projects: no such project: ${args[0]}`),
            L(dim('Try Tab after '), acc('projects ')),
          ];
        return [
          L(acc(p.title), dim(` · ${p.year}`)),
          blank,
          L(p.blurb),
          blank,
          L(dim('stack: '), dim(p.stack.join(', '))),
          ...(p.code ? [L(dim('code:  '), a(bareUrl(p.code), p.code))] : []),
          ...(p.demo ? [L(dim('demo:  '), a(bareUrl(p.demo), p.demo))] : []),
        ];
      }
      return [
        ...data.projects.map((p) => L(dim(p.year + '  '), p.title)),
        blank,
        L(dim('More: '), acc('projects <name>'), dim(', or the '), a('details', '#projects')),
      ];
    },
    education: (args) => {
      if (args[0]) {
        const e = pick(data.education, args[0]);
        if (!e)
          return [
            L(`education: no such school: ${args[0]}`),
            L(dim('Try: '), acc(data.education.map((x) => x.slug).join(', '))),
          ];
        return [
          L(acc(e.school)),
          L(e.degree),
          L(dim(`${e.period} · ${e.location}`)),
          blank,
          ...e.detail.split(' · ').map((d) => L(acc('* '), d)),
          ...(e.coursework.length
            ? [blank, L(dim('coursework:')), L(e.coursework.join(' · '))]
            : []),
        ];
      }
      return [
        ...data.education.flatMap((e) => [
          L(acc(e.school), dim(` · ${e.period}`)),
          L(dim('  ' + e.degree)),
        ]),
        blank,
        L(dim('More: '), acc(`education <${data.education.map((x) => x.slug).join('|')}>`)),
      ];
    },
    skills: () => data.skills.map((s) => L(acc(pad(s.group, 14)), s.items.join(', '))),
    contact: () => {
      const email = deps.decodeEmail(data.email);
      return [
        L(dim(pad('email', 10)), a(email, `mailto:${email}`)),
        ...data.socials.map((s) =>
          L(dim(pad(s.label.toLowerCase(), 10)), a(bareUrl(s.url), s.url)),
        ),
      ];
    },
    'fun-facts': () => data.funFacts.map((f) => L(acc('* '), f)),
    theme: (args) => {
      const want = args[0]?.toLowerCase() ?? nextThemePref(deps.getThemePref());
      if (!isThemePref(want)) return [L(dim('usage: theme [dark|light|system]'))];
      deps.setTheme(want);
      return [L(dim('theme set to '), acc(want === 'system' ? 'system (match device)' : want))];
    },
    lr: (args) => {
      if (!deps.setLearningRate) return [L('lr: nothing to optimize here.')];
      if (deps.descentRunning?.() === false)
        return [L('lr: the optimizer only runs on bigger screens. Try it on a laptop.')];
      if (!args[0])
        return [
          L(dim('learning rate: '), acc(fmtLr(heroLr)), dim(` (default ${fmtLr(DEFAULT_LR)})`)),
          L(dim('usage: lr <value> | lr reset   try '), acc('lr 1'), dim(' or '), acc('lr 0.001')),
        ];
      const want = args[0].toLowerCase() === 'reset' ? DEFAULT_LR : Number(args[0]);
      const [lo, hi] = LR_RANGE;
      if (!Number.isFinite(want) || want < lo || want > hi)
        return [L(`lr: pick a number between ${fmtLr(lo)} and ${hi}`)];
      heroLr = want;
      deps.setLearningRate(want);
      const quip =
        want >= 1
          ? 'Diverging. Gradient clipping is the only thing keeping it on screen.'
          : want >= 0.3
            ? 'Bit jumpy. It might settle down.'
            : want < 0.003
              ? 'It’ll get there. Eventually.'
              : 'Nice and steady.';
      return [
        L(dim('learning rate set to '), acc(fmtLr(want)), dim('. '), quip),
        L(dim('Watch it at the '), a('top of the page', '#about'), dim('.')),
      ];
    },
    ls: (args) => {
      const all = args.some((x) => x.startsWith('-') && x.includes('a'));
      if (args.includes('projects') || args.includes('projects/')) return commands.projects([]);
      const names = Object.keys(files);
      return [
        L(
          ...(all ? ['.', '..', '.secret', ...names] : names).flatMap((n) => [
            n.endsWith('/') ? acc(n) : t(n),
            t('  '),
          ]),
        ),
      ];
    },
    cat: (args) => {
      const f = args[0];
      if (!f) return [L(dim('usage: cat <file>'))];
      if (f === '.secret')
        return [
          L('You found it. There’s nothing here, but I like your curiosity.'),
          L(dim('Say hi: '), acc('contact')),
        ];
      const cmd = files[f] ?? files[f + '/'];
      if (cmd === 'projects') return [L(`cat: ${f}: Is a directory`)];
      return cmd ? commands[cmd]([]) : [L(`cat: ${f}: No such file or directory`)];
    },
    history: () => history.map((h, i) => L(dim(String(i + 1).padStart(4) + '  '), h)),
    pwd: () => [L('/home/visitor')],
    date: () => [L((deps.now?.() ?? new Date()).toString())],
    echo: (args) => [L(args.join(' '))],
    clear: () => 'clear',
    sudo: () => [
      L('visitor is not in the sudoers file. This incident will be reported.'),
      L(dim('(Kidding.)')),
    ],
    rm: () => [L('Let’s not.')],
    play: () => [
      L(acc('Train your own feed.'), ' Swipe on a few dishes, and a tiny recommender learns'),
      L('your taste live: what it predicts, how it ranks, and what it gets wrong.'),
      L(
        dim('Head to the '),
        a('playground', '#playground'),
        dim(', or '),
        a('jump straight in', '#play'),
        dim('.'),
      ),
    ],
    exit: () => [L('Nice try. You can always scroll, though.')],
    vim: () => [L('Bold choice. This shell is read-only.')],
  };

  const aliases: Record<string, string> = {
    'hire-me': 'contact',
    hire: 'contact',
    email: 'contact',
    facts: 'fun-facts',
    funfacts: 'fun-facts',
    work: 'experience',
    resume: 'experience',
    cv: 'experience',
    emacs: 'vim',
    nano: 'vim',
    cls: 'clear',
    feed: 'play',
    game: 'play',
    playground: 'play',
    swipe: 'play',
    man: 'help',
    '?': 'help',
  };

  /** Commands shown in listings (easter eggs stay completable but unlisted). */
  const visible = [
    'help',
    'whoami',
    'about',
    'experience',
    'projects',
    'education',
    'skills',
    'contact',
    'fun-facts',
    'theme',
    'lr',
    'play',
    'ls',
    'cat',
    'history',
    'clear',
  ];

  /** Arguments each command can complete (all lowercase). */
  const argCompletions: Record<string, string[]> = {
    cat: Object.keys(files).filter((f) => !f.endsWith('/')),
    ls: ['projects/'],
    theme: [...THEME_PREFS],
    lr: ['reset'],
    experience: data.experience.map((e) => e.slug),
    projects: data.projects.map((p) => p.slug),
    education: data.education.map((e) => e.slug),
  };

  // Tiered: real commands win; easter eggs, then aliases, only if nothing else matches.
  const commandTiers = [visible, Object.keys(commands), Object.keys(aliases)];

  /** Run a command line. Empty input prints nothing and isn't recorded. */
  function run(raw: string): RunResult {
    const line = raw.trim();
    if (!line) return { lines: [] };
    history.push(line);
    const [name, ...args] = line.split(/\s+/);
    const key = name.toLowerCase();
    const fn = commands[key] ?? commands[aliases[key]];
    const result = fn
      ? fn(args)
      : [L(`command not found: ${name}`), L(dim('Try '), acc('help'), dim('.'))];
    return result === 'clear' ? { lines: [], clear: true } : { lines: [...result, blank] };
  }

  /**
   * Bash-style Tab: a unique match completes (plus a space if it takes an
   * argument); several matches extend to their shared prefix, and `hits`
   * lists them.
   */
  function complete(v: string): { value: string; hits: string[] } {
    const m = v.match(/^(\S+)\s+(\S*)$/);
    if (m) {
      const q = m[2].toLowerCase();
      const hits = (argCompletions[m[1].toLowerCase()] ?? []).filter((o) => o.startsWith(q));
      if (!hits.length) return { value: v, hits };
      return { value: `${m[1]} ${hits.length === 1 ? hits[0] : commonPrefix(hits)}`, hits };
    }
    if (/\s/.test(v)) return { value: v, hits: [] };
    const lower = v.toLowerCase();
    const hits =
      commandTiers.map((pool) => pool.filter((c) => c.startsWith(lower))).find((h) => h.length) ??
      [];
    if (hits.length === 1) return { value: hits[0] + (argCompletions[hits[0]] ? ' ' : ''), hits };
    if (hits.length > 1) return { value: commonPrefix(hits), hits };
    return { value: v, hits };
  }

  /** Inline (ghost) suggestion: the most recent matching history entry, else the best completion. */
  function suggest(v: string): string {
    if (!v.trim()) return '';
    const fromHistory = [...history].reverse().find((h) => h.startsWith(v) && h !== v);
    if (fromHistory) return fromHistory;
    const m = v.match(/^(\S+)\s+(\S*)$/);
    if (m) {
      const q = m[2].toLowerCase();
      const opt = (argCompletions[m[1].toLowerCase()] ?? []).find(
        (o) => o.startsWith(q) && o !== q,
      );
      return opt ? `${m[1]} ${opt}` : '';
    }
    if (/\s/.test(v)) return '';
    const lower = v.toLowerCase();
    return (
      commandTiers
        .map((pool) => pool.find((c) => c.startsWith(lower) && c !== lower))
        .find(Boolean) ?? ''
    );
  }

  /** True if `cmd` takes an argument (so accepting it should add a trailing space). */
  const takesArgument = (cmd: string) => cmd in argCompletions;

  return { run, complete, suggest, takesArgument, history, visible };
}

export type Shell = ReturnType<typeof createShell>;
