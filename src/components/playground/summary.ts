// The end-of-session card: your taste in a few emoji, the session at a glance
// (each clip, and whether the model called it), what you should order, and what
// a feed that paid for taps would have picked instead.

import type { PlaygroundCard } from '../../data/dishes';
import type { Feed, FeedItem } from '../../lib/feed';
import { summarize } from '../../lib/taste';
import { el, pct } from './dom';

export function buildSummary(
  feed: Feed,
  items: readonly FeedItem[],
  bySlug: Map<string, PlaygroundCard>,
  h: { onKeepSwiping: (() => void) | null; onStartOver: () => void },
): HTMLElement {
  const s = summarize(feed, items);
  const box = el(
    'div',
    'absolute inset-0 flex flex-col overflow-y-auto rounded-[1.5rem] border border-line bg-chip p-6 shadow-[0_24px_50px_-28px_rgba(25,24,23,0.45)]',
  );
  box.setAttribute('role', 'region');
  box.setAttribute('aria-label', 'What the model learned about you');
  box.append(
    el('p', 'eyebrow', h.onKeepSwiping ? `After ${feed.swipes} clips` : 'You’ve seen every dish'),
    el('h3', 'mt-2 font-serif text-2xl leading-tight text-ink', 'Here’s your taste.'),
  );

  // What you're into, big; what you're not, small.
  const loves = el('ul', 'mt-4 flex flex-wrap gap-x-5 gap-y-3');
  for (const f of s.loves) {
    const li = el('li', 'flex flex-col items-center gap-1');
    li.append(
      el('span', 'text-4xl leading-none', f.emoji),
      el('span', 'text-[0.75rem] text-ink-soft', f.label),
    );
    loves.append(li);
  }
  if (s.loves.length) box.append(loves);
  else
    box.append(
      el(
        'p',
        'mt-4 text-sm text-ink-soft',
        s.into
          ? 'Not sure yet. ❤️ or linger on a few more and it’ll come into focus.'
          : 'You didn’t ❤️ or linger on anything, so all it knows is what you skip.',
      ),
    );
  if (s.skips.length)
    box.append(
      el(
        'p',
        'mt-3 text-[0.85rem] text-ink-soft',
        `Not so much: ${s.skips.map((f) => f.emoji).join(' ')}`,
      ),
    );

  // The session at a glance: every clip, underlined by whether the guess was right.
  const a = s.accuracy;
  const recap = el('div', 'mt-5');
  const strip = el('ol', 'flex gap-1');
  for (const r of feed.log.slice(0, 10)) {
    const c = bySlug.get(r.slug)!;
    const li = el('li', 'min-w-0 flex-1');
    const img = el('img', 'aspect-square w-full rounded-md object-cover');
    img.src = c.thumb;
    img.alt = '';
    const mark = r.correct === null ? 'bg-ink-faint/40' : r.correct ? 'bg-accent' : 'bg-ink-faint';
    li.title = `${c.bait ? 'Clickbait post' : c.name}: ${
      r.correct === null ? 'it had no idea' : r.correct ? 'guessed right' : 'guessed wrong'
    }`;
    li.append(img, el('span', `mt-1 block h-1 rounded-full ${mark}`));
    strip.append(li);
  }
  strip.setAttribute('aria-hidden', 'true');
  recap.append(strip);
  if (a.total)
    recap.append(
      el(
        'p',
        'mt-2 text-[0.8rem] text-ink-soft',
        `Its guesses: ${a.right} of ${a.total} right. Always guessing your usual: ${Math.round(a.baseline * a.total)}.`,
      ),
    );
  box.append(recap);

  if (s.pick) {
    const c = bySlug.get(s.pick.item.slug)!;
    const order = el('div', 'mt-5 flex items-center gap-3 rounded-xl bg-paper-2 p-3');
    const img = el('img', 'h-14 w-14 shrink-0 rounded-lg object-cover');
    img.src = c.thumb;
    img.alt = '';
    const txt = el('div', 'min-w-0');
    // Below 50% it's not a confident call, just the best of what's left.
    const sure =
      s.pick.p >= 0.5 ? `${pct(s.pick.p)} sure you’d be into it` : 'Your best bet so far';
    const because = s.why.length
      ? ` · you’re into ${s.why.map((f) => `${f.emoji} ${f.label.toLowerCase()}`).join(' and ')}`
      : '';
    txt.append(
      el(
        'p',
        'text-[0.7rem] tracking-wider text-ink-faint uppercase',
        s.pick.again ? 'Order it again' : 'You should order',
      ),
      el('p', 'font-serif text-lg leading-tight text-ink', c.name),
      el('p', 'text-[0.75rem] text-ink-soft', sure + because),
    );
    order.append(img, txt);
    box.append(order);
  }

  // The what-if: the same models, but a value model that pays only for taps.
  if (s.ifTaps.length) {
    const what = el('div', 'mt-5');
    what.append(
      el('p', 'text-[0.8rem] text-ink', 'If this feed paid for taps, its top picks would be:'),
    );
    const row = el('ol', 'mt-2 grid grid-cols-3 gap-2');
    for (const r of s.ifTaps) {
      const c = bySlug.get(r.item.slug)!;
      const li = el('li', 'min-w-0');
      const img = el('img', 'aspect-[4/3] w-full rounded-md object-cover');
      img.src = c.thumb;
      img.alt = '';
      li.append(
        img,
        el(
          'span',
          `mt-1 block truncate text-[0.7rem] ${c.bait ? 'font-semibold text-ink' : 'text-ink-soft'}`,
          c.bait ? 'Clickbait' : c.name,
        ),
      );
      row.append(li);
    }
    what.append(
      row,
      el(
        'p',
        'mt-2 text-[0.75rem] text-ink-faint',
        'That’s why a tap only counts half here, and a ❤️ counts the most.',
      ),
    );
    box.append(what);
  }

  const btns = el('div', 'mt-auto flex gap-2 pt-5');
  const button = (label: string, primary: boolean, fn: () => void) => {
    const b = el(
      'button',
      primary
        ? 'flex-1 rounded-full border border-accent bg-accent px-3 py-2 text-sm text-paper hover:opacity-90'
        : 'flex-1 rounded-full border border-line bg-chip px-3 py-2 text-sm text-ink-soft hover:border-ink-faint hover:text-ink',
      label,
    );
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  };
  if (h.onKeepSwiping) btns.append(button('Keep swiping', true, h.onKeepSwiping));
  btns.append(button('Start over', !h.onKeepSwiping, h.onStartOver));
  box.append(btns);
  return box;
}
