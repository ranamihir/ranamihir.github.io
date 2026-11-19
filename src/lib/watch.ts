// How much of a looping clip has actually played: summed across loops, and only
// while it's really playing (not paused, buffering, or off-screen). Pure, so it
// can be unit-tested; the playground feeds it the <video> element's position.

/** Jumps longer than this between samples are seeks or stalls, not playback. */
export const MAX_STEP_S = 1;

export function createWatchTimer() {
  let seconds = 0;
  /** Position at the last sample while playing; null while stopped. */
  let last: number | null = null;

  const advance = (t: number, duration: number) => {
    if (last === null) return;
    let d = t - last;
    if (d < 0 && duration > 0) d += duration; // looped back to the start
    if (d > 0 && d < MAX_STEP_S) seconds += d;
    last = t;
  };

  return {
    /** Playback (re)started at position `t`. */
    start(t: number) {
      last = t;
    },
    /** The clip is at `t` and still playing: count the time since the last sample. */
    sample(t: number, duration: number) {
      advance(t, duration);
    },
    /** Playback stopped at `t`: count the last stretch, then stop counting. */
    stop(t: number, duration: number) {
      advance(t, duration);
      last = null;
    },
    reset() {
      seconds = 0;
      last = null;
    },
    get seconds() {
      return seconds;
    },
    get running() {
      return last !== null;
    },
  };
}

export type WatchTimer = ReturnType<typeof createWatchTimer>;
