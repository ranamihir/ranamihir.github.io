import { describe, expect, it } from 'vitest';
import {
  contours,
  DEFAULT_LR,
  grad,
  loss,
  makeBumps,
  MAX_STEP,
  step,
  type Ball,
  type Surface,
} from '../src/lib/descent';

/** Seeded PRNG (mulberry32), so the random terrains are the same every run. */
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 1.8;
const surfaceFor = (seed: number): Surface => {
  const rand = mulberry32(seed);
  return { min: { x: rand() * W, y: rand() }, bumps: makeBumps(rand, W) };
};

describe('loss and grad', () => {
  it('has its global minimum (zero) under the cursor', () => {
    const s = surfaceFor(1);
    expect(loss(s, s.min)).toBe(0);
    expect(grad(s, s.min)).toEqual({ x: 0, y: 0 });
  });

  it('matches a finite-difference gradient', () => {
    const rand = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const s = surfaceFor(i);
      const p = { x: rand() * W, y: rand() };
      const g = grad(s, p);
      const h = 1e-6;
      const nx = (loss(s, { x: p.x + h, y: p.y }) - loss(s, { x: p.x - h, y: p.y })) / (2 * h);
      const ny = (loss(s, { x: p.x, y: p.y + h }) - loss(s, { x: p.x, y: p.y - h })) / (2 * h);
      expect(g.x).toBeCloseTo(nx, 6);
      expect(g.y).toBeCloseTo(ny, 6);
    }
  });
});

describe('step', () => {
  const descend = (s: Surface, lr: number, steps: number): Ball => {
    const ball: Ball = { p: { x: 0.05, y: 0.05 }, v: { x: 0, y: 0 } };
    for (let i = 0; i < steps; i++) step(s, ball, lr, W);
    return ball;
  };

  it('reaches the cursor at the default learning rate, whatever the terrain', () => {
    for (let seed = 0; seed < 50; seed++) {
      const s = surfaceFor(seed);
      const { p } = descend(s, DEFAULT_LR, 300);
      expect(Math.hypot(p.x - s.min.x, p.y - s.min.y)).toBeLessThan(0.01);
    }
  });

  it('never moves more than MAX_STEP or leaves the box, even when diverging', () => {
    const s = surfaceFor(3);
    const ball: Ball = { p: { x: 0.5, y: 0.5 }, v: { x: 0, y: 0 } };
    for (let i = 0; i < 500; i++) {
      const before = ball.p;
      step(s, ball, 100, W);
      expect(Math.hypot(ball.p.x - before.x, ball.p.y - before.y)).toBeLessThanOrEqual(
        MAX_STEP + 1e-12,
      );
      expect(ball.p.x).toBeGreaterThanOrEqual(0);
      expect(ball.p.x).toBeLessThanOrEqual(W);
      expect(ball.p.y).toBeGreaterThanOrEqual(0);
      expect(ball.p.y).toBeLessThanOrEqual(1);
    }
    // ...and it doesn't settle.
    expect(Math.hypot(ball.v.x, ball.v.y)).toBeGreaterThan(1e-3);
  });
});

describe('contours', () => {
  it('traces a closed ring around a single peak', () => {
    // 3×3 cells, one high sample in the middle of a 4×4 grid → a level-0.5 ring.
    const field = [0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0];
    const [segs] = contours(field, 3, 3, [0.5]);
    expect(segs.length % 4).toBe(0);
    expect(segs.length / 4).toBe(8);
    // Every endpoint is shared by exactly two segments: the ring is closed.
    const key = (x: number, y: number) => `${x.toFixed(6)},${y.toFixed(6)}`;
    const counts = new Map<string, number>();
    for (let i = 0; i < segs.length; i += 2)
      counts.set(key(segs[i], segs[i + 1]), (counts.get(key(segs[i], segs[i + 1])) ?? 0) + 1);
    expect([...counts.values()].every((c) => c === 2)).toBe(true);
  });

  it('draws nothing for a level outside the field', () => {
    expect(contours([0, 0, 0, 0], 1, 1, [1])).toEqual([[]]);
  });
});
