// "Train your own feed", client side: wires the feed model (src/lib/feed.ts)
// to the card, the gestures, and the dashboard. The page section is a
// launcher; the game runs in a full-window <dialog>, Reels-style: swipe up (or
// ↓, or scroll) for the next clip, down (↑) to go back; ❤️ or double-tap to
// like; tap for details. ✕, Esc, or the browser's Back button exits.
// Everything runs in the browser; nothing is stored or sent.

import type { PlaygroundCard } from '../../data/dishes';
import { createFeed, SESSION, UNSURE, type Visit } from '../../lib/feed';
import { createWatchTimer } from '../../lib/watch';
import { buildCard, type CardView } from './card';
import { createDashboard } from './dashboard';
import { $, EASE_OUT, el, pct } from './dom';
import { attachGestures, attachWheel, type Direction } from './gestures';
import { buildSummary } from './summary';

/** Clip length to assume until the video's metadata arrives. */
const DEFAULT_CLIP_S = 6;
/** While the game is open, the URL carries this, so Back closes it instead of leaving. */
const HASH = '#play';

export function initPlayground() {
  const root = $('pg');
  const data = $('playground-data');
  const dialog = $<HTMLDialogElement>('pg-game');
  if (!root || !data || !dialog) return;
  const game: HTMLDialogElement = dialog;
  root.hidden = false;

  const cards = JSON.parse(data.textContent!) as PlaygroundCard[];
  const bySlug = new Map(cards.map((c) => [c.slug, c]));
  const items = cards.map((c) => ({ slug: c.slug, x: c.x, bait: !!c.bait }));
  const feed = createFeed(items);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** At this width the dashboard sits beside the clip instead of in a sheet. */
  const desktop = window.matchMedia('(min-width: 64rem)');
  const dashboard = createDashboard(feed, bySlug, reduced);

  const center = $('pg-center')!;
  const slot = $('pg-slot')!;
  const guessEl = $('pg-guess')!;
  const backdrop = $<HTMLImageElement>('pg-backdrop')!;
  const backBtn = $<HTMLButtonElement>('pg-back-btn')!;
  const nextBtn = $<HTMLButtonElement>('pg-next-btn')!;
  const sheet = $('pg-sheet')!;
  const sheetBtn = $<HTMLButtonElement>('pg-sheet-btn')!;
  const scrim = $('pg-scrim')!;
  const coach = $('pg-start');
  const launch = $('pg-launch')!;
  const launchCover = $('pg-launch-cover')!;
  const playBtn = $<HTMLButtonElement>('pg-play')!;

  // ---- state --------------------------------------------------------------
  let isOpen = false;
  let started = false; // dismissed the how-to: nothing plays or counts before that
  let userPlay = false; // reduced motion / blocked autoplay: the visitor pressed play
  let busy = false; // mid-transition
  let view: CardView | null = null;
  let gestures: { cancel: () => void } | null = null;
  let liked = false;
  let opened = false;
  let detailsShown = false;
  let sheetOpen = false;
  let summaryShown = false; // the session summary has appeared once
  let atSummary = false; // ...and it's what's on screen right now
  /** Whether closing should step back past our #play history entry. */
  let ownEntry = false;
  /** We've asked the browser to go back and are waiting for popstate: don't go back twice. */
  let popping = false;
  const timer = createWatchTimer();
  let ticker: number | undefined;

  const clipLen = () => {
    const d = view?.video.duration;
    return d && Number.isFinite(d) ? d : DEFAULT_CLIP_S;
  };
  const render = () => {
    renderGuess();
    dashboard.render(atSummary);
    updateNav();
  };
  function updateNav() {
    backBtn.disabled = !started || !view || !feed.canGoBack;
    nextBtn.disabled = !started || !view;
  }

  // ---- playback -----------------------------------------------------------
  // The clip plays only while the game is open and visible, after the how-to,
  // with details and the dashboard sheet closed. Watch time counts only while
  // it's really playing.
  function syncPlayback() {
    const v = view?.video;
    if (!v) return;
    const covered = detailsShown || (sheetOpen && !desktop.matches);
    const play =
      isOpen && started && !document.hidden && !covered && !busy && (!reduced || userPlay);
    if (play && v.paused) v.play().catch(() => view?.showPlay());
    else if (!play && !v.paused) v.pause();
  }
  document.addEventListener('visibilitychange', syncPlayback);

  // On desktop the clip keeps looping while you read the panel beside it; that
  // isn't watching, so the watch timer pauses while you're moving the mouse over
  // the panel or scrolling it. (Only while active: a mouse parked there while you
  // swipe with the keyboard isn't reading.)
  const READING_IDLE_MS = 2500;
  let reading = false;
  let readingIdle: number | undefined;
  function stopReading() {
    clearTimeout(readingIdle);
    if (!reading) return;
    reading = false;
    const v = view?.video;
    if (v && !v.paused) timer.start(v.currentTime);
  }
  function onPanelActivity(e: PointerEvent | WheelEvent) {
    if (!desktop.matches || ('pointerType' in e && e.pointerType !== 'mouse')) return;
    if (!reading) {
      reading = true;
      const v = view?.video;
      if (v && timer.running) timer.stop(v.currentTime, clipLen());
    }
    clearTimeout(readingIdle);
    readingIdle = window.setTimeout(stopReading, READING_IDLE_MS);
  }
  sheet.addEventListener('pointermove', onPanelActivity);
  sheet.addEventListener('wheel', onPanelActivity, { passive: true });
  sheet.addEventListener('pointerleave', stopReading);

  function watchVideo(v: HTMLVideoElement) {
    v.addEventListener('playing', () => {
      if (!reading) timer.start(v.currentTime);
      view?.hidePlay();
      ticker ??= window.setInterval(() => timer.sample(v.currentTime, clipLen()), 100);
    });
    const stop = () => {
      timer.stop(v.currentTime, clipLen());
      clearInterval(ticker);
      ticker = undefined;
    };
    v.addEventListener('pause', stop);
    v.addEventListener('waiting', stop);
  }

  // ---- the card -----------------------------------------------------------
  function setLiked(v: boolean, pop = false) {
    if (!started || !view || busy) return;
    liked = v;
    view.paintLike(liked);
    if (pop) view.pop();
  }

  function toggleDetails() {
    if (!started || !view || busy) return;
    detailsShown = !detailsShown;
    opened ||= detailsShown; // once opened, it counts for this visit
    view.paintDetails(detailsShown);
    syncPlayback(); // the clip pauses while details are up
  }

  /** Show the feed's current card, sliding in from the side it came from. */
  function showCard(from?: Direction) {
    const cur = feed.current;
    clearInterval(ticker);
    ticker = undefined;
    timer.reset();
    opened = false;
    detailsShown = false;
    atSummary = false;
    slot.replaceChildren();
    view = null;
    liked = !!cur && !!feed.log.find((r) => r.slug === cur.slug)?.labels.like;
    if (!cur) return;
    const c = bySlug.get(cur.slug)!;
    backdrop.src = c.poster;
    view = buildCard(
      c,
      {
        onLike: () => setLiked(!liked),
        onDetails: toggleDetails,
        onPlay: () => {
          userPlay = true;
          syncPlayback();
        },
      },
      { reduced, preload: started ? 'auto' : 'metadata' },
    );
    if (reduced && !userPlay) view.showPlay();
    if (liked) view.paintLike(true);
    watchVideo(view.video);
    gestures = attachGestures(
      view.el,
      {
        enabled: () => started && !busy,
        canGoBack: () => feed.canGoBack,
        onSwipe: go,
        onTap: toggleDetails,
        onDoubleTap: () => setLiked(true, true),
      },
      reduced,
    );
    view.el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleDetails();
      }
    });
    slot.append(view.el);
    if (from && !reduced)
      view.el.animate(
        [
          { transform: `translateY(${from === 'next' ? 35 : -35}%)`, opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 300, easing: EASE_OUT },
      );
    syncPlayback();
    if (started) prefetch();
  }

  // Start buffering the likely next clips (detached, muted, never played).
  const warm = new Map<string, HTMLVideoElement>();
  function prefetch(slugs = feed.upNext(2).map((r) => r.item.slug)) {
    const want = new Set(slugs);
    for (const [slug, v] of warm)
      if (!want.has(slug)) {
        v.removeAttribute('src');
        v.load();
        warm.delete(slug);
      }
    for (const slug of want) {
      if (warm.has(slug)) continue;
      const c = bySlug.get(slug)!;
      const v = document.createElement('video');
      v.muted = true;
      v.preload = 'auto';
      v.src = c.video;
      warm.set(slug, v);
      new Image().src = c.poster;
    }
  }

  // ---- moving between clips -------------------------------------------------
  /** Leave the current clip for the next one (or back to the previous one). */
  function go(dir: Direction) {
    if (!isOpen || !started || busy || !view || !feed.current) return;
    if (dir === 'back' && !feed.canGoBack) return;
    endNudges();
    const leaving = feed.current;
    const v = view.video;
    if (timer.running) timer.sample(v.currentTime, clipLen());
    const input = { liked, watchedSec: timer.seconds, clipSec: clipLen(), opened };
    dashboard.snapshot();
    const visit = dir === 'next' ? feed.next(input) : feed.back(input);
    busy = true;
    gestures?.cancel();
    v.pause();

    const out = view.el;
    view = null;
    const due =
      dir === 'next' &&
      (!feed.current || (feed.swipes >= SESSION && !summaryShown && !feed.revisiting));
    const arrive = () => {
      busy = false;
      dashboard.tell({ slug: leaving.slug, visit, dir });
      if (visit) announce(leaving.slug, visit);
      if (due) showSummary();
      else showCard(dir);
      render();
    };
    if (reduced) return arrive();
    out.style.transition = 'transform 0.28s cubic-bezier(0.4, 0, 1, 1), opacity 0.28s ease-in';
    out.style.transform = `translateY(${dir === 'next' ? -110 : 110}%)`;
    out.style.opacity = '0';
    window.setTimeout(arrive, 260);
  }

  const live = el('p', 'sr-only');
  live.setAttribute('aria-live', 'polite');
  game.append(live);
  function announce(slug: string, { record: r, revisit }: Visit) {
    const c = bySlug.get(slug)!;
    const name = (x: PlaygroundCard) => (x.bait ? 'a clickbait post' : x.name);
    const did = r.labels.like ? 'Liked' : r.labels.watch ? 'Watched' : 'Skipped';
    const nxt = feed.current ? bySlug.get(feed.current.slug)! : null;
    live.textContent =
      `${did} ${name(c)}. ` +
      (revisit ? '' : `The model had guessed ${pct(r.guess)} that you’d be into it. `) +
      (nxt
        ? `Now: ${name(nxt)}, ${pct(feed.interest(feed.current!))} sure you’ll be into it.`
        : '');
  }

  // ---- the model's guess, as a pill on the clip ------------------------------
  function renderGuess() {
    const cur = feed.current;
    guessEl.hidden = !cur || !view || atSummary;
    if (guessEl.hidden) return;
    // Its guess: will you ❤️ it or keep watching? (The story says how it went.)
    const p = feed.interest(cur!);
    const sure = Math.abs(p - 0.5) >= UNSURE;
    guessEl.textContent = feed.onTrial
      ? 'Trial view'
      : feed.revisiting
        ? 'Seen before'
        : !sure
          ? 'No idea yet'
          : p > 0.5
            ? `${pct(p)} sure you’re into it`
            : `${pct(1 - p)} sure you’ll scroll past`;
  }

  // ---- summary ------------------------------------------------------------
  function keepSwiping() {
    showCard('next');
    render();
    view?.el.focus({ preventScroll: true });
  }

  function showSummary() {
    summaryShown = true;
    atSummary = true;
    view = null;
    const box = buildSummary(feed, items, bySlug, {
      onKeepSwiping: feed.current ? keepSwiping : null,
      onStartOver: restart,
    });
    slot.replaceChildren(box);
    if (!reduced)
      box.animate(
        [
          { opacity: 0, transform: 'scale(0.97)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 350, easing: EASE_OUT },
      );
    box.querySelector('button')?.focus({ preventScroll: true });
  }

  function restart() {
    feed.reset();
    dashboard.reset();
    summaryShown = false;
    atSummary = false;
    if (isOpen) {
      showCard();
      render();
      view?.el.focus({ preventScroll: true });
    } else {
      slot.replaceChildren();
      view = null;
      renderLauncher();
    }
  }

  // ---- the launcher (in the page) -------------------------------------------
  function renderLauncher() {
    launch.querySelector('[data-summary]')?.remove();
    if (atSummary) {
      // Finished a session and left: the summary waits here.
      const box = buildSummary(feed, items, bySlug, {
        onKeepSwiping: feed.current
          ? () => {
              keepSwiping();
              openGame();
            }
          : null,
        onStartOver: () => {
          restart();
          openGame();
        },
      });
      box.dataset.summary = '';
      launchCover.hidden = true;
      launch.append(box);
      return;
    }
    launchCover.hidden = false;
    const touched = started || feed.swipes > 0;
    $('pg-launch-title')!.textContent = touched
      ? 'Pick up where you left off?'
      : 'Ready to train your feed?';
    $('pg-launch-sub')!.textContent = touched
      ? `${feed.swipes} clip${feed.swipes === 1 ? '' : 's'} in. The model still remembers what you like.`
      : '10 short clips. The model learns from everything you do.';
    $('pg-play-label')!.textContent = touched ? 'Resume' : 'Play';
    $('pg-restart')!.hidden = !touched;
  }

  // ---- opening and closing the game -----------------------------------------
  function show() {
    if (isOpen) return;
    isOpen = true;
    document.documentElement.classList.add('pg-lock');
    game.showModal();
    if (!view && !atSummary) showCard();
    syncSheet();
    render();
    if (!started) $('pg-start-btn')?.focus();
    else if (view) view.el.focus({ preventScroll: true });
    syncPlayback();
    if (started) prefetch();
    if (started) scheduleNudges();
  }

  /** Tear down the open game (the dialog may already be closed by the browser). */
  function hide() {
    if (!isOpen) return;
    isOpen = false;
    clearNudges();
    setSheet(false);
    syncPlayback();
    prefetch([]); // let go of buffered clips
    if (game.open) game.close();
    document.documentElement.classList.remove('pg-lock');
    renderLauncher();
    // The dialog hands focus back to whatever opened it, unless the summary now covers it.
    if (atSummary) launch.querySelector<HTMLElement>('[data-summary] button')?.focus();
  }

  /** Open from the Play button: add a #play history entry, so Back closes the game. */
  function openGame() {
    if (isOpen) return;
    history.pushState({ pg: 1 }, '', HASH);
    ownEntry = true;
    show();
  }

  /** ✕ or Esc: step back past our history entry (popstate does the closing), or just close. */
  function closeGame() {
    if (!isOpen) return;
    if (ownEntry && location.hash === HASH) {
      popping = true;
      history.back();
    } else {
      dropHash();
      hide();
    }
  }
  const dropHash = () => {
    if (location.hash === HASH)
      history.replaceState(history.state, '', location.pathname + location.search);
  };

  // Back/Forward, or a link to #play.
  const onLocation = () => {
    popping = false;
    if (location.hash === HASH && !isOpen) {
      ownEntry = true; // this entry came from a navigation within the page
      show();
    } else if (location.hash !== HASH && isOpen) hide();
  };
  window.addEventListener('popstate', onLocation);
  window.addEventListener('hashchange', onLocation);

  // Esc: close the sheet first, then the game.
  game.addEventListener('cancel', (e) => {
    e.preventDefault();
    if (sheetOpen && !desktop.matches) setSheet(false, true);
    else closeGame();
  });
  // The browser can close the dialog on its own (e.g. Android's back gesture).
  game.addEventListener('close', () => {
    if (!isOpen) return;
    const back = ownEntry && location.hash === HASH && !popping;
    if (!back && !popping) dropHash();
    hide();
    if (back) history.back();
  });
  $('pg-close')!.addEventListener('click', closeGame);
  playBtn.addEventListener('click', openGame);
  $('pg-restart')!.addEventListener('click', () => {
    restart();
    openGame();
  });

  // ---- the dashboard sheet (phones) ---------------------------------------
  function setSheet(open: boolean, refocus = false) {
    sheetOpen = open;
    sheet.classList.toggle('max-lg:translate-y-full', !open);
    scrim.hidden = !open;
    sheetBtn.setAttribute('aria-expanded', String(open));
    syncSheet();
    syncPlayback(); // the clip pauses while the sheet covers it
    if (open) $('pg-sheet-close')!.focus();
    else if (refocus) sheetBtn.focus();
  }
  /** Off-screen sheets stay out of the tab order; on desktop the panels are always live. */
  const syncSheet = () => {
    sheet.inert = !sheetOpen && !desktop.matches;
  };
  desktop.addEventListener('change', () => {
    syncSheet();
    syncPlayback();
  });
  sheetBtn.addEventListener('click', () => setSheet(true));
  $('pg-sheet-close')!.addEventListener('click', () => setSheet(false, true));
  scrim.addEventListener('click', () => setSheet(false, true));

  // ---- controls -----------------------------------------------------------
  backBtn.addEventListener('click', () => go('back'));
  nextBtn.addEventListener('click', () => go('next'));
  attachWheel(center, {
    enabled: () => started && !busy && !!view,
    canGoBack: () => feed.canGoBack,
    onSwipe: go,
  });
  const NEXT = new Set(['ArrowDown', 'ArrowRight', 'PageDown', 'j']);
  const BACK = new Set(['ArrowUp', 'ArrowLeft', 'PageUp', 'k']);
  game.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('a')) return;
    if (e.metaKey || e.ctrlKey || e.altKey || (sheetOpen && !desktop.matches)) return;
    if (NEXT.has(e.key)) go('next');
    else if (BACK.has(e.key)) go('back');
    else if (e.key === 'l' || e.key === 'L') setLiked(!liked);
    else return;
    e.preventDefault();
  });

  // ---- the nudge: a reminder to move on, first clip only ------------------------
  // If you linger on the first clip without moving on, the card peeks upward
  // (as if the next clip were underneath) with a "Swipe up" label, twice at
  // most. The first move ends it for good.
  const NUDGE_AT_MS = [4000, 11000];
  const nudgeEl = $('pg-nudge')!;
  let nudged = false; // moved on at least once: no more nudges, ever
  let nudgeTimers: number[] = [];
  let nudgeAnims: Animation[] = [];

  function scheduleNudges() {
    clearNudges();
    if (nudged || feed.swipes > 0) return;
    nudgeTimers = NUDGE_AT_MS.map((ms) => window.setTimeout(nudge, ms));
  }
  function clearNudges() {
    nudgeTimers.forEach(clearTimeout);
    nudgeTimers = [];
    stopNudgeAnims();
  }
  function stopNudgeAnims() {
    nudgeAnims.forEach((a) => a.cancel());
    nudgeAnims = [];
  }
  function endNudges() {
    nudged = true;
    clearNudges();
  }
  function nudge() {
    const covered = detailsShown || (sheetOpen && !desktop.matches);
    if (nudged || !isOpen || busy || !view || covered || document.hidden) return;
    stopNudgeAnims();
    const label = nudgeEl.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }],
      { duration: reduced ? 3500 : 2600 },
    );
    nudgeAnims.push(label);
    if (reduced) return; // the label alone: no bouncing
    nudgeAnims.push(
      view.el.animate(
        [
          { transform: 'none' },
          { transform: 'translateY(-7%)', offset: 0.35 },
          { transform: 'translateY(1%)', offset: 0.7 },
          { transform: 'none' },
        ],
        { duration: 900, iterations: 2, easing: 'ease-in-out' },
      ),
    );
  }
  // Grabbing the card mid-peek: stop the animation so the drag follows your finger.
  slot.addEventListener('pointerdown', stopNudgeAnims, true);

  // ---- the how-to, first time only --------------------------------------------
  function start() {
    if (started) return;
    started = true;
    userPlay = true; // an explicit tap: lets the clip play under reduced motion too
    timer.reset();
    if (view) view.video.preload = 'auto';
    if (coach) {
      const remove = () => coach.remove();
      if (reduced) remove();
      else
        coach
          .animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, easing: 'ease-out' })
          .finished.then(remove);
    }
    updateNav();
    view?.el.focus({ preventScroll: true });
    syncPlayback();
    prefetch();
    scheduleNudges();
  }
  coach?.addEventListener('click', start);
  $('pg-start-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    start();
  });

  renderLauncher();
  // A link straight to the game (/#play).
  if (location.hash === HASH) {
    ownEntry = false; // nothing of ours to step back past: closing just drops the hash
    show();
  }
}
