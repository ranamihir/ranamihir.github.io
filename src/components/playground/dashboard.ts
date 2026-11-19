// The model, at a glance, in four parts that read top to bottom as cause and
// effect: what your last swipe taught it, why this clip scored what it did (one
// stacked bar), what's up next (the same bar for each, re-sorted), and what it
// thinks you like (the bars your last swipe moved light up). Plus the progress
// segments over the clip. Read-only views of the feed; main.ts decides when to
// repaint, and calls snapshot() before each swipe so the next story can say
// what changed.

import type { PlaygroundCard } from '../../data/dishes';
import {
  EXPLORE,
  FEATURES,
  QUALITY_PENALTY,
  SESSION,
  WEIGHTS,
  type Feed,
  type Score,
  type Visit,
} from '../../lib/feed';
import { $, EASE_OUT, el, points } from './dom';

/** The best score a clip can get: every prediction at 100%, plus the full novelty bonus. */
const MAX_SCORE = WEIGHTS.like + WEIGHTS.watch + WEIGHTS.open + EXPLORE;
/** A weight that moves at least this much on a swipe gets named in the story and lit up. */
const MOVED = 0.04;
/** How long the moved taste bars stay lit. */
const GLOW_MS = 1800;

/** The parts of a score, in bar order. Colors are the --color-score-* tokens. */
const PARTS = [
  { key: 'like', label: 'Like', fill: 'bg-score-like' },
  { key: 'watch', label: 'Keep watching', fill: 'bg-score-watch' },
  { key: 'open', label: 'Tap open', fill: 'bg-score-tap' },
  { key: 'explore', label: 'Something new', fill: 'bg-score-new' },
] as const;
const partValue = (s: Score, key: (typeof PARTS)[number]['key']) =>
  key === 'explore' ? s.explore : s.parts[key];

export interface Story {
  /** The card that was just left. */
  slug: string;
  visit: Visit | null;
  dir: 'next' | 'back';
}

export function createDashboard(feed: Feed, bySlug: Map<string, PlaygroundCard>, reduced: boolean) {
  const progress = $('pg-progress')!;
  const story = $('pg-story')!;
  const storyMini = $('pg-story-mini')!;
  const why = $('pg-why')!;
  const next = $('pg-next')!;
  const nextNote = $('pg-next-note')!;
  const taste = $('pg-taste')!;

  const card = (slug: string) => bySlug.get(slug)!;
  const title = (c: PlaygroundCard) => (c.bait ? 'Clickbait post' : c.name);

  // What the model looked like before the last swipe: taste weights and the ranking.
  let before: { weights: number[]; order: string[] } | null = null;
  /** Rank changes in Up next since the last swipe: slug → places moved (+ is up). */
  let moved = new Map<string, number>();
  let glowTimer: number | undefined;

  // ---- progress: one segment per clip, coloured by the guess ----------------
  function renderProgress(atSummary: boolean) {
    progress.replaceChildren();
    const log = feed.log;
    if (log.length >= SESSION && (atSummary || !feed.revisiting)) {
      progress.append(el('li', 'text-[0.75rem] text-ink-faint', `${log.length} clips seen`));
      progress.setAttribute('aria-label', `${log.length} clips seen`);
      return;
    }
    const cur = feed.current;
    const at = cur && feed.revisiting ? log.findIndex((r) => r.slug === cur.slug) : log.length;
    for (let i = 0; i < SESSION; i++) {
      const r = log[i];
      const cls = !r
        ? i === at && !atSummary
          ? 'bg-ink/60'
          : 'bg-line'
        : r.correct === null
          ? 'bg-ink-faint/40'
          : r.correct
            ? 'bg-accent'
            : 'bg-ink-faint';
      const ring = i === at && r ? 'ring-2 ring-ink/40 ring-offset-1 ring-offset-paper' : '';
      const seg = el('li', `h-1 flex-1 rounded-full transition-colors duration-300 ${cls} ${ring}`);
      if (r)
        seg.title =
          r.correct === null ? 'It had no idea' : r.correct ? 'Guessed right' : 'Guessed wrong';
      progress.append(seg);
    }
    progress.setAttribute(
      'aria-label',
      `Clip ${Math.min(at + 1, SESSION)} of ${SESSION}. ${feed.accuracy().right} guesses right so far.`,
    );
  }

  // ---- what just happened -----------------------------------------------------
  /** Taste weights that moved on the last swipe, biggest first. */
  function deltas() {
    if (!before) return [];
    const was = before.weights;
    return feed
      .learned()
      .map((f, i) => ({ ...f, d: f.weight - was[i] }))
      .filter((f) => Math.abs(f.d) >= MOVED)
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  }

  function tell({ slug, visit, dir }: Story) {
    const c = card(slug);
    const name = c.bait ? 'the clickbait post' : c.name;
    const r = visit?.record;
    const now = feed.current ? card(feed.current.slug) : null;
    let head: string;
    let tail = '';
    const changed = deltas();
    if (r && !visit!.revisit) {
      const did = r.labels.like
        ? `You ❤️’d ${name}.`
        : r.labels.watch
          ? `You kept watching ${name}.`
          : `You skipped ${name}.`;
      const guessed =
        r.correct === null
          ? 'It had no idea either way.'
          : `It guessed you’d ${r.guess > 0.5 ? 'be into it' : 'scroll past'}: ${r.correct ? '✓ right' : '✗ wrong'}.`;
      head = `${did} ${guessed}`;
      if (r.baitCaught)
        tail = 'That was clickbait: built for taps, not enjoyment. The quality filter is on now.';
    } else if (r && changed.length) {
      head = `You ${r.labels.like ? '❤️’d' : 'came back to'} ${name} on a second look.`;
    } else if (dir === 'back' && now) {
      head = `Back to ${now.bait ? 'the clickbait post' : now.name}. A second look can only add to what it learned.`;
    } else {
      head = now ? `You’ve seen ${now.bait ? 'this' : now.name} before.` : 'That’s every dish.';
    }
    if (!tail)
      tail = changed.length
        ? `Learned: ${changed
            .slice(0, 3)
            .map((f) => `${f.emoji} ${f.label} ${f.d > 0 ? '▲' : '▼'}`)
            .join('  ')}`
        : r && !visit!.revisit
          ? 'Learned: nothing new about flavors.'
          : '';
    paintStory(head, tail);
    glow(changed.map((f) => f.key));

    // Up next: how far each clip moved, against the ranking before the swipe.
    const order = before?.order.filter((s) => !feed.hasSeen(s)) ?? [];
    moved = new Map();
    feed.upNext(3).forEach((x, i) => {
      const was = order.indexOf(x.item.slug);
      if (was >= 0 && was !== i) moved.set(x.item.slug, was - i);
    });
  }

  function paintStory(head: string, tail: string) {
    story.replaceChildren(el('p', 'text-ink', head));
    if (tail) story.append(el('p', 'mt-1 text-ink-soft', tail));
    storyMini.textContent = tail ? `${head} ${tail}` : head;
  }

  function resetStory() {
    before = null;
    moved = new Map();
    paintStory('This first clip is random: it knows nothing about you yet.', '');
  }

  // ---- why this clip: one stacked bar ---------------------------------------
  /** A stacked bar of a score's positive parts, on a fixed scale (MAX_SCORE = full width). */
  function stack(s: Score, h: string) {
    // The gaps between segments show the surface, so neighbouring colours never touch.
    const track = el('span', `flex ${h} w-full gap-[2px] overflow-hidden rounded-full`);
    track.setAttribute('aria-hidden', 'true');
    for (const p of PARTS) {
      const v = partValue(s, p.key);
      if (v <= 0.005) continue;
      const seg = el('span', `${p.fill} h-full shrink-0`);
      seg.style.width = `${(v / MAX_SCORE) * 100}%`;
      track.append(seg);
    }
    track.append(el('span', 'h-full flex-1 bg-line'));
    return track;
  }

  function renderWhy() {
    why.replaceChildren();
    const cur = feed.current;
    if (!cur) return;
    const s = feed.score(cur);
    const head = el('div', 'flex items-baseline justify-between gap-3');
    head.append(
      el('span', 'text-[0.8rem] text-ink-soft', 'Score'),
      el('span', 'font-serif text-2xl leading-none text-ink tabular-nums', points(s.total)),
    );
    const bar = stack(s, 'h-2.5');
    bar.classList.add('mt-2');
    const legend = el('ul', 'mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[0.75rem]');
    for (const p of PARTS) {
      const li = el('li', 'flex items-center gap-1.5');
      const v = partValue(s, p.key);
      li.title =
        p.key === 'explore'
          ? 'A bonus for flavors it hasn’t shown you much'
          : `Its guess, ${Math.round(s.p[p.key] * 100)}%, × ${WEIGHTS[p.key]}`;
      li.append(
        el('span', `h-2 w-2 shrink-0 rounded-full ${p.fill}`),
        el('span', 'truncate text-ink-soft', p.label + (p.key === 'open' ? ' (½)' : '')),
        el('span', 'ml-auto text-ink tabular-nums', points(v)),
      );
      legend.append(li);
    }
    why.append(head, bar, legend);
    if (s.quality < 0)
      why.append(
        el(
          'p',
          'mt-2 flex justify-between text-[0.75rem] text-ink-soft',
          `Clickbait penalty: −${points(QUALITY_PENALTY)}`,
        ),
      );
    if (feed.onTrial)
      why.append(
        el(
          'p',
          'mt-3 text-[0.75rem] leading-snug text-ink-soft',
          'Trial view: feeds show new posts to a few people to see how they land. Look how much of this score is taps.',
        ),
      );
  }

  // ---- up next: rows that re-sort (FLIP) ---------------------------------------
  function flip(list: HTMLElement, paint: () => void) {
    const items = () => list.querySelectorAll<HTMLElement>('[data-slug]');
    const first = new Map<string, DOMRect>();
    if (!reduced) items().forEach((n) => first.set(n.dataset.slug!, n.getBoundingClientRect()));
    paint();
    if (reduced || !first.size) return;
    items().forEach((n) => {
      const was = first.get(n.dataset.slug!);
      if (!was) {
        n.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
        return;
      }
      const dy = was.top - n.getBoundingClientRect().top;
      if (Math.abs(dy) > 1)
        n.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
          duration: 450,
          easing: EASE_OUT,
        });
    });
  }

  function renderNext() {
    const ranked = feed.upNext(3);
    flip(next, () => {
      next.replaceChildren();
      for (const r of ranked) {
        const c = card(r.item.slug);
        const li = el('li', 'grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3');
        li.dataset.slug = c.slug;
        const img = el('img', 'h-10 w-10 rounded-lg object-cover');
        img.src = c.thumb;
        img.alt = '';
        const mid = el('div', 'min-w-0');
        const bar = stack(r.score, 'h-1.5');
        bar.classList.add('mt-1.5');
        mid.append(el('p', 'truncate text-[0.8rem] text-ink', title(c)), bar);
        const right = el('p', 'text-right text-[0.8rem] text-ink-soft tabular-nums');
        right.append(points(r.score.total));
        const m = moved.get(c.slug);
        if (m) {
          const arrow = el(
            'span',
            `ml-1 inline-block w-3 text-[0.65rem] ${m > 0 ? 'text-ink' : 'text-ink-faint'}`,
            m > 0 ? '▲' : '▼',
          );
          arrow.title = m > 0 ? `Up ${m} since your last swipe` : `Down ${-m}`;
          right.append(arrow);
        } else right.append(el('span', 'ml-1 inline-block w-3'));
        li.append(img, mid, right);
        li.setAttribute('aria-label', `${title(c)}, score ${points(r.score.total)}`);
        next.append(li);
      }
    });
    const tied = ranked.length > 1 && new Set(ranked.map((r) => points(r.score.total))).size === 1;
    const blocked = [...bySlug.values()].filter(
      (c) => c.bait && feed.qualityOn && !feed.hasSeen(c.slug),
    ).length;
    nextNote.textContent = tied
      ? 'All tied: it can’t tell these apart yet.'
      : blocked
        ? `The quality filter is keeping ${blocked} more clickbait post${blocked === 1 ? '' : 's'} out.`
        : '';
  }

  // ---- what it thinks you like: one bar per flavor ---------------------------
  const rows = FEATURES.map((f) => {
    const li = el(
      'li',
      'grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 text-[0.8rem] transition-colors duration-500',
    );
    const label = el(
      'span',
      'truncate text-ink-soft transition-colors duration-500',
      `${f.emoji} ${f.label}`,
    );
    const track = el('span', 'relative block h-1.5 rounded-full bg-line');
    track.setAttribute('aria-hidden', 'true');
    track.append(el('span', 'absolute -inset-y-0.5 left-1/2 w-px bg-ink-faint/60'));
    const fill = el(
      'span',
      'absolute inset-y-0 rounded-full transition-[left,width,background-color,box-shadow] duration-500',
    );
    track.append(fill);
    const said = el('span', 'sr-only');
    li.append(label, track, said);
    taste.append(li);
    return { key: f.key, label, fill, said };
  });

  function renderTaste() {
    const ws = feed.learned();
    // Relative to each other: when you're into few clips, every weight drifts down.
    const mean = ws.reduce((s, f) => s + f.weight, 0) / ws.length;
    const cap = Math.max(0.5, ...ws.map((f) => Math.abs(f.weight - mean)));
    ws.forEach((f, i) => {
      const k = feed.swipes ? Math.max(-1, Math.min(1, (f.weight - mean) / cap)) : 0;
      const { fill, said } = rows[i];
      const w = Math.abs(k) * 50;
      fill.style.width = `${w}%`;
      fill.style.left = `${k >= 0 ? 50 : 50 - w}%`;
      fill.classList.toggle('bg-accent', k >= 0);
      fill.classList.toggle('bg-ink-faint', k < 0);
      said.textContent = Math.abs(k) < 0.15 ? 'no opinion yet' : k > 0 ? 'into it' : 'not into it';
    });
  }

  /** Light up the flavors the last swipe moved. */
  function glow(keys: string[]) {
    clearTimeout(glowTimer);
    for (const r of rows) {
      const on = keys.includes(r.key);
      r.label.classList.toggle('text-ink', on);
      r.label.classList.toggle('font-semibold', on);
      r.label.classList.toggle('text-ink-soft', !on);
      r.fill.classList.toggle('ring-2', on);
      r.fill.classList.toggle('ring-accent/30', on);
    }
    if (keys.length) glowTimer = window.setTimeout(() => glow([]), GLOW_MS);
  }

  resetStory();

  return {
    render(atSummary = false) {
      renderProgress(atSummary);
      renderWhy();
      renderNext();
      renderTaste();
    },
    /** Remember the model as it is now: call just before a swipe. */
    snapshot() {
      before = {
        weights: feed.learned().map((f) => f.weight),
        order: feed.upNext(Infinity).map((r) => r.item.slug),
      };
    },
    /** Say what the swipe just did (call after it, before render). */
    tell,
    /** Back to "nothing yet", for a fresh session. */
    reset: resetStory,
  };
}
