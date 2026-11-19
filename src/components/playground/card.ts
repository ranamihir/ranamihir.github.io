// One card: the looping clip, the heart, the details overlay, and the credit.
// Builds the DOM and paints its state; main.ts owns what the state means.

import type { PlaygroundCard } from '../../data/dishes';
import { FEATURES } from '../../lib/feed';
import { EASE_OUT, el, heartSvg } from './dom';

export interface CardHandlers {
  onLike: () => void;
  onDetails: () => void;
  onPlay: () => void;
}

export interface CardView {
  el: HTMLElement;
  video: HTMLVideoElement;
  paintLike: (liked: boolean) => void;
  /** Instagram's big heart pop, for a double-tap. */
  pop: () => void;
  paintDetails: (open: boolean) => void;
  showPlay: () => void;
  hidePlay: () => void;
}

const RED = '#ff3040';
const CARD =
  'pg-card absolute inset-0 cursor-grab touch-none overflow-hidden rounded-[1.5rem] border border-line bg-paper-2 shadow-[0_24px_50px_-28px_rgba(25,24,23,0.55)] outline-offset-4 select-none active:cursor-grabbing';

/** Stops a control's pointerdown from starting a drag on the card underneath. */
const own = (e: Event) => e.stopPropagation();

export function buildCard(
  c: PlaygroundCard,
  h: CardHandlers,
  opts: { reduced: boolean; preload: 'auto' | 'metadata' },
): CardView {
  const art = el('article', CARD);
  art.tabIndex = 0;
  art.setAttribute('aria-roledescription', 'card');
  art.setAttribute(
    'aria-label',
    c.bait
      ? `Clickbait post from @${c.bait.handle}: ${c.bait.headline}`
      : `${c.name}, ${c.cuisine}. ${c.tags.join(', ')}`,
  );

  const v = el('video', 'pointer-events-none absolute inset-0 h-full w-full object-cover');
  v.muted = true;
  v.defaultMuted = true;
  v.loop = true;
  v.playsInline = true;
  v.preload = opts.preload;
  v.poster = c.poster;
  v.disablePictureInPicture = true;
  v.setAttribute('muted', '');
  v.setAttribute('playsinline', '');
  v.setAttribute('disableremoteplayback', '');
  v.setAttribute('aria-label', c.alt);
  v.src = c.video;
  art.append(
    v,
    el(
      'div',
      'absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-black/85 via-black/35 to-transparent',
    ),
  );

  // Heart (right edge), details (top right), and play (center, when autoplay is off).
  const heart = el(
    'button',
    'absolute right-3 bottom-16 z-10 grid h-12 w-12 place-items-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-transform hover:scale-110 active:scale-95',
  );
  heart.type = 'button';
  heart.setAttribute('aria-label', 'Like');
  heart.setAttribute('aria-pressed', 'false');
  const icon = heartSvg('h-7 w-7');
  const heartPath = icon.querySelector('path')!;
  heart.append(icon);

  const info = el(
    'button',
    'absolute top-3 right-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/45 font-serif text-base text-white italic backdrop-blur-sm hover:bg-black/65 aria-pressed:bg-white aria-pressed:text-black',
    'i',
  );
  info.type = 'button';
  info.setAttribute('aria-label', 'Details');
  info.setAttribute('aria-pressed', 'false');

  // Shown when autoplay is off (reduced motion) or blocked (e.g. Low Power Mode).
  const play = el(
    'button',
    'absolute top-1/2 left-1/2 hidden h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-2xl text-white backdrop-blur-sm hover:bg-black/70',
    '▶',
  );
  play.type = 'button';
  play.setAttribute('aria-label', 'Play clip');

  for (const [b, fn] of [
    [heart, h.onLike],
    [info, h.onDetails],
    [play, h.onPlay],
  ] as const) {
    b.addEventListener('pointerdown', own);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      fn();
    });
  }
  art.append(heart, info, play);

  const body = el('div', 'absolute inset-x-0 bottom-0 p-5 pr-18 pb-7 text-white');
  if (c.bait) {
    // Laid out like a creator's post: an avatar and a handle over the headline.
    const who = el('p', 'mb-3 flex items-center gap-2 text-sm font-semibold text-white');
    who.append(
      el(
        'span',
        'grid h-7 w-7 place-items-center rounded-full bg-[#ffe14d] text-xs font-black text-black uppercase',
        c.bait.handle[0],
      ),
      `@${c.bait.handle}`,
    );
    body.append(
      who,
      el(
        'h3',
        'font-sans text-[1.6rem] leading-[1.1] font-black tracking-tight text-[#ffe14d] [text-shadow:0_2px_12px_rgba(0,0,0,0.6)]',
        c.bait.headline,
      ),
    );
  } else {
    body.append(
      el('h3', 'font-serif text-[2rem] leading-tight text-white', c.name),
      el('p', 'mt-0.5 text-sm text-white/80', c.cuisine),
    );
    const tags = el('ul', 'mt-3 flex flex-wrap gap-1.5');
    for (const t of c.tags)
      tags.append(
        el(
          'li',
          'rounded-full bg-white/15 px-2 py-0.5 text-[0.75rem] text-white backdrop-blur-sm',
          t,
        ),
      );
    body.append(tags);
  }
  art.append(body);

  const credit = el(
    'a',
    'absolute right-3 bottom-1.5 max-w-[90%] truncate text-[0.6rem] text-white/55 hover:text-white',
    `Video: ${c.credit} · Pixabay`,
  );
  credit.href = c.source;
  credit.target = '_blank';
  credit.rel = 'noopener noreferrer';
  credit.addEventListener('pointerdown', own);
  art.append(credit);

  // Details: what a tap "opens".
  const details = el(
    'div',
    'pg-details pointer-events-none absolute inset-0 flex flex-col justify-end bg-black/75 p-6 text-white opacity-0 backdrop-blur-sm transition-opacity duration-300',
  );
  details.append(el('p', 'font-serif text-xl leading-snug', c.blurb));
  const feats = el('ul', 'mt-4 space-y-1 text-[0.8rem] text-white/85');
  FEATURES.forEach((f, i) => {
    if (c.x[i]) feats.append(el('li', '', `${f.emoji} ${f.label}${c.x[i] < 1 ? ' (a bit)' : ''}`));
  });
  details.append(
    feats,
    el('p', 'mt-5 text-[0.7rem] text-white/60', 'Opening a card is a signal too.'),
  );
  art.append(details);

  return {
    el: art,
    video: v,
    paintLike(liked) {
      heart.setAttribute('aria-pressed', String(liked));
      heartPath.setAttribute('fill', liked ? RED : 'none');
      heartPath.setAttribute('stroke', liked ? RED : 'currentColor');
      if (liked && !opts.reduced)
        heart.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }],
          { duration: 300, easing: EASE_OUT },
        );
    },
    pop() {
      if (opts.reduced) return;
      const big = heartSvg(
        'pointer-events-none absolute top-1/2 left-1/2 h-28 w-28 text-white drop-shadow-xl',
      );
      big.querySelector('path')!.setAttribute('fill', 'white');
      art.append(big);
      big
        .animate(
          [
            { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0 },
            { transform: 'translate(-50%, -50%) scale(1.1)', opacity: 0.95, offset: 0.35 },
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.95, offset: 0.7 },
            { transform: 'translate(-50%, -70%) scale(0.9)', opacity: 0 },
          ],
          { duration: 800, easing: EASE_OUT },
        )
        .finished.then(() => big.remove());
    },
    paintDetails(open) {
      details.classList.toggle('opacity-0', !open);
      details.classList.toggle('pointer-events-none', !open);
      info.setAttribute('aria-pressed', String(open));
    },
    showPlay() {
      play.classList.replace('hidden', 'grid');
    },
    hidePlay() {
      play.classList.replace('grid', 'hidden');
    },
  };
}
