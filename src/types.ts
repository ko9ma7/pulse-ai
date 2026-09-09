export type RadarCategory =
  | 'Agent'
  | 'MCP'
  | 'Coding'
  | 'LLM'
  | 'Local AI'
  | 'RAG'
  | 'Computer Use'
  | 'AI Image'
  | 'AI Video';

export type TrendPoint = {
  date: string;
  gained: number;
  total: number;
};

export type RepoPulseRepository = {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  url: string;
  description: string;
  categories: RadarCategory[];
  topics: string[];
  language: string | null;
  license: string | null;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  latestReleaseAt: string | null;
  latestReleaseName: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  star24h: number;
  star7d: number;
  starPrev7d: number;
  star30d: number;
  star90d: number;
  star365d: number;
  velocity7d: number;
  acceleration: number;
  freshnessDays: number;
  activityScore: number;
  readmeScore: number;
  testabilityScore: number;
  earlySignalScore: number;
  blogScore: number;
  blogRecommendation: '오늘 작성 권장' | '이번 주 검토' | '관찰 유지';
  testingDifficulty: 'Easy' | 'Medium' | 'Hard';
  installCommand: string | null;
  whyTrending: string[];
  tryThis: string[];
  blogAngles: string[];
  history: TrendPoint[];
};

export type RadarData = {
  generatedAt: string;
  source: {
    mode: 'live' | 'demo';
    apiVersion: string;
    note: string;
  };
  summary: {
    scannedRepositories: number;
    qualifiedRepositories: number;
    fastest24hRepo: string | null;
    averageSignal: number;
  };
  repositories: RepoPulseRepository[];
};

export type WatchRecord = {
  fullName: string;
  watchedAt: string;
  starsAtWatch: number;
};
