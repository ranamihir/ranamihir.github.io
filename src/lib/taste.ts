// The end-of-session read on a feed: your top tastes, what you should order,
// and what a feed that paid for taps would have picked instead. Pure, like
// feed.ts; the card that shows it is src/components/playground/summary.ts.

import {
  FEATURES,
  TAP_WEIGHTS,
  type Feed,
  type FeatureKey,
  type FeedItem,
  type LearnedFeature,
  type Ranked,
} from './feed';

/**
 * Things people rule out entirely (diet, allergies, heat), not just prefer
 * less. The pick steers clear of these if you've been skipping them, even when
 * the rest of the dish suits you; anything else it leaves to the model.
 */
export const DEALBREAKERS: readonly FeatureKey[] = ['meat', 'seafood', 'spicy'];

/**
 * How far ahead (in p(into it)) a dish you already loved has to be before it's
 * the pick over the best new one. A recommendation should mostly be something
 * new, but by card 10 the feed has often shown your best matches already, and
 * "order the steak again" beats a lukewarm "try the broccoli".
 */
export const NEW_BIAS = 0.15;

export interface Pick {
  item: FeedItem;
  /** p(into it). */
  p: number;
  /** True if it's a dish you've already seen (and were into). */
  again: boolean;
}

export interface TasteSummary {
  /** Up to three features that stand out, best first. */
  loves: LearnedFeature[];
  /** Up to two that you're least into, worst first. */
  skips: LearnedFeature[];
  /** Cards you were into (❤️ or watched). */
  into: number;
  /** Cards you ❤️'d. */
  likes: number;
  pick: Pick | null;
  /** The pick's strongest reasons: your loves that it has. */
  why: LearnedFeature[];
  /** Top picks if the feed paid only for taps (see TAP_WEIGHTS). */
  ifTaps: Ranked[];
  accuracy: ReturnType<Feed['accuracy']>;
}

export function summarize(feed: Feed, items: readonly FeedItem[]): TasteSummary {
  const bySlug = new Map(items.map((i) => [i.slug, i]));
  const log = feed.log;
  // Read the weights relative to each other, not to zero: if you're into few
  // clips, every weight drifts negative, and what matters is which are highest.
  const all = feed.learned();
  const feats = [...all].sort((a, b) => b.weight - a.weight);
  const mean = feats.reduce((sum, f) => sum + f.weight, 0) / feats.length;
  const intoItems = log.filter((r) => r.into).map((r) => bySlug.get(r.slug)!);
  const col = (key: FeatureKey) => FEATURES.findIndex((f) => f.key === key);
  const inInto = (key: FeatureKey) => intoItems.some((it) => it.x[col(key)] > 0);
  // A "love" stands out from your average and shows up in something you ❤️'d or watched.
  const loves = feats.filter((f) => f.weight - mean > 0.05 && inInto(f.key)).slice(0, 3);
  const below = feats.filter((f) => f.weight - mean < -0.05 && !loves.includes(f));
  const skips = below.slice(-2).reverse();

  // The pick: none of the dealbreakers you skip (a vegetarian who loves fried
  // food shouldn't be sent off to order pork wontons). Only dealbreakers: a meat
  // lover who skipped grilled squid should still be sent to the grilled burger.
  const avoid = below.filter((f) => DEALBREAKERS.includes(f.key)).map((f) => col(f.key));
  const safe = (xs: FeedItem[]) => xs.filter((i) => avoid.every((j) => !i.x[j]));
  const fair = items.filter((i) => !i.bait);
  const fresh = fair.filter((i) => !feed.hasSeen(i.slug));
  const favorites = intoItems.filter((i) => !i.bait);
  const rate = (xs: FeedItem[], again: boolean): Pick[] =>
    xs.map((item) => ({ item, p: feed.interest(item), again }));
  const handicap = (c: Pick) => c.p - (c.again ? NEW_BIAS : 0);
  const best = (cs: Pick[]) => [...cs].sort((a, b) => handicap(b) - handicap(a))[0] ?? null;
  // New or loved, and safe; failing that, anything new; failing that, anything.
  const pick =
    best([...rate(safe(fresh), false), ...rate(safe(favorites), true)]) ??
    best(rate(fresh, false)) ??
    best(rate(fair, true));

  const why = pick
    ? all
        .map((f, i) => ({ f, c: (f.weight - mean) * pick.item.x[i] }))
        .filter(({ f, c }) => c > 0.02 && loves.includes(f))
        .sort((a, b) => b.c - a.c)
        .slice(0, 2)
        .map(({ f }) => f)
    : [];

  return {
    loves,
    skips,
    into: intoItems.length,
    likes: log.filter((r) => r.labels.like).length,
    pick,
    why,
    ifTaps: feed.topPicks(TAP_WEIGHTS, 3),
    accuracy: feed.accuracy(),
  };
}
