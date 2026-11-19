import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BAIT_AFTER,
  BAIT_PRIOR,
  EXPLORE,
  SESSION,
  TAP_WEIGHTS,
  TRIAL_AT,
  createFeed,
  FEATURES,
  quantile,
  WATCH_DEFAULT_S,
  WATCH_HISTORY,
  watchThreshold,
  newModel,
  predict,
  sigmoid,
  toVector,
  update,
  type Feed,
  type FeatureKey,
  type FeedItem,
  WEIGHTS,
} from '../src/lib/feed';
import { dishes } from '../src/data/dishes';
import { NEW_BIAS, summarize } from '../src/lib/taste';

/** Seeded PRNG (mulberry32), so every run picks the same first card. */
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const items: FeedItem[] = dishes.map((d) => ({
  slug: d.slug,
  x: toVector(d.features),
  bait: !!d.bait,
}));
const byslug = new Map(dishes.map((d) => [d.slug, d]));
const has = (slug: string, k: FeatureKey) => (byslug.get(slug)!.features[k] ?? 0) >= 1;
/** Has at least some of `k` (a spice lover likes "a bit spicy" too). */
const some = (slug: string, k: FeatureKey) => (byslug.get(slug)!.features[k] ?? 0) >= 0.5;

/** A visitor who likes any dish with some `k` (never clickbait), never taps, and swipes quickly. */
function visitor(feed: Feed, k: FeatureKey, swipes: number) {
  const seen: string[] = [];
  for (let i = 0; i < swipes && feed.current; i++) {
    const { slug, bait } = feed.current;
    seen.push(slug);
    feed.next({ liked: !bait && some(slug, k), watchedSec: 0.5, clipSec: 6, opened: false });
  }
  return seen;
}

describe('data', () => {
  it('has unique slugs, a clip, poster, and credit for each, and features in range', () => {
    expect(new Set(dishes.map((d) => d.slug)).size).toBe(dishes.length);
    for (const d of dishes) {
      expect(d.clip.credit, d.slug).not.toBe('');
      expect(d.clip.alt, d.slug).not.toBe('');
      expect(d.clip.source, d.slug).toMatch(/^https:\/\/pixabay\.com\/videos\//);
      expect(existsSync(`public/playground/${d.slug}.mp4`), d.slug).toBe(true);
      expect(existsSync(`src/assets/playground/${d.slug}.jpg`), d.slug).toBe(true);
      for (const v of Object.values(d.features)) expect(v).toBeGreaterThanOrEqual(0);
      for (const v of Object.values(d.features)) expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('includes some clickbait, and every feature appears somewhere', () => {
    expect(items.filter((i) => i.bait).length).toBeGreaterThan(0);
    FEATURES.forEach((_, j) => expect(items.some((i) => i.x[j] >= 1)).toBe(true));
  });
});

describe('logistic regression', () => {
  it('starts at the prior and moves toward the label', () => {
    const m = newModel();
    const x = toVector({ sweet: 1 });
    expect(predict(m, x)).toBe(0.5);
    update(m, x, 1);
    expect(predict(m, x)).toBeGreaterThan(0.5);
    const n = newModel();
    update(n, x, 0);
    expect(predict(n, x)).toBeLessThan(0.5);
  });

  it('takes a gradient step on log loss', () => {
    const m = newModel(0.3);
    const x = toVector({ meat: 1, spicy: 0.5 });
    const p = sigmoid(0.3);
    update(m, x, 1, 0, 0.1);
    expect(m.b).toBeCloseTo(0.3 + 0.1 * (1 - p));
    expect(m.w[FEATURES.findIndex((f) => f.key === 'spicy')]).toBeCloseTo(0.1 * (1 - p) * 0.5);
  });

  it('counts a clip as watched at 75% of it, capped at 2 seconds, until it knows your pace', () => {
    expect(watchThreshold(6)).toBe(WATCH_DEFAULT_S);
    expect(watchThreshold(20)).toBe(WATCH_DEFAULT_S);
    expect(watchThreshold(2)).toBeCloseTo(1.5);
    expect(watchThreshold(6, [0.5, 0.5])).toBe(WATCH_DEFAULT_S);
  });

  it('then measures watching against your quick skips', () => {
    expect(quantile([4, 1, 3, 2], 0.5)).toBeCloseTo(2.5);
    expect(quantile([4, 1, 3, 2], 0.25)).toBeCloseTo(1.75);
    // A fast swiper: two seconds on a clip is already a lot.
    expect(watchThreshold(6, [0.4, 0.5, 3, 0.5])).toBe(1);
    // Someone reading the dashboard while every clip loops: 8 s is just their pace.
    expect(watchThreshold(6, [8, 7, 9, 8])).toBeGreaterThan(14);
    // A feed full of things you love doesn't raise the bar on itself.
    expect(watchThreshold(6, [0.5, 0.6, 4, 4, 4, 4])).toBeLessThan(4);
  });
});

describe('createFeed', () => {
  it('opens with a random non-clickbait card and no confident guesses', () => {
    const feed = createFeed(items, mulberry32(1));
    expect(feed.current).not.toBeNull();
    expect(feed.current!.bait).toBe(false);
    const r = feed.next({ liked: true, watchedSec: 0.5, clipSec: 6, opened: false })!.record;
    expect(r.guess).toBeCloseTo(0.5);
    expect(r.correct).toBeNull();
  });

  it('keeps clickbait out until the model has a few swipes to go on', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const feed = createFeed(items, mulberry32(seed));
      const seen = visitor(feed, 'sweet', BAIT_AFTER);
      expect(seen.some((s) => s.startsWith('bait'))).toBe(false);
    }
  });

  it('while you like things, clickbait only gets its one trial view, then the filter keeps it out', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const feed = createFeed(items, mulberry32(seed));
      const seen: string[] = [];
      let trial = -1;
      for (let i = 0; i < SESSION && feed.current; i++) {
        const slug = feed.current.slug;
        if (feed.onTrial) trial = i;
        seen.push(slug);
        feed.next({ liked: some(slug, 'meat'), watchedSec: 0.5, clipSec: 6, opened: false });
      }
      // On its own merits it never wins: the prior already says nobody enjoys it.
      const baits = seen.flatMap((s, i) => (s.startsWith('bait') ? [i] : []));
      expect(baits, `seed ${seed}`).toEqual([TRIAL_AT]);
      expect(trial, `seed ${seed}`).toBe(TRIAL_AT);
      expect(feed.qualityOn).toBe(true);
    }
  });

  it('lets clickbait in when nothing else works, then the quality filter catches it', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const feed = createFeed(items, mulberry32(seed));
      // Skips everything: every dish scores low, and bait's taps carry it to the top.
      const seen: string[] = [];
      for (let i = 0; i < SESSION && feed.current; i++) {
        seen.push(feed.current.slug);
        feed.next({ liked: false, watchedSec: 0.3, clipSec: 6, opened: false });
      }
      const at = seen.findIndex((s) => s.startsWith('bait'));
      expect(at, `seed ${seed}`).toBeGreaterThanOrEqual(BAIT_AFTER);
      expect(feed.qualityOn).toBe(true);
      expect(feed.log.filter((r) => r.baitCaught)).toHaveLength(1);
      // From then on, clickbait carries the penalty and stays out of the feed.
      const bait = items.find((i) => i.bait && !seen.includes(i.slug))!;
      expect(feed.score(bait).quality).toBeLessThan(0);
      expect(seen.slice(at + 1).some((s) => s.startsWith('bait'))).toBe(false);
    }
  });

  it('a sweet tooth who skips sweet clickbait is still a sweet tooth', () => {
    // Regression: before the model knew about bait, skipping the smoothie
    // taught it "sweet is bad" and a sweet tooth's feed lost its desserts.
    // With the bait prior, the skip was expected, so it barely moves the weight.
    const smoothie = items.find((i) => i.bait && i.x.some((v) => v > 0))!;
    const sweet = FEATURES.findIndex((f) => f.key === 'sweet');
    const fan = newModel();
    fan.w[sweet] = 1.5;
    const naive = { ...fan, w: [...fan.w] };
    update(fan, smoothie.x, 0, BAIT_PRIOR.like);
    update(naive, smoothie.x, 0);
    expect(1.5 - fan.w[sweet]).toBeLessThan((1.5 - naive.w[sweet]) / 2);
    // And most of a sweet tooth's session is dessert (it was ~3 in 10).
    let onTaste = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const seen = visitor(createFeed(items, mulberry32(seed)), 'sweet', SESSION);
      onTaste += seen.filter((s) => !s.startsWith('bait') && some(s, 'sweet')).length;
    }
    expect(onTaste / 30).toBeGreaterThanOrEqual(5);
  });

  it('learns what you like and fills the feed with it', () => {
    for (const k of ['meat', 'seafood', 'sweet', 'spicy'] as FeatureKey[]) {
      const feed = createFeed(items, mulberry32(3));
      const seen = visitor(feed, k, 12);
      const top = feed.learned().sort((a, b) => b.weight - a.weight)[0];
      expect(top.key).toBe(k);
      expect(summarize(feed, items).loves[0].key).toBe(k);
      // The pick has it too, unless every dish that's all about it was already shown.
      const left = items.filter((i) => !i.bait && !seen.includes(i.slug) && has(i.slug, k));
      if (left.length) expect(some(summarize(feed, items).pick!.item.slug, k), k).toBe(true);
    }
  });

  it('after a few swipes, fills most of the feed with what you like', () => {
    const fair = items.filter((i) => !i.bait);
    for (const f of FEATURES) {
      let onTaste = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const seen = visitor(createFeed(items, mulberry32(seed)), f.key, 12);
        // The six dishes after the first three cards (skipping the clickbait trial view).
        const dishes = seen
          .slice(3)
          .filter((s) => !s.startsWith('bait'))
          .slice(0, 6);
        onTaste += dishes.filter((s) => some(s, f.key)).length / dishes.length / 20;
      }
      // At least half on taste (despite the exploration bonus), and well over
      // twice what a random feed shows.
      const random = fair.filter((i) => some(i.slug, f.key)).length / fair.length;
      expect(onTaste, f.key).toBeGreaterThanOrEqual(0.5);
      expect(onTaste, f.key).toBeGreaterThan(2 * random);
    }
  });

  it('learns a vegetarian: no meat, no seafood', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const feed = createFeed(items, mulberry32(seed));
      const seen: string[] = [];
      const animal = (slug: string) =>
        (byslug.get(slug)!.features.meat ?? 0) > 0 || (byslug.get(slug)!.features.seafood ?? 0) > 0;
      for (let i = 0; i < 12 && feed.current; i++) {
        seen.push(feed.current.slug);
        feed.next({
          liked: !animal(feed.current.slug),
          watchedSec: 0.5,
          clipSec: 6,
          opened: false,
        });
      }
      const w = new Map(feed.learned().map((f) => [f.key, f.weight]));
      expect(w.get('meat'), `seed ${seed}`).toBeLessThan(0);
      expect(w.get('seafood'), `seed ${seed}`).toBeLessThan(0);
      // Veggies beat both. (Not necessarily positive: a vegetarian who only ever
      // saw shrimp-and-tofu as their "veggie" card has every reason to doubt it.)
      expect(w.get('veggie')!, `seed ${seed}`).toBeGreaterThan(w.get('meat')!);
      expect(w.get('veggie')!, `seed ${seed}`).toBeGreaterThan(w.get('seafood')!);
      // The back half of the session is mostly meat-free. (The model stops
      // showing meat early, so it rarely needs to learn more than that.)
      expect(seen.slice(6).filter(animal).length, `seed ${seed}`).toBeLessThanOrEqual(2);
      expect(animal(summarize(feed, items).pick!.item.slug)).toBe(false);
    }
  });

  it('finds every kind of taste within a few cards', () => {
    for (const f of FEATURES) {
      for (let seed = 1; seed <= 20; seed++) {
        const seen = visitor(createFeed(items, mulberry32(seed)), f.key, SESSION);
        const first = seen.findIndex((s) => some(s, f.key));
        expect(first, `${f.key} seed ${seed}`).toBeGreaterThanOrEqual(0);
        // By the eighth card at worst, even for the rarer tastes (median: card 2–5).
        expect(first, `${f.key} seed ${seed}`).toBeLessThanOrEqual(7);
      }
    }
  });

  it('gets better at guessing your swipes', () => {
    for (const f of FEATURES) {
      let right = 0;
      let total = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const feed = createFeed(items, mulberry32(seed));
        visitor(feed, f.key, SESSION);
        right += feed.accuracy().right;
        total += feed.accuracy().total;
      }
      // Well clear of a coin flip, for every kind of taste.
      expect(right / total, f.key).toBeGreaterThan(0.6);
    }
  });

  it('reads a rare liker right: weights relative to each other, not to zero', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const feed = createFeed(items, mulberry32(seed));
      // Hearts only the clearly sweet dishes; skips everything else.
      for (let i = 0; i < SESSION && feed.current; i++)
        feed.next({
          liked: has(feed.current.slug, 'sweet'),
          watchedSec: 0.5,
          clipSec: 6,
          opened: false,
        });
      const s = summarize(feed, items);
      if (!s.likes) continue; // never shown a sweet dish this session
      expect(
        s.loves.map((f) => f.key),
        `seed ${seed}`,
      ).toContain('sweet');
      // Every "love" shows up in something actually hearted.
      for (const f of s.loves)
        expect(
          feed.log.some((r) => r.labels.like && (byslug.get(r.slug)!.features[f.key] ?? 0) > 0),
          `${f.key} seed ${seed}`,
        ).toBe(true);
    }
  });

  it('learns from watching alone: no hearts needed', () => {
    for (const k of ['meat', 'sweet', 'seafood'] as FeatureKey[]) {
      let right = 0;
      let total = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const feed = createFeed(items, mulberry32(seed));
        // Never taps the heart; just lets the dishes they like play past the cap.
        for (let i = 0; i < SESSION && feed.current; i++)
          feed.next({
            liked: false,
            watchedSec: some(feed.current.slug, k) ? WATCH_DEFAULT_S + 1 : 0.5,
            clipSec: 6,
            opened: false,
          });
        const s = summarize(feed, items);
        expect(s.likes, `${k} seed ${seed}`).toBe(0);
        if (s.into)
          expect(
            s.loves.map((f) => f.key),
            `${k} seed ${seed}`,
          ).toContain(k);
        right += s.accuracy.right;
        total += s.accuracy.total;
      }
      expect(right / total, k).toBeGreaterThan(0.6);
    }
  });

  it('claims nothing about taste when nothing was hearted or watched, and keeps accuracy honest', () => {
    const feed = createFeed(items, mulberry32(9));
    for (let i = 0; i < SESSION && feed.current; i++)
      feed.next({ liked: false, watchedSec: 0.5, clipSec: 6, opened: false });
    const s = summarize(feed, items);
    expect(s.likes).toBe(0);
    expect(s.into).toBe(0);
    expect(s.loves).toHaveLength(0);
    // "Going with your usual" (skip) is perfect here, so that's the bar, not a coin flip.
    expect(s.accuracy.baseline).toBe(1);
  });

  it('learns watching and tapping separately from liking', () => {
    const feed = createFeed(items, mulberry32(2));
    for (let i = 0; i < 14 && feed.current; i++) {
      const slug = feed.current.slug;
      // Never hearts anything, but watches veggie clips through and opens them.
      feed.next({
        liked: false,
        watchedSec: has(slug, 'veggie') ? WATCH_DEFAULT_S + 1 : 0.5,
        clipSec: 6,
        opened: has(slug, 'veggie'),
      });
    }
    const p = (slug: string) => feed.predictions(items.find((i) => i.slug === slug)!);
    expect(p('tofu-curry').watch).toBeGreaterThan(p('steak').watch);
    expect(p('tofu-curry').open).toBeGreaterThan(p('steak').open);
    expect(p('tofu-curry').like).toBeLessThan(0.5);
  });

  it('runs out gracefully and resets', () => {
    const feed = createFeed(items, mulberry32(7));
    visitor(feed, 'cheesy', 1000);
    expect(feed.current).toBeNull();
    expect(feed.swipes).toBe(items.length);
    expect(feed.next({ liked: true, watchedSec: 0, clipSec: 6, opened: false })).toBeNull();
    // Back from past the end lands on the last card.
    expect(feed.canGoBack).toBe(true);
    expect(feed.upNext()).toHaveLength(0);
    expect(summarize(feed, items).pick).toBeDefined();
    feed.reset();
    expect(feed.swipes).toBe(0);
    expect(feed.qualityOn).toBe(false);
    expect(feed.current).not.toBeNull();
    expect(feed.learned().every((f) => f.weight === 0)).toBe(true);
  });

  it('goes back and forth like Reels, without re-ranking what you already saw', () => {
    const feed = createFeed(items, mulberry32(5));
    const skip = { liked: false, watchedSec: 0.5, clipSec: 6, opened: false };
    expect(feed.canGoBack).toBe(false);
    expect(feed.back(skip)).toBeNull();
    const a = feed.current!;
    feed.next(skip);
    const b = feed.current!;
    feed.next(skip);
    const c = feed.current!;
    expect(new Set([a, b, c]).size).toBe(3);
    feed.back(skip); // c is left once (a quick skip), back to b
    expect(feed.current).toBe(b);
    expect(feed.revisiting).toBe(true);
    feed.back(skip);
    expect(feed.current).toBe(a);
    feed.next(skip);
    feed.next(skip);
    expect(feed.current).toBe(c); // the same next card, not a fresh ranking
    expect(feed.swipes).toBe(3);
  });

  it('counts what you add on a return visit, and never holds a return against a card', () => {
    const feed = createFeed(items, mulberry32(8));
    const skip = { liked: false, watchedSec: 0.5, clipSec: 6, opened: false };
    const first = feed.current!;
    const r = feed.next(skip)!.record;
    expect(r.into).toBe(0);
    feed.back(skip);
    // Coming back and leaving again without doing anything changes nothing.
    const before = feed.learned().map((f) => f.weight);
    const again = feed.next(skip)!;
    expect(again.revisit).toBe(true);
    expect(feed.learned().map((f) => f.weight)).toEqual(before);
    // Coming back to ❤️ it does count, and updates the card's record.
    feed.back(skip);
    expect(feed.current).toBe(first);
    const liked = feed.next({ ...skip, liked: true })!;
    expect(liked.revisit).toBe(true);
    expect(liked.record.labels.like).toBe(1);
    expect(liked.record.into).toBe(1);
    expect(feed.log).toHaveLength(2);
    expect(feed.predictions(first).like).toBeGreaterThan(sigmoidPrior());
  });

  it('judges itself against "going with your usual", using only what came before', () => {
    const feed = createFeed(items, mulberry32(10));
    const recs = [true, true, false, true].map(
      (liked) => feed.next({ liked, watchedSec: 0.5, clipSec: 6, opened: false })!.record,
    );
    expect(recs.map((r) => r.usual)).toEqual([null, true, true, true]);
  });

  it('only counts watching past your quick-skip pace once it knows it', () => {
    const feed = createFeed(items, mulberry32(12));
    // A dashboard reader: every clip loops for about 8 s while they read.
    for (let i = 0; i < WATCH_HISTORY; i++)
      feed.next({ liked: false, watchedSec: 8, clipSec: 6, opened: false });
    const r = feed.next({ liked: false, watchedSec: 8.5, clipSec: 6, opened: false })!.record;
    expect(r.labels.watch).toBe(0);
    const s = feed.next({ liked: false, watchedSec: 20, clipSec: 6, opened: false })!.record;
    expect(s.labels.watch).toBe(1);
  });

  it('scores a card as the weighted predictions plus the novelty bonus', () => {
    const feed = createFeed(items, mulberry32(13));
    visitor(feed, 'spicy', 4);
    for (const { item, score: s } of feed.upNext(5)) {
      const { p } = s;
      const value = WEIGHTS.like * p.like + WEIGHTS.watch * p.watch + WEIGHTS.open * p.open;
      expect(s.value, item.slug).toBeCloseTo(value);
      expect(s.explore).toBeGreaterThanOrEqual(0);
      expect(s.explore).toBeLessThanOrEqual(EXPLORE);
      expect(s.total).toBeCloseTo(s.value + s.explore + s.quality);
    }
  });
});

describe('clickbait', () => {
  it('only trains the tap model: skipping it says nothing about the food', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const feed = createFeed(items, mulberry32(seed));
      visitor(feed, 'sweet', TRIAL_AT);
      expect(feed.onTrial).toBe(true);
      const before = feed.learned().map((f) => f.weight);
      feed.next({ liked: false, watchedSec: 0.3, clipSec: 6, opened: true });
      // L2 shrinks every weight a hair on each update; nothing else moves.
      feed.learned().forEach((f, i) => expect(f.weight).toBeCloseTo(before[i], 5));
    }
  });

  it('would top a feed that paid for taps, but not this one', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const feed = createFeed(items, mulberry32(seed));
      visitor(feed, 'meat', SESSION);
      const taps = feed.topPicks(TAP_WEIGHTS, 3);
      expect(taps[0].item.bait, `seed ${seed}`).toBe(true);
      expect(feed.topPicks(WEIGHTS, 3).some((r) => r.item.bait)).toBe(false);
      // The summary's what-if is the same ranking.
      expect(summarize(feed, items).ifTaps.map((r) => r.item.slug)).toEqual(
        taps.map((r) => r.item.slug),
      );
    }
  });
});

describe('summarize', () => {
  it('picks something new unless a favorite is clearly better', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const feed = createFeed(items, mulberry32(seed));
      visitor(feed, 'spicy', SESSION);
      const { pick } = summarize(feed, items);
      expect(pick, `seed ${seed}`).not.toBeNull();
      const fresh = items.filter((i) => !i.bait && !feed.hasSeen(i.slug));
      const bestFresh = Math.max(...fresh.map((i) => feed.interest(i)));
      if (pick!.again) expect(pick!.p - NEW_BIAS).toBeGreaterThanOrEqual(bestFresh - 1e-9);
      else expect(feed.hasSeen(pick!.item.slug)).toBe(false);
    }
  });

  it('explains the pick with tastes it actually found', () => {
    for (const k of ['meat', 'seafood', 'sweet', 'cheesy'] as FeatureKey[]) {
      const feed = createFeed(items, mulberry32(5));
      visitor(feed, k, SESSION);
      const s = summarize(feed, items);
      expect(s.why.length, k).toBeGreaterThan(0);
      for (const f of s.why) {
        expect(s.loves).toContain(f);
        expect(s.pick!.item.x[FEATURES.findIndex((g) => g.key === f.key)]).toBeGreaterThan(0);
      }
    }
  });
});

/** p(like) for a fresh model on any card: the prior. */
function sigmoidPrior() {
  return createFeed(items, mulberry32(1)).predictions(items[0]).like;
}
