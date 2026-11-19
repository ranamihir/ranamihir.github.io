// Curated experience: impact-first, not a resume dump.

// Tile shown beside a company or school name (see src/components/OrgLogo.astro).
export type OrgLogoName = 'meta' | 'tripadvisor' | 'nyu' | 'iitr';

export interface Role {
  title: string;
  period?: string;
}

export interface Experience {
  company: string;
  location: string;
  url?: string;
  logo?: OrgLogoName;
  period: string;
  roles: Role[];
  // Prose paragraphs, rendered as-is (no bullets).
  about: string[];
  stack: string[];
}

export const experience: Experience[] = [
  {
    company: 'Meta',
    location: 'New York, NY',
    url: 'https://about.meta.com',
    logo: 'meta',
    period: '2026 – Present',
    roles: [{ title: 'Machine Learning Engineer' }],
    about: [
      'I’m on the Threads Content Relevance team, working on the late-stage ranking models that decide which Threads posts show up in Instagram and Facebook feeds. My work spans modeling, content quality, and new ranking signals.',
    ],
    stack: ['PyTorch', 'C++', 'Hack', 'Lua'],
  },
  {
    company: 'Tripadvisor',
    location: 'New York, NY',
    url: 'https://www.tripadvisor.com',
    logo: 'tripadvisor',
    period: '2019 – 2026',
    roles: [{ title: 'Principal Machine Learning Engineer' }],
    about: [
      'I built the [Tripadvisor AI assistant](https://www.businessinsider.com/tripadvisor-free-ai-planning-tool-pros-cons-2024-2), an agentic LLM travel companion that uses first-party tools for recommendations, itinerary planning, and Q&A. I also built the trip itinerary builder, which pairs a 20B-parameter LLM with in-house recommenders, geo-spatial entity resolution, and more than a billion user reviews.',
      'Before that, I led computer vision at the company: models for image attractiveness, quality, sorting, moderation, and scene understanding across more than 600 million images.',
      'I also worked on LLM-based recommendation modeling that combined semantic search and BM25 over reviews, forums, and location metadata, personalized models for Experiences, and recommenders for SEO/SEM landing pages.',
    ],
    stack: ['PyTorch', 'LangChain', 'FastAPI', 'Qdrant', 'Ray', 'Kubeflow', 'Snowflake', 'Spark'],
  },
];
