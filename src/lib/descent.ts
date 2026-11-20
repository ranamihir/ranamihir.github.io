// Gradient descent behind the hero: a ball rolls downhill on a loss surface
// whose global minimum follows the cursor. Pure math with no DOM access (the
// canvas lives in src/components/Descent.astro), so it can be unit-tested.
//
// Coordinates are in units of the hero's height: y ∈ [0, 1], x ∈ [0, aspect].
// The surface is a log-bowl centred on the minimum, which flattens far away so
// a few random hills and shallow pits can bend the ball's path.

export interface Vec {
  x: number;
  y: number;
}

/** A Gaussian hill (h > 0) or pit (h < 0) at (x, y) with width s. */
export interface Bump extends Vec {
  h: number;
  s: number;
}

export interface Surface {
  min: Vec;
  bumps: Bump[];
}

export interface Ball {
  p: Vec;
  v: Vec;
  /** Closest the ball has come to the minimum since its last kick. */
  best?: number;
  /** Steps since `best` last improved. */
  stuck?: number;
  /** Kicks since the ball last reached the minimum; each flattens the bumps it feels. */
  kicks?: number;
}

/** Optimizer steps per second. Rendering interpolates between steps, so an
 * unstable learning rate reads as a visible zigzag rather than a flicker. */
export const STEPS_PER_SECOND = 30;
/** Default learning rate (≈2 s to converge); the terminal's `lr` command changes it.
 * Around 0.3 it starts to wobble; from 1 up it diverges. */
export const DEFAULT_LR = 0.03;
/** Heavy-ball momentum. */
export const MOMENTUM = 0.85;
/** Largest move per step (hero heights): gradient clipping keeps big learning rates on screen. */
export const MAX_STEP = 0.06;
/** How far past the edges of the box the ball may roll (hero heights). */
export const EDGE = 0.25;
/** Steps without getting closer to the minimum before a kick (~1 s). */
export const STUCK_STEPS = 30;
/** Accepted range for `lr`. */
export const LR_RANGE = [1e-5, 100] as const;
/** Fired on document with the new learning rate in `detail`. */
export const LR_EVENT = 'descent:lr';
/** Screens wide enough to run it (Tailwind's md). Phones get a still hero: less motion and battery. */
export const DESCENT_MEDIA = '(min-width: 48rem)';

const BOWL_DEPTH = 0.3;
const BOWL_R2 = 0.35 ** 2;
const KICK = 0.03;

// Bumps fade out near the minimum (weight m = d² / (d² + ρ²)), so the global
// minimum sits exactly under the cursor; far away they bend the ball's path.
const FADE_R2 = 0.25 ** 2;

function bumpSum(bumps: Bump[], p: Vec): { f: number; gx: number; gy: number } {
  let f = 0;
  let gx = 0;
  let gy = 0;
  for (const b of bumps) {
    const bx = p.x - b.x;
    const by = p.y - b.y;
    const s2 = b.s * b.s;
    const e = b.h * Math.exp(-(bx * bx + by * by) / (2 * s2));
    f += e;
    gx -= (e * bx) / s2;
    gy -= (e * by) / s2;
  }
  return { f, gx, gy };
}

export function loss({ min, bumps }: Surface, p: Vec): number {
  const dx = p.x - min.x;
  const dy = p.y - min.y;
  const d2 = dx * dx + dy * dy;
  return BOWL_DEPTH * Math.log1p(d2 / BOWL_R2) + (d2 / (d2 + FADE_R2)) * bumpSum(bumps, p).f;
}

/** `bumpScale` < 1 flattens the hills and pits (see the kick in `step`). */
export function grad({ min, bumps }: Surface, p: Vec, bumpScale = 1): Vec {
  const dx = p.x - min.x;
  const dy = p.y - min.y;
  const d2 = dx * dx + dy * dy;
  const bowl = (2 * BOWL_DEPTH) / (BOWL_R2 + d2);
  const m = (bumpScale * d2) / (d2 + FADE_R2);
  const dm = (bumpScale * 2 * FADE_R2) / (d2 + FADE_R2) ** 2; // ∇m = dm · (p − min)
  const B = bumpSum(bumps, p);
  return {
    x: bowl * dx + m * B.gx + B.f * dm * dx,
    y: bowl * dy + m * B.gy + B.f * dm * dy,
  };
}

/**
 * One step of gradient descent with momentum (in place). The move is clipped
 * to MAX_STEP, and the ball stays within EDGE of the [0, w] × [0, 1] box.
 */
export function step(surface: Surface, ball: Ball, lr: number, w: number): void {
  const g = grad(surface, ball.p, 1 / (1 + (ball.kicks ?? 0)));
  let vx = MOMENTUM * ball.v.x - lr * g.x;
  let vy = MOMENTUM * ball.v.y - lr * g.y;
  const speed = Math.hypot(vx, vy);
  if (!Number.isFinite(speed)) {
    vx = vy = 0;
  } else if (speed > MAX_STEP) {
    vx *= MAX_STEP / speed;
    vy *= MAX_STEP / speed;
  }
  // No walls (a wall plus a couple of hills can form a pocket); the ball may
  // drift a little past the edges and the bowl brings it back.
  const p = {
    x: Math.min(w + EDGE, Math.max(-EDGE, ball.p.x + vx)),
    y: Math.min(1 + EDGE, Math.max(-EDGE, ball.p.y + vy)),
  };

  // Rarely, hills ring a pocket and the ball settles (or circles) in it. Real
  // optimizers escape with noise; this one has patience, like early stopping:
  // no progress toward the minimum for STUCK_STEPS, and it gets a kick toward
  // the cursor, and the bumps it feels flatten a little more each time
  // (annealing) until it gets there.
  const dx = surface.min.x - p.x;
  const dy = surface.min.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d <= 0.05) {
    ball.stuck = ball.kicks = 0;
    ball.best = d;
  } else if (d < (ball.best ?? Infinity)) {
    ball.best = d;
    ball.stuck = 0;
  } else if (++ball.stuck! >= STUCK_STEPS) {
    ball.kicks = (ball.kicks ?? 0) + 1;
    vx += (KICK * dx) / d;
    vy += (KICK * dy) / d;
    ball.stuck = 0;
    ball.best = d;
  }
  ball.p = p;
  ball.v = { x: vx, y: vy };
}

/** Scatter `n` hills and shallow pits over a w × 1 box; `rand` returns [0, 1). */
export function makeBumps(rand: () => number, w: number, n = 7): Bump[] {
  return Array.from({ length: n }, (_, i) => ({
    x: rand() * w,
    y: rand(),
    // Two in three are hills. Pits are shallow and wide: their pull never beats
    // the bowl's, so they bend the path without trapping the ball.
    h: i % 3 === 2 ? -(0.02 + 0.03 * rand()) : 0.08 + 0.12 * rand(),
    s: i % 3 === 2 ? 0.15 + 0.1 * rand() : 0.1 + 0.12 * rand(),
  }));
}

/** Contour levels: fixed, so the lines glide (rather than jump) as the minimum moves. */
export const LEVELS = Array.from({ length: 24 }, (_, i) => -0.06 + 0.06 * i);

/**
 * Marching squares. `field` holds (cols + 1) × (rows + 1) samples, row-major.
 * Returns, per level, a flat list of segments [x1, y1, x2, y2, …] in grid units.
 */
export function contours(
  field: ArrayLike<number>,
  cols: number,
  rows: number,
  levels: readonly number[],
): number[][] {
  const stride = cols + 1;
  // Edges: 0 top, 1 right, 2 bottom, 3 left. Corner bits: tl 8, tr 4, br 2, bl 1.
  const table: number[][] = [
    [],
    [3, 2],
    [2, 1],
    [3, 1],
    [0, 1],
    [0, 1, 3, 2],
    [0, 2],
    [0, 3],
    [0, 3],
    [0, 2],
    [0, 3, 2, 1],
    [0, 1],
    [3, 1],
    [1, 2],
    [3, 2],
    [],
  ];
  return levels.map((lv) => {
    const out: number[] = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const tl = field[j * stride + i];
        const tr = field[j * stride + i + 1];
        const br = field[(j + 1) * stride + i + 1];
        const bl = field[(j + 1) * stride + i];
        const edges =
          table[(tl > lv ? 8 : 0) | (tr > lv ? 4 : 0) | (br > lv ? 2 : 0) | (bl > lv ? 1 : 0)];
        for (const e of edges) {
          if (e === 0) out.push(i + (lv - tl) / (tr - tl), j);
          else if (e === 1) out.push(i + 1, j + (lv - tr) / (br - tr));
          else if (e === 2) out.push(i + (lv - bl) / (br - bl), j + 1);
          else out.push(i, j + (lv - tl) / (bl - tl));
        }
      }
    }
    return out;
  });
}
