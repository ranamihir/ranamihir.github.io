// Cards for the "Train your own feed" playground (src/components/Playground.astro).
// Each dish is a short silent clip, hand-tagged with the features the model
// learns from (0–1 each). Food splits people more than most things (meat,
// seafood, spice, sweets), so the model gets clear signal within a few swipes.
// Clips: public/playground/<slug>.mp4 (6 s, 576×720, H.264, no audio); posters:
// src/assets/playground/<slug>.jpg. All from Pixabay (Pixabay Content License),
// credited on each card.

import type { FeatureKey } from '../lib/feed';

export interface Dish {
  slug: string;
  name: string;
  /** Shown under the name on the card. */
  cuisine: string;
  /** One line, shown when the card is opened. */
  blurb: string;
  features: Partial<Record<FeatureKey, number>>;
  /**
   * Clickbait: a headline built to be tapped, not enjoyed, from a creator
   * account (a post, not an ad). Caught by the quality filter.
   */
  bait?: { headline: string; handle: string };
  /** The clip's creator on Pixabay, its Pixabay page, and a description. */
  clip: { credit: string; source: string; alt: string };
}

/** What the playground's client script gets for each card (built in Playground.astro). */
export interface PlaygroundCard {
  slug: string;
  name: string;
  cuisine: string;
  blurb: string;
  bait: Dish['bait'] | null;
  /** Feature vector, in FEATURES order (src/lib/feed.ts). */
  x: number[];
  /** Strongest features, as "emoji label". */
  tags: string[];
  /** The clip (served from public/). */
  video: string;
  poster: string;
  thumb: string;
  alt: string;
  credit: string;
  source: string;
}

export const dishes: Dish[] = [
  {
    slug: 'burgers',
    name: 'Flame-grilled burgers',
    cuisine: 'American',
    blurb: 'Beef patties over open flame, about to meet cheese and a bun.',
    features: { meat: 1, grilled: 1 },
    clip: {
      credit: 'srb_films',
      source: 'https://pixabay.com/videos/id-124823/',
      alt: 'Burger patties sizzling on a grill as flames flare up.',
    },
  },
  {
    slug: 'steak',
    name: 'Tomahawk steak',
    cuisine: 'Steakhouse',
    blurb: "A bone-in ribeye, charred outside and pink inside. Don't you dare ask for well-done.",
    features: { meat: 1, grilled: 1 },
    clip: {
      credit: 'alipub',
      source: 'https://pixabay.com/videos/id-127253/',
      alt: 'A thick bone-in steak searing on a grill.',
    },
  },
  {
    slug: 'ribs',
    name: 'Sticky pork ribs',
    cuisine: 'Chinese',
    blurb: "Pork ribs braised and glazed until they're lacquered and falling off the bone.",
    features: { meat: 1, sweet: 0.5 },
    clip: {
      credit: 'XiaosKitchen',
      source: 'https://pixabay.com/videos/id-11696/',
      alt: 'Glossy, glazed pork ribs on a plate.',
    },
  },
  {
    slug: 'grilled-chicken',
    name: 'Grilled chicken',
    cuisine: 'Barbecue',
    blurb: 'Chicken legs over hot coals, with crispy skin and smoky everything.',
    features: { meat: 1, grilled: 1 },
    clip: {
      credit: 'Life-Of-Vids',
      source: 'https://pixabay.com/videos/id-273/',
      alt: 'Chicken legs grilling over glowing coals.',
    },
  },
  {
    slug: 'schnitzel',
    name: 'Schnitzel',
    cuisine: 'Austrian',
    blurb: 'Pounded thin, breaded, and fried until it puffs up golden. Squeeze of lemon, done.',
    features: { meat: 1, fried: 1 },
    clip: {
      credit: 'Pana68',
      source: 'https://pixabay.com/videos/id-200129/',
      alt: 'Breaded cutlets bubbling in a pan of hot oil.',
    },
  },
  {
    slug: 'korean-bbq',
    name: 'Korean BBQ',
    cuisine: 'Korean',
    blurb: 'Pork belly and beef you grill yourself at the table, then wrap in lettuce.',
    features: { meat: 1, grilled: 1 },
    clip: {
      credit: 'ymyphoto',
      source: 'https://pixabay.com/videos/id-152831/',
      alt: 'Raw pork belly and beef cooking on a tabletop grill.',
    },
  },
  {
    slug: 'chili-beef',
    name: 'Chili beef',
    cuisine: 'Sichuan',
    blurb: 'Tender beef tossed with a fistful of dried chilies. Have rice ready.',
    features: { meat: 1, spicy: 1 },
    clip: {
      credit: 'XiaosKitchen',
      source: 'https://pixabay.com/videos/id-11623/',
      alt: 'Beef stir-fried with red chilies, served over rice.',
    },
  },
  {
    slug: 'chicken-curry',
    name: 'Chicken curry',
    cuisine: 'Southeast Asian',
    blurb: 'Chicken simmered in a golden coconut curry, with rice to soak it all up.',
    features: { meat: 1, spicy: 0.5 },
    clip: {
      credit: 'XiaosKitchen',
      source: 'https://pixabay.com/videos/id-11684/',
      alt: 'A bowl of yellow chicken curry next to rice.',
    },
  },
  {
    slug: 'bacon',
    name: 'Sizzling bacon',
    cuisine: 'American',
    blurb: 'Crispy strips spitting in the pan. The smell alone is a breakfast.',
    features: { meat: 1, fried: 0.5 },
    clip: {
      credit: 'u_s3x58oi3kn',
      source: 'https://pixabay.com/videos/id-381248/',
      alt: 'Strips of bacon sizzling in a hot pan.',
    },
  },
  {
    slug: 'sushi',
    name: 'Sushi platter',
    cuisine: 'Japanese',
    blurb: 'Rows of maki and nigiri, with wasabi and ginger on the side.',
    features: { seafood: 1, carbs: 0.5 },
    clip: {
      credit: 'LisaOlivia',
      source: 'https://pixabay.com/videos/id-246385/',
      alt: 'A long platter of assorted sushi rolls.',
    },
  },
  {
    slug: 'sashimi',
    name: 'Salmon and prawn sashimi',
    cuisine: 'Japanese',
    blurb: 'Raw salmon and sweet prawns, sliced and served cold. No rice, no hiding.',
    features: { seafood: 1 },
    clip: {
      credit: '29340655',
      source: 'https://pixabay.com/videos/id-128206/',
      alt: 'Slices of raw salmon and raw prawns on a white board.',
    },
  },
  {
    slug: 'paella',
    name: 'Seafood paella',
    cuisine: 'Spanish',
    blurb: 'Saffron rice, prawns, and mussels in a giant pan, ideally shared with a crowd.',
    features: { seafood: 1, meat: 0.5, carbs: 1 },
    clip: {
      credit: 'tiburi',
      source: 'https://pixabay.com/videos/id-24827/',
      alt: 'A huge pan of paella topped with prawns and mussels.',
    },
  },
  {
    slug: 'lobster',
    name: 'Ginger-scallion lobster',
    cuisine: 'Cantonese',
    blurb: 'Lobster wok-tossed with ginger and scallions. Eat with your hands.',
    features: { seafood: 1 },
    clip: {
      credit: 'XiaosKitchen',
      source: 'https://pixabay.com/videos/id-11607/',
      alt: 'Cooked lobster pieces topped with chopped scallions.',
    },
  },
  {
    slug: 'squid',
    name: 'Grilled squid',
    cuisine: 'Street food',
    blurb: 'Whole squid on skewers over charcoal, brushed with sweet soy.',
    features: { seafood: 1, grilled: 1 },
    clip: {
      credit: 'XiaosKitchen',
      source: 'https://pixabay.com/videos/id-11702/',
      alt: 'Whole squid grilling on skewers over charcoal.',
    },
  },
  {
    slug: 'shrimp-tofu',
    name: 'Shrimp and tofu',
    cuisine: 'Chinese',
    blurb: 'Plump shrimp and silky tofu in a light, garlicky sauce.',
    features: { seafood: 1, veggie: 0.5 },
    clip: {
      credit: 'XiaosKitchen',
      source: 'https://pixabay.com/videos/id-11700/',
      alt: 'A dish of shrimp with cubes of tofu and herbs.',
    },
  },
  {
    slug: 'octopus',
    name: 'Fresh octopus',
    cuisine: 'Korean seafood market',
    blurb: "Very fresh. In some places in Korea, it's still moving on the plate.",
    features: { seafood: 1 },
    clip: {
      credit: 'Rainbow76',
      source: 'https://pixabay.com/videos/id-325074/',
      alt: 'A live octopus among clams at a seafood market.',
    },
  },
  {
    slug: 'blue-crab',
    name: 'Blue crab',
    cuisine: 'Chesapeake',
    blurb: 'Steam it, crack it, pick out every bit of sweet meat. Takes an hour, worth it.',
    features: { seafood: 1 },
    clip: {
      credit: 'Kmeel_com',
      source: 'https://pixabay.com/videos/id-192890/',
      alt: 'A whole blue crab on a white surface.',
    },
  },
  {
    slug: 'kimchi',
    name: 'Kimchi',
    cuisine: 'Korean',
    blurb: 'Napa cabbage rubbed with chili paste and left to ferment. Funky, spicy, everywhere.',
    features: { veggie: 1, spicy: 1 },
    clip: {
      credit: 'santorihan',
      source: 'https://pixabay.com/videos/id-224220/',
      alt: 'A gloved hand rubbing red chili paste into cabbage.',
    },
  },
  {
    slug: 'tofu-curry',
    name: 'Tofu curry',
    cuisine: 'Thai',
    blurb: 'Tofu and vegetables in a fragrant curry with fresh basil.',
    features: { veggie: 1, spicy: 0.5 },
    clip: {
      credit: 'XiaosKitchen',
      source: 'https://pixabay.com/videos/id-11633/',
      alt: 'A tofu and vegetable curry topped with basil leaves.',
    },
  },
  {
    slug: 'broccoli',
    name: 'Fresh broccoli',
    cuisine: 'Farmers market',
    blurb: "Just broccoli. Steamed, roasted, or raw, it's a vegetable you either love or hide.",
    features: { veggie: 1 },
    clip: {
      credit: 'XiaosKitchen',
      source: 'https://pixabay.com/videos/id-1489/',
      alt: 'Broccoli being chopped on a cutting board.',
    },
  },
  {
    slug: 'peppers',
    name: 'Pepper stir-fry',
    cuisine: 'Chinese',
    blurb: 'Bell peppers and chilies flash-fried in a screaming-hot wok.',
    features: { veggie: 1, spicy: 0.5 },
    clip: {
      credit: 'XiaosKitchen',
      source: 'https://pixabay.com/videos/id-11671/',
      alt: 'A plate of stir-fried green and red peppers.',
    },
  },
  {
    slug: 'tofu-skewers',
    name: 'Spicy tofu skewers',
    cuisine: 'Street food',
    blurb: 'Grilled tofu on sticks, buried in chili powder and cumin.',
    features: { veggie: 1, spicy: 1, grilled: 1 },
    clip: {
      credit: 'XiaosKitchen',
      source: 'https://pixabay.com/videos/id-11685/',
      alt: 'Grilled tofu skewers dusted with chili spice.',
    },
  },
  {
    slug: 'natto',
    name: 'Natto',
    cuisine: 'Japanese',
    blurb: 'Fermented soybeans with long, sticky strings. A breakfast test of character.',
    features: { veggie: 1 },
    clip: {
      credit: '魔理沙のズボラ飯',
      source: 'https://pixabay.com/videos/id-66554/',
      alt: 'A bowl of natto, sticky fermented soybeans.',
    },
  },
  {
    slug: 'oden',
    name: 'Oden',
    cuisine: 'Japanese',
    blurb:
      'Fish cakes, konjac, and eggs simmered in dashi. Winter comfort from a convenience store.',
    features: { seafood: 0.5, veggie: 0.5 },
    clip: {
      credit: '魔理沙のズボラ飯',
      source: 'https://pixabay.com/videos/id-67857/',
      alt: 'A bowl of oden: fish cakes and konjac in clear broth.',
    },
  },
  {
    slug: 'zongzi',
    name: 'Zongzi',
    cuisine: 'Chinese',
    blurb: 'Sticky rice and pork steamed inside bamboo leaves. Unwrapping it is half the fun.',
    features: { carbs: 1, meat: 0.5 },
    clip: {
      credit: 'XiaosKitchen',
      source: 'https://pixabay.com/videos/id-11678/',
      alt: 'An unwrapped sticky-rice zongzi on a bamboo leaf.',
    },
  },
  {
    slug: 'dumplings',
    name: 'Handmade dumplings',
    cuisine: 'Chinese',
    blurb: 'Pork and chive filling, folded by hand, one pleat at a time.',
    features: { carbs: 1, meat: 0.5 },
    clip: {
      credit: 'XiaosKitchen',
      source: 'https://pixabay.com/videos/id-11613/',
      alt: 'Hands spooning filling into a dumpling wrapper and folding it.',
    },
  },
  {
    slug: 'pizza',
    name: 'Pepperoni pizza',
    cuisine: 'Italian-American',
    blurb: 'Bubbling cheese and pepperoni cupped into little pools of grease. Perfect.',
    features: { cheesy: 1, carbs: 1, meat: 0.5 },
    clip: {
      credit: 'u_mcy3jdr8zw',
      source: 'https://pixabay.com/videos/id-149678/',
      alt: 'A close-up of a pepperoni pizza with bubbling cheese.',
    },
  },
  {
    slug: 'cheese-board',
    name: 'Cheese board',
    cuisine: 'French',
    blurb: "Soft, hard, blue, and stinky, with crackers and grapes to pretend it's balanced.",
    features: { cheesy: 1 },
    clip: {
      credit: 'Solarselle77',
      source: 'https://pixabay.com/videos/id-308450/',
      alt: 'A board of assorted cheeses with grapes and crackers.',
    },
  },
  {
    slug: 'nachos',
    name: 'Nachos with cheese sauce',
    cuisine: 'Tex-Mex',
    blurb: 'Tortilla chips drowned in molten cheese, straight from the ballpark.',
    features: { cheesy: 1, fried: 0.5, spicy: 0.5 },
    clip: {
      credit: 'GreenCardShow',
      source: 'https://pixabay.com/videos/id-166519/',
      alt: 'Cheese sauce being ladled over a tray of nachos.',
    },
  },
  {
    slug: 'deep-dish',
    name: 'Chicago deep-dish',
    cuisine: 'Chicago',
    blurb:
      'Less a pizza than a cheese casserole with a crust. Eaten with a knife and fork, and no regrets.',
    features: { cheesy: 1, carbs: 1 },
    clip: {
      credit: 'mujtabaonline',
      source: 'https://pixabay.com/videos/id-136431/',
      alt: 'A knife cutting through a thick, cheesy deep-dish pizza.',
    },
  },
  {
    slug: 'charcuterie',
    name: 'Charcuterie board',
    cuisine: 'Party food',
    blurb: 'Cheese, salami, and prosciutto, with a few berries so it counts as balanced.',
    features: { cheesy: 1, meat: 1 },
    clip: {
      credit: 'kamhunt',
      source: 'https://pixabay.com/videos/id-156103/',
      alt: 'A wooden board of sliced cheeses, salami, ham, crackers, almonds, and blackberries.',
    },
  },
  {
    slug: 'cheese-shop',
    name: 'Dutch cheese shop',
    cuisine: 'Amsterdam',
    blurb: 'Wheels of Gouda stacked to the ceiling, and free samples at every counter.',
    features: { cheesy: 1 },
    clip: {
      credit: 'Ri_Ya',
      source: 'https://pixabay.com/videos/id-165976/',
      alt: 'Shelves of Gouda wheels and wrapped cheeses in a cheese shop.',
    },
  },
  {
    slug: 'martabak',
    name: 'Martabak manis',
    cuisine: 'Indonesian street food',
    blurb:
      'Thick, buttery pancakes heaped with chocolate sprinkles or grated cheese (or both, and yes, both works).',
    features: { cheesy: 1, sweet: 1, carbs: 0.5 },
    clip: {
      credit: 'Animateon',
      source: 'https://pixabay.com/videos/id-33711/',
      alt: 'Martabak pancake cups topped with chocolate sprinkles and grated cheese.',
    },
  },
  {
    slug: 'fries',
    name: 'French fries',
    cuisine: 'Belgian',
    blurb: 'Double-fried, salted, and best eaten while still too hot.',
    features: { fried: 1 },
    clip: {
      credit: 'Engin_Akyurt',
      source: 'https://pixabay.com/videos/id-72025/',
      alt: 'Fries being shaken out of a fryer basket.',
    },
  },
  {
    slug: 'wontons',
    name: 'Fried wontons',
    cuisine: 'Chinese',
    blurb: 'Crispy, crinkly wontons with a little pork filling. Dip in sweet chili sauce.',
    features: { fried: 1, meat: 0.5, carbs: 0.5 },
    clip: {
      credit: 'wdT0R0',
      source: 'https://pixabay.com/videos/id-171656/',
      alt: 'A bowl full of golden fried wontons.',
    },
  },
  {
    slug: 'pancakes',
    name: 'Pancakes',
    cuisine: 'American',
    blurb: 'A tall stack, a pat of butter, and maple syrup running down the sides.',
    features: { sweet: 1, carbs: 1 },
    clip: {
      credit: 'Kaffeesüchtig',
      source: 'https://pixabay.com/videos/id-200017/',
      alt: 'Pancake batter being poured onto a hot pan.',
    },
  },
  {
    slug: 'donut',
    name: 'Sprinkle donuts',
    cuisine: 'American',
    blurb: 'Fried dough, glaze, and far too many sprinkles.',
    features: { sweet: 1, fried: 1, carbs: 0.5 },
    clip: {
      credit: 'AyeshaAsad',
      source: 'https://pixabay.com/videos/id-141836/',
      alt: 'A glazed donut covered in rainbow sprinkles.',
    },
  },
  {
    slug: 'croissant',
    name: 'Croissants',
    cuisine: 'French',
    blurb: 'Dozens of buttery layers. Crumbs everywhere is the point.',
    features: { carbs: 1, sweet: 0.5 },
    clip: {
      credit: 'grandmusicevents',
      source: 'https://pixabay.com/videos/id-31754/',
      alt: 'A close-up of flaky, golden croissants.',
    },
  },
  {
    slug: 'ice-cream',
    name: 'Chocolate-dipped ice cream',
    cuisine: 'Gelateria',
    blurb: 'Vanilla on a stick, dunked in chocolate and crushed nuts.',
    features: { sweet: 1 },
    clip: {
      credit: 'Kaffeesüchtig',
      source: 'https://pixabay.com/videos/id-222120/',
      alt: 'An ice cream bar coated in chocolate and nuts.',
    },
  },
  {
    slug: 'jalebi',
    name: 'Jalebi',
    cuisine: 'Indian',
    blurb: 'Batter piped in spirals into hot oil, then soaked in syrup. Crunchy, sticky, glorious.',
    features: { sweet: 1, fried: 1 },
    clip: {
      credit: 'veeroo18',
      source: 'https://pixabay.com/videos/id-71522/',
      alt: 'Jalebi batter being piped in spirals into hot oil.',
    },
  },
  {
    slug: 'waffles',
    name: 'Belgian waffles',
    cuisine: 'Belgian',
    blurb: 'Deep pockets, crisp edges, and a dusting of sugar.',
    features: { sweet: 1, carbs: 1 },
    clip: {
      credit: 'Kaffeesüchtig',
      source: 'https://pixabay.com/videos/id-208754/',
      alt: 'A close-up of a golden Belgian waffle dusted with sugar.',
    },
  },
  {
    slug: 'pralines',
    name: 'Chocolate pralines',
    cuisine: 'Belgian',
    blurb: 'A box of filled chocolates. Nobody ever knows which one is coffee.',
    features: { sweet: 1 },
    clip: {
      credit: 'mds524680',
      source: 'https://pixabay.com/videos/id-71747/',
      alt: 'Rows of filled chocolate pralines in a box.',
    },
  },
  {
    slug: 'street-noodles',
    name: 'Fried noodles',
    cuisine: 'Thai street food',
    blurb: 'Noodles tossed in a giant wok at a night-market stall, served in a minute.',
    features: { carbs: 1, fried: 0.5, spicy: 0.5 },
    clip: {
      credit: 'Coverr-Free-Footage',
      source: 'https://pixabay.com/videos/id-5637/',
      alt: 'A street vendor tossing noodles in a giant wok.',
    },
  },
  {
    slug: 'bait-smoothie',
    name: 'This ONE smoothie melts belly fat OVERNIGHT 🤯',
    cuisine: 'Clickbait',
    blurb: "It doesn't. It's a milkshake and a lot of pop-ups.",
    features: { sweet: 1 },
    bait: {
      headline: 'This ONE smoothie melts belly fat OVERNIGHT 🤯',
      handle: 'superfoodtruths',
    },
    clip: {
      credit: 'Irish83',
      source: 'https://pixabay.com/videos/id-66865/',
      alt: 'Glasses of berry milkshake topped with cream.',
    },
  },
  {
    slug: 'bait-pizza',
    name: 'Chefs HATE this 3-ingredient pizza hack (#5 is ILLEGAL in Italy)',
    cuisine: 'Clickbait',
    blurb: 'There were four hacks. None were illegal. One was "add cheese."',
    features: { cheesy: 1, carbs: 1, meat: 0.5 },
    bait: {
      headline: 'Chefs HATE this 3-ingredient pizza hack (#5 is ILLEGAL in Italy)',
      handle: 'foodhackz',
    },
    clip: {
      credit: 'torkosmedia',
      source: 'https://pixabay.com/videos/id-75407/',
      alt: 'A pizza with peppers and ham being sliced.',
    },
  },
];
