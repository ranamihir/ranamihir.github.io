import { describe, expect, it } from 'vitest';
import { createWatchTimer } from '../src/lib/watch';

describe('createWatchTimer', () => {
  it('counts only time that passes while playing', () => {
    const w = createWatchTimer();
    w.sample(1, 6); // not started: ignored
    expect(w.seconds).toBe(0);
    w.start(0);
    w.sample(0.1, 6);
    w.sample(0.5, 6);
    w.stop(0.8, 6);
    expect(w.seconds).toBeCloseTo(0.8);
    expect(w.running).toBe(false);
    w.sample(2, 6); // stopped: ignored
    expect(w.seconds).toBeCloseTo(0.8);
  });

  it('sums across loops', () => {
    const w = createWatchTimer();
    w.start(5.8);
    w.sample(5.95, 6);
    w.sample(0.1, 6); // wrapped: 0.05 + 0.1
    expect(w.seconds).toBeCloseTo(0.3);
  });

  it('ignores seeks and stalls', () => {
    const w = createWatchTimer();
    w.start(0);
    w.sample(0.2, 6);
    w.sample(3, 6); // a jump of 2.8 s isn't playback
    w.sample(3.1, 6);
    expect(w.seconds).toBeCloseTo(0.3);
  });

  it('resets between cards', () => {
    const w = createWatchTimer();
    w.start(0);
    w.sample(0.5, 6);
    w.reset();
    expect(w.seconds).toBe(0);
    expect(w.running).toBe(false);
  });
});
