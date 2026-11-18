// Central site content. Edit copy here; layout lives in components.
import portrait from '../assets/portrait.jpg';

// The hero renders `employer` as a logo chip; `role` is the plain-text form.
const title = 'Machine Learning';
const employer = 'Meta';

export const site = {
  name: 'Mihir Rana',
  title,
  employer,
  role: `${title} at ${employer}`,
  // Hero greeting + a playful aside, rendered as the page's <h1>.
  greeting: 'Hi, I’m Mihir.',
  aside:
    '(I help decide what shows up in your feed. You’re welcome, or I’m sorry, depending on your feed.)',
  // Conversational bio. Wrap phrases in **double asterisks** to bold them.
  bio: [
    'I’m a machine learning engineer at **Meta**, working on the ranking models that decide which **Threads** posts land in your Instagram and Facebook feeds.',
    'Before that I spent nearly seven years at **Tripadvisor**, where I built their **generative AI travel assistant**, led **computer vision** efforts, and built a lot of **recommenders** along the way. My favorite part of the job is taking an idea from a research paper all the way to something people actually use.',
  ],
  // Printed by the `fun-facts` command in the hero terminal. Swap in your own.
  funFacts: [
    'Was a teaching assistant for Yann LeCun’s Deep Learning course at NYU.',
    'Built an all-terrain vehicle from scratch during my major in mechanical engineering at IIT, before switching lanes to machine learning.',
  ],
  // Portrait shown in the hero: a 4:5 image in src/assets/. Astro resizes it and
  // serves AVIF/WebP. Strip EXIF/GPS metadata before committing a new photo.
  portrait,
  location: 'New York, NY',
  email: 'ranamihir@gmail.com',
  socials: [
    // `icon` must be a key in src/components/Icon.astro.
    { label: 'GitHub', handle: 'ranamihir', url: 'https://github.com/ranamihir', icon: 'github' },
    {
      label: 'LinkedIn',
      handle: 'ranamihir',
      url: 'https://www.linkedin.com/in/ranamihir',
      icon: 'linkedin',
    },
  ],
} as const;

export const education = [
  {
    school: 'New York University',
    degree: 'M.S. in Data Science',
    detail:
      'GPA 3.95 / 4.0 · Teaching Assistant for Deep Learning (Yann LeCun), Computer Vision (Rob Fergus), and Machine Learning (David Rosenberg).',
    location: 'New York, NY',
    period: '2017 – 2019',
    // Shown only by `education nyu` in the hero terminal.
    coursework: [
      'Deep Learning',
      'Computer Vision',
      'Natural Language Processing',
      'Natural Language Understanding',
      'Reinforcement Learning',
      'Machine Learning',
      'Variational Inference',
      'Big Data',
      'Optimization Theory',
      'Probability and Statistics',
    ],
  },
  {
    school: 'Indian Institute of Technology (IIT), Roorkee',
    degree: 'B.Tech, Mechanical Engineering · Minor in Computer Science',
    detail: 'GPA 4.0 / 4.0.',
    location: 'Roorkee, India',
    period: '2013 – 2017',
    // Shown only by `education iit` in the hero terminal.
    coursework: [
      'Design and Analysis of Algorithms',
      'Data Structures',
      'Database Management Systems',
      'Discrete Structures',
      'Computer Architecture and Microprocessors',
      'Numerical Optimization',
      'Numerical Algorithms',
      'Calculus',
    ],
  },
] as const;

export const skills = [
  {
    group: 'Languages',
    items: ['Python', 'C++', 'Java', 'PHP', 'SQL', 'Shell'],
  },
  {
    group: 'ML & AI',
    items: [
      'PyTorch',
      'LangChain',
      'Ray / Anyscale',
      'Kubeflow',
      'MLflow',
      'TensorBoard',
      'Weights & Biases',
      'Arize',
      'Seldon',
      'Streamlit',
      'Gradio',
    ],
  },
  {
    group: 'Data & Infra',
    items: ['Spark', 'Snowflake', 'BigQuery', 'Hive', 'Qdrant', 'AWS S3', 'Docker', 'FastAPI'],
  },
] as const;
