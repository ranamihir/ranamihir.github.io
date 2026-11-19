// "Train your own feed": a recommender small enough to watch think. Three tiny
// models predict what you'll do with each clip (heart it, keep watching it, tap
// it open); a value model turns those predictions into one score; the top score
// is the next card. Every card you leave is one gradient step for each model.
// Pure logic with no DOM access (the UI lives in src/components/Playground.astro).

export const FEATURES = [
  { key: 'meat', label: 'Meat', emoji: '🥩' },
  { key: 'seafood', label: 'Seafood', emoji: '🦐' },
  { key: 'veggie', label: 'Veggies', emoji: '🥦' },
  { key: 'spicy', label: 'Spicy', emoji: '🌶️' },
  { key: 'sweet', label: 'Sweet', emoji: '🍰' },
  { key: 'cheesy', label: 'Cheesy', emoji: '🧀' },
  { key: 'fried', label: 'Fried', emoji: '🍟' },
  { key: 'grilled', label: 'Grilled', emoji: '🔥' },
  { key: 'carbs', label: 'Carbs', emoji: '🍞' },
] as const;
export type FeatureKey = (typeof FEATURES)[number]['key'];

export const TASKS = ['like', 'watch', 'open'] as const;
export type Task = (typeof TASKS)[number];
export type Predictions = Record<Task, number>;

/**
 * The value model: how much each prediction counts toward a card's score (a
 * weighted sum). A ❤️ counts most: it's explicit, something you chose to do.
 * Watching still counts in full (on a feed like Reels most people never tap
 * anything); opening counts half: it's curiosity, and it's what clickbait
 * exploits. A feed that paid mostly for taps would fill up with clickbait.
 * (Simulations: tap weights above ~0.55 let bait win slots on its own.)
 */
export const WEIGHTS: Predictions = { like: 1.5, watch: 1, open: 0.5 };
/** The value model of a feed that's paid only for taps: what the summary's "what if" ranks with. */
export const TAP_WEIGHTS: Predictions = { like: 0, watch: 0, open: 1 };

/** Distinct cards before the "here's what I learned" summary. */
export const SESSION = 10;

// ---- watching ---------------------------------------------------------------
// "Kept watching" is relative to you: a clip counts as watched when it plays at
// least twice as long as your quick skips. Fast swipers still give a signal, and
// someone reading the dashboard while every clip loops doesn't count as watching
// everything. (Measured against your fastest watches rather than your average,
// so a feed full of things you love doesn't raise the bar on itself.)

/** Until there's enough history, watching this share of a clip counts... */
export const WATCH_SHARE = 0.75;
/** ...capped at this many seconds. */
export const WATCH_DEFAULT_S = 2;
/** Cards seen before your own pace kicks in. */
export const WATCH_HISTORY = 3;
/** Your quick-skip time: this quantile of your watch times so far. */
export const QUICK_QUANTILE = 0.25;
/** Watched = at least this many times your quick-skip time... */
export const WATCH_RELATIVE = 2;
/** ...and never less than this many seconds. */
export const WATCH_MIN_S = 1;

/** Linear-interpolated quantile, q in [0, 1]. */
export function quantile(xs: readonly number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo);
}

/** Seconds of playback that count as watching a clip, given your earlier watch times. */
export function watchThreshold(clipSec: number, history: readonly number[] = []): number {
  if (history.length < WATCH_HISTORY) return Math.min(WATCH_SHARE * clipSec, WATCH_DEFAULT_S);
  return Math.max(WATCH_MIN_S, WATCH_RELATIVE * quantile(history, QUICK_QUANTILE));
}

// ---- model constants --------------------------------------------------------

export const LEARNING_RATE = 0.5;
/** Weight decay, so a single swipe can't pin a weight forever. */
export const L2 = 0.01;
/** Prior log-odds of tapping a card open (most people don't): σ(−1) ≈ 27%. */
export const OPEN_PRIOR = -1;
/**
 * Prior log-odds of a ❤️, and of watching through: about 29% each, picked so a
 * fresh model's p(into it) = 1 − (1 − p)² is exactly 50%. It starts with no idea.
 */
export const INTO_PRIOR = Math.log((1 - Math.SQRT1_2) / Math.SQRT1_2);
/**
 * Clickbait's effect on each prediction, in log-odds. In a real feed this comes
 * from an integrity classifier and is learned from everyone, so it's known
 * before your first swipe: bait gets tapped (+3), but people rarely ❤️ it or
 * stick around (−2). (And skipping it doesn't count against the dish underneath:
 * see `teaches` in createFeed.)
 */
export const BAIT_PRIOR: Predictions = { like: -2, watch: -2, open: 3 };
/** Clickbait joins the pool after this many cards, once the model has something to go on. */
export const BAIT_AFTER = 3;
/**
 * The trial slot: if no clickbait has come up by this card (0-based), the
 * best-scoring clickbait post gets one trial view anyway. Real feeds show new
 * posts to a few people to learn how they land, even posts the models doubt.
 * With a value model that pays for ❤️s and watching, bait would otherwise
 * almost never win a slot on its own (under 1 session in 10 in simulations), and
 * the quality filter would never get a chance to step in.
 */
export const TRIAL_AT = 4;
/** Once the quality filter is on, clickbait loses this much score. */
export const QUALITY_PENALTY = 1.5;
/**
 * How much novelty counts. Without it the feed can lock onto your first ❤️:
 * in simulations it sometimes never showed a grilled-food fan anything grilled.
 */
export const EXPLORE = 0.25;
/** Predictions this close to 50% are "not sure yet" and don't count toward accuracy. */
export const UNSURE = 0.05;

export interface FeedItem {
  slug: string;
  /** Feature vector, in FEATURES order. */
  x: number[];
  bait: boolean;
}

export const toVector = (f: Partial<Record<FeatureKey, number>>): number[] =>
  FEATURES.map(({ key }) => f[key] ?? 0);

// ---- logistic regression ----------------------------------------------------

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

export interface Model {
  w: number[];
  b: number;
}

export const newModel = (b = 0): Model => ({ w: FEATURES.map(() => 0), b });

export const predict = (m: Model, x: number[], offset = 0) => sigmoid(dot(m.w, x) + m.b + offset);

/** One step of gradient descent on log loss (in place). */
export function update(m: Model, x: number[], y: number, offset = 0, lr = LEARNING_RATE): void {
  const g = predict(m, x, offset) - y;
  m.w = m.w.map((w, i) => w - lr * (g * x[i] + L2 * w));
  m.b -= lr * g;
}

/** Into it: a ❤️ or watching through. P(either), treating the two as independent. */
export const intoFrom = (p: Pick<Predictions, 'like' | 'watch'>) =>
  1 - (1 - p.like) * (1 - p.watch);

// ---- the feed ---------------------------------------------------------------

export interface Score {
  p: Predictions;
  /** Each prediction × its value-model weight. */
  parts: Predictions;
  /** Value model: the sum of the parts. */
  value: number;
  /** Exploration bonus: EXPLORE × how little you've been shown of this card's features. */
  explore: number;
  /** Quality filter: negative for clickbait once it's on. */
  quality: number;
  total: number;
}

export interface Ranked {
  item: FeedItem;
  score: Score;
}

/** What the visitor did on one visit to a card. */
export interface VisitInput {
  /** Whether the card is hearted when the visitor leaves it. */
  liked: boolean;
  /** Seconds of the clip that actually played on this visit (summed across loops). */
  watchedSec: number;
  /** The clip's length in seconds. */
  clipSec: number;
  /** Whether the visitor tapped the card open on this visit. */
  opened: boolean;
}

export interface SwipeRecord {
  slug: string;
  /** p(into it) before the first visit. */
  guess: number;
  /** Whether the guess was right; null if the model wasn't sure either way. */
  correct: boolean | null;
  /**
   * The "going with your usual" baseline's guess: whichever answer was more
   * common before this card (null on a tie, which counts as a coin flip).
   */
  usual: boolean | null;
  /** Everything you did across visits: a later ❤️ or rewatch counts. */
  labels: Record<Task, 0 | 1>;
  /** Into it: hearted, or watched through. (Opening doesn't count: it's curiosity, not taste.) */
  into: 0 | 1;
  /** True the first time clickbait gets through: the quality filter switches on. */
  baitCaught: boolean;
}

/** What leaving a card produced: its record, and whether this was a return visit. */
export interface Visit {
  record: SwipeRecord;
  revisit: boolean;
}

export interface LearnedFeature {
  key: FeatureKey;
  label: string;
  emoji: string;
  weight: number;
}

export function createFeed(items: FeedItem[], rand: () => number = Math.random) {
  let models: Record<Task, Model>;
  /** Cards in the order you've seen them; `pos` is where you are (back/next move it). */
  let timeline: FeedItem[];
  let pos: number;
  let qualityOn: boolean;
  /** One record per distinct card, in first-seen order. */
  let log: SwipeRecord[];
  /** Watch time on each card's first visit: what "your usual" is measured from. */
  let watchTimes: number[];
  /** This session's card order. Shuffled, so score ties (e.g. before the first swipe) break randomly. */
  let order: FeedItem[] = items;
  /** The clickbait post that got the trial slot, if any. */
  let trial: FeedItem | null = null;

  const offset = (t: Task, item: FeedItem) => (item.bait ? BAIT_PRIOR[t] : 0);
  /**
   * Whether a visit to this card trains model `t`. Clickbait only trains the tap
   * model: skipping it says nothing about the food underneath (a sweet tooth who
   * skips a sweet clickbait clip is still a sweet tooth), and the feed already
   * knows how bait goes (BAIT_PRIOR).
   */
  const teaches = (t: Task, item: FeedItem) => !item.bait || t === 'open';
  const seen = (item: FeedItem) => timeline.includes(item);

  function predictions(item: FeedItem): Predictions {
    return {
      like: predict(models.like, item.x, offset('like', item)),
      watch: predict(models.watch, item.x, offset('watch', item)),
      open: predict(models.open, item.x, offset('open', item)),
    };
  }

  /** p(into it): will you ❤️ it or keep watching? */
  const interest = (item: FeedItem) => intoFrom(predictions(item));

  /**
   * How little the model knows about this card's features, in [0, 1]: each
   * feature counts 1 / (1 + how much of it you've already seen). A dish whose
   * flavors you've never been shown scores 1, so a spice lover who passes on
   * the first few cards still gets offered something spicy soon. (A cheap,
   * diagonal cousin of the upper-confidence bonus real bandits use.) Clickbait
   * doesn't count as having shown you its flavors: nobody watches it for the food.
   */
  function novelty(item: FeedItem): number {
    const total = item.x.reduce((s, v) => s + v, 0);
    if (!total) return 0;
    const shown = timeline.filter((it) => !it.bait);
    const exposure = item.x.map((_, j) => shown.reduce((s, it) => s + it.x[j], 0));
    return item.x.reduce((s, v, j) => s + v / (1 + exposure[j]), 0) / total;
  }

  /**
   * A card's score under the value model `w`. By default that's this feed's
   * (WEIGHTS, the novelty bonus, and the quality filter once it's on); `plain`
   * drops the bonus and the filter, for "what if the feed paid for something else".
   */
  function score(item: FeedItem, w: Predictions = WEIGHTS, plain = false): Score {
    const p = predictions(item);
    const parts = { like: w.like * p.like, watch: w.watch * p.watch, open: w.open * p.open };
    const value = parts.like + parts.watch + parts.open;
    const bonus = plain ? 0 : EXPLORE * novelty(item);
    const quality = !plain && qualityOn && item.bait ? -QUALITY_PENALTY : 0;
    return { p, parts, value, explore: bonus, quality, total: value + bonus + quality };
  }

  /** Cards still in the running: not seen yet, and clickbait only after BAIT_AFTER cards. */
  const eligible = () =>
    order.filter((i) => !seen(i) && (!i.bait || timeline.length >= BAIT_AFTER));

  const rank = (pool: FeedItem[], w?: Predictions, plain?: boolean): Ranked[] =>
    pool
      .map((item) => ({ item, score: score(item, w, plain) }))
      .sort((a, b) => b.score.total - a.score.total);

  function pickNext(): FeedItem | null {
    const pool = eligible();
    if (!pool.length) return null;
    // Cold start: nothing to rank on yet, so open with an honest, random card.
    if (!timeline.length) return pool[Math.floor(rand() * pool.length)];
    if (timeline.length === TRIAL_AT && !qualityOn && !timeline.some((i) => i.bait)) {
      const bait = rank(pool.filter((i) => i.bait))[0];
      if (bait) {
        trial = bait.item;
        return bait.item;
      }
    }
    return rank(pool)[0].item;
  }

  function reset(): void {
    order = [...items];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    models = {
      like: newModel(INTO_PRIOR),
      watch: newModel(INTO_PRIOR),
      open: newModel(OPEN_PRIOR),
    };
    timeline = [];
    qualityOn = false;
    trial = null;
    log = [];
    watchTimes = [];
    const first = pickNext();
    timeline = first ? [first] : [];
    pos = 0;
  }

  /** The guess "going with your usual" makes: the more common answer so far. */
  function usualGuess(): boolean | null {
    const intos = log.filter((r) => r.into).length;
    const skips = log.length - intos;
    return intos === skips ? null : intos > skips;
  }

  /**
   * Train on one visit to the current card. A first visit is one impression:
   * every model learns from it, yes or no. A return visit only adds what's new
   * (a ❤️ you didn't give before, a rewatch, a first tap), so coming back to a
   * card never counts against it.
   */
  function learn(input: VisitInput): Visit | null {
    const item = timeline[pos];
    if (!item) return null;
    const existing = log.find((r) => r.slug === item.slug);
    const threshold = watchThreshold(input.clipSec, watchTimes);
    const now: Record<Task, 0 | 1> = {
      like: input.liked ? 1 : 0,
      watch: input.watchedSec >= threshold ? 1 : 0,
      open: input.opened ? 1 : 0,
    };

    if (existing) {
      for (const t of TASKS) {
        if (now[t] && !existing.labels[t]) {
          if (teaches(t, item)) update(models[t], item.x, 1, offset(t, item));
          existing.labels[t] = 1;
        }
      }
      existing.into = existing.labels.like || existing.labels.watch ? 1 : 0;
      existing.correct = judge(existing.guess, existing.into);
      return { record: existing, revisit: true };
    }

    const guess = interest(item);
    const into: 0 | 1 = now.like || now.watch ? 1 : 0;
    const record: SwipeRecord = {
      slug: item.slug,
      guess,
      correct: judge(guess, into),
      usual: usualGuess(),
      labels: now,
      into,
      baitCaught: item.bait && !qualityOn,
    };
    for (const t of TASKS) if (teaches(t, item)) update(models[t], item.x, now[t], offset(t, item));
    watchTimes.push(input.watchedSec);
    if (record.baitCaught) qualityOn = true;
    log.push(record);
    return { record, revisit: false };
  }

  const judge = (guess: number, into: 0 | 1) =>
    Math.abs(guess - 0.5) < UNSURE ? null : guess > 0.5 === (into === 1);

  /** Leave the current card for the next one: the next you've seen, or a freshly ranked one. */
  function next(input: VisitInput): Visit | null {
    const visit = learn(input);
    if (!visit) return null;
    if (pos < timeline.length - 1) pos++;
    else {
      const item = pickNext();
      if (item) {
        timeline.push(item);
        pos++;
      } else pos = timeline.length; // past the end: nothing left to show
    }
    return visit;
  }

  /** Go back to the previous card (it still learns from what you just did). */
  function back(input: VisitInput): Visit | null {
    if (pos === 0) return null;
    const visit = timeline[pos] ? learn(input) : null;
    pos--;
    return visit;
  }

  /** What the models have learned, per feature: its pull on a ❤️ plus its pull on watching. */
  const learned = (): LearnedFeature[] =>
    FEATURES.map((f, i) => ({ ...f, weight: models.like.w[i] + models.watch.w[i] }));

  /**
   * Guesses the model was sure about, the running accuracy after each one, and
   * the bar it has to beat: "going with your usual", which guesses whichever
   * answer you'd given more often up to that card. (When you ❤️ rarely,
   * "you'll skip it" is already mostly right.)
   */
  function accuracy() {
    const sure = log.filter((r) => r.correct !== null);
    const right = sure.filter((r) => r.correct).length;
    let r = 0;
    const series = sure.map((s, i) => (r += s.correct ? 1 : 0) / (i + 1));
    const usualRight = sure.reduce(
      (s, x) => s + (x.usual === null ? 0.5 : x.usual === (x.into === 1) ? 1 : 0),
      0,
    );
    const baseline = sure.length ? usualRight / sure.length : 0.5;
    return { right, total: sure.length, series, baseline };
  }

  reset();

  return {
    next,
    back,
    reset,
    score,
    predictions,
    interest,
    learned,
    accuracy,
    /** The next few cards you haven't seen, best first. */
    upNext: (n = 3) => rank(eligible()).slice(0, n),
    /**
     * The top picks across the whole menu (seen or not, clickbait included) if
     * the value model were `w` instead: no novelty bonus, no quality filter.
     */
    topPicks: (w: Predictions, n = 3) => rank(items, w, true).slice(0, n),
    /** True if the card has been on screen this session. */
    hasSeen: (slug: string) => timeline.some((i) => i.slug === slug),
    /** The card on screen, or null past the end. */
    get current(): FeedItem | null {
      return timeline[pos] ?? null;
    },
    /** True if the card on screen is clickbait that's here on its trial view. */
    get onTrial() {
      const c = timeline[pos];
      return !!c && c === trial && !log.some((r) => r.slug === c.slug);
    },
    /** True if the card on screen is one you've already left once. */
    get revisiting() {
      const c = timeline[pos];
      return !!c && log.some((r) => r.slug === c.slug);
    },
    get canGoBack() {
      return pos > 0;
    },
    /** Distinct cards left so far. */
    get swipes() {
      return log.length;
    },
    get log(): readonly SwipeRecord[] {
      return log;
    },
    /** Seconds of playback that count as watching a clip of this length right now. */
    watchThreshold: (clipSec: number) => watchThreshold(clipSec, watchTimes),
    /** True once clickbait has slipped through once: from then on it's penalized. */
    get qualityOn() {
      return qualityOn;
    },
  };
}

export type Feed = ReturnType<typeof createFeed>;
