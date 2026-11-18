// Selected research projects (NYU). Impact-first blurbs.
// `highlight` feeds the floating hover card; `media` adds a demo animation.

export interface Project {
  title: string;
  year: string;
  blurb: string;
  stack: string[];
  // Shown on the floating "index card" when hovering the project row.
  highlight: { value: string; label: string };
  code?: string;
  demo?: string;
  // Optional demo animation, shown in the expanded row and the hover card.
  // `poster` is a still frame served to visitors who prefer reduced motion.
  media?: {
    src: string;
    poster?: string;
    alt: string;
    caption?: string;
    width: number;
    height: number;
  };
}

const GITHUB = 'https://github.com';
const RL_PROJECT = GITHUB + '/ranamihir/visual_embeddings_for_rl';
const NMT_PROJECT = GITHUB + '/avidkenil/NLP_Project';
const TOXIC_COMMENT_PROJECT = GITHUB + '/ranamihir/ml_project';
const PHOTOBOMBER_PROJECT = GITHUB + '/ranamihir/dl_project';

export const projects: Project[] = [
  {
    title: 'Visual Embeddings for Reinforcement Learning',
    year: '2019',
    blurb:
      'Taught an RL agent to solve sparse-reward mazes by first watching a handful of expert demonstration videos: self-supervised embeddings (trained to predict the time gap between frames) made the rewards denser and initialized the agent’s memory. Advised by Rob Fergus and Ilya Kostrikov.',
    stack: ['PyTorch', 'Reinforcement Learning', 'Self-Supervised Learning', 'MiniGrid'],
    highlight: {
      value: 'Sparse → dense',
      label: 'rewards, learned from a handful of expert videos',
    },
    code: RL_PROJECT,
    media: {
      src: '/projects/rl-mazes.webp',
      poster: '/projects/rl-mazes-poster.webp',
      alt: 'Animation: the trained agent, a red triangle, navigates randomly generated mazes toward a green goal square.',
      caption: 'The trained agent working through randomly generated mazes.',
      width: 800,
      height: 800,
    },
  },
  {
    title: 'Neural Machine Translation',
    year: '2018',
    blurb:
      'Built Vietnamese→English (BLEU 24) and Chinese→English (BLEU 19) translation systems on IWSLT, with a Bi-LSTM / ConvNet encoder-decoder, Luong attention, and beam search.',
    stack: ['PyTorch', 'Bi-LSTM', 'Attention', 'NLP'],
    highlight: { value: 'Vietnamese → English', label: '24 BLEU on IWSLT' },
    code: NMT_PROJECT,
  },
  {
    title: 'Generatively Removing Photobombers',
    year: '2018',
    blurb:
      'A pipeline to detect and remove photobombers from images and inpaint the background, using Mask R-CNN (Detectron) for instance segmentation and Deep Image Prior for inpainting.',
    stack: ['PyTorch', 'Mask R-CNN', 'Detectron', 'Computer Vision'],
    highlight: { value: 'Mask R-CNN + Deep Image Prior', label: 'Me 1, Photobombers 0' },
    code: PHOTOBOMBER_PROJECT,
  },
  {
    title: 'Toxic Comment Classification',
    year: '2018',
    blurb:
      'Multi-class, multi-label models classifying Wikipedia comments by toxicity, reaching macro-AUC 0.98 with fastText and 0.97 with a self-implemented XGBoost + Naive-Bayes SVM ensemble.',
    stack: ['scikit-learn', 'fastText', 'XGBoost', 'NLP'],
    highlight: { value: 'fastText', label: '0.98 macro-AUC' },
    code: TOXIC_COMMENT_PROJECT,
  },
];
