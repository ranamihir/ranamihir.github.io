// Reels-style gestures: drag a card up for the next clip, down to go back; one
// tap opens details, a double-tap likes. On desktop, the wheel (or a trackpad
// flick) moves one clip at a time. The game is full-window with page scrolling
// locked, so the card can claim every touch (touch-none) without a fight.

import { EASE_OUT } from './dom';

export type Direction = 'next' | 'back';

export interface GestureHandlers {
  /** False while the card shouldn't respond (before Start, mid-transition). */
  enabled: () => boolean;
  canGoBack: () => boolean;
  onSwipe: (dir: Direction) => void;
  onTap: () => void;
  onDoubleTap: () => void;
}

const DOUBLE_TAP_MS = 300;

export function attachGestures(art: HTMLElement, h: GestureHandlers, reduced: boolean) {
  let x0 = 0;
  let y0 = 0;
  let t0 = 0;
  let dy = 0;
  let id: number | null = null;
  let lastTap = 0;
  let tapTimer: number | undefined;

  const paint = () => {
    art.style.transform = dy ? `translateY(${dy}px)` : '';
  };

  art.addEventListener('pointerdown', (e) => {
    if (!h.enabled() || e.button !== 0) return;
    id = e.pointerId;
    x0 = e.clientX;
    y0 = e.clientY;
    t0 = performance.now();
    dy = 0;
    art.setPointerCapture(id);
    art.style.transition = 'none';
  });

  art.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    dy = e.clientY - y0;
    // Nothing above the first card: it resists being pulled down.
    if (dy > 0 && !h.canGoBack()) dy *= 0.25;
    paint();
  });

  const end = (e: PointerEvent, cancelled: boolean) => {
    if (e.pointerId !== id) return;
    id = null;
    const dt = performance.now() - t0;
    const moved = Math.hypot(e.clientX - x0, e.clientY - y0);
    const fast = Math.abs(dy) / Math.max(1, dt) > 0.5 && Math.abs(dy) > 40;
    const far = Math.abs(dy) > art.offsetHeight * 0.2;
    const dir: Direction = dy < 0 ? 'next' : 'back';
    if (!cancelled && (far || fast) && (dir === 'next' || h.canGoBack())) {
      h.onSwipe(dir);
      return;
    }
    art.style.transition = reduced ? 'none' : `transform 0.35s ${EASE_OUT}`;
    dy = 0;
    paint();
    if (!cancelled && moved < 6 && dt < 500) tap();
  };
  art.addEventListener('pointerup', (e) => end(e, false));
  art.addEventListener('pointercancel', (e) => end(e, true));

  function tap() {
    const now = performance.now();
    if (now - lastTap < DOUBLE_TAP_MS) {
      clearTimeout(tapTimer);
      lastTap = 0;
      h.onDoubleTap();
    } else {
      lastTap = now;
      tapTimer = window.setTimeout(h.onTap, DOUBLE_TAP_MS - 20);
    }
  }

  return {
    /** Forget a pending single tap (the card is going away). */
    cancel: () => clearTimeout(tapTimer),
  };
}

/** Scroll distance (px) that counts as one swipe. */
const WHEEL_STEP = 50;
/** A gesture ends once the wheel has been quiet this long (trackpads coast for a while). */
const WHEEL_QUIET_MS = 220;

/**
 * One clip per scroll gesture: the first WHEEL_STEP of scrolling moves, then
 * everything is ignored until the wheel goes quiet, so a trackpad flick and its
 * momentum tail move one clip, not five.
 */
export function attachWheel(
  el: HTMLElement,
  h: Pick<GestureHandlers, 'enabled' | 'canGoBack' | 'onSwipe'>,
) {
  let sum = 0;
  let spent = false;
  let quiet: number | undefined;
  el.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      clearTimeout(quiet);
      quiet = window.setTimeout(() => {
        sum = 0;
        spent = false;
      }, WHEEL_QUIET_MS);
      if (spent || !h.enabled()) return;
      sum += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (Math.abs(sum) < WHEEL_STEP) return;
      const dir: Direction = sum > 0 ? 'next' : 'back';
      spent = true;
      if (dir === 'next' || h.canGoBack()) h.onSwipe(dir);
    },
    { passive: false },
  );
}
