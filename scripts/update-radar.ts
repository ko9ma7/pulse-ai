import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { API_VERSION, CATEGORY_QUERIES, MAX_CANDIDATES, MIN_STARS, OUTPUT_LIMIT } from './config';
import { delay, getLatestRelease, getStarHistory, searchRepositories, type GitHubRepo } from './github';
import { enrichRepository } from './scoring';

type Category = (typeof CATEGORY_QUERIES)[number]['category'];
type Candidate = { repo: GitHubRepo; categories: Set<Category> };

type CompactRepo = {
  fullName: string;
  stars: number;
  star24h: number;
  star7d: number;
  star30d: number;
  star90d: number;
  star365d: number;
  signal: number;
  acceleration: number;
  categories: Category[];
};

type CategorySummary = {
  repositories: number;
  totalStars: number;
  star24h: number;
  star7d: number;
  star30d: number;
  star90d: number;
  star365d: number;
  averageSignal: number;
  averageAcceleration: number;
  leader: string | null;
};

type ArchiveSnapshot = {
  at: string;
  summary: {
    repositories: number;
    qualifiedRepositories: number;
    averageSignal: number;
    star24h: number;
    star7d: number;
    fastest24hRepo: string | null;
  };
  categories: Record<string, CategorySummary>;
  repositories: CompactRepo[];
};

type RadarArchive = {
  schemaVersion: 2;
  trackingStartedAt: string;
  updatedAt: string;
  cadenceHours: number;
  intradayRetentionDays: number;
  dailyRetentionDays: number;
  snapshots: ArchiveSnapshot[];
  daily: ArchiveSnapshot[];
};

const categories = CATEGORY_QUERIES.map((group) => group.category);
const candidates = new Map<string, Candidate>();
const archivePath = resolve('public/data/radar-history.json');

async function readArchive(): Promise<RadarArchive | null> {
  try {
    const parsed = JSON.parse(await readFile(archivePath, 'utf8')) as RadarArchive;
    if (!Array.isArray(parsed.snapshots) || !Array.isArray(parsed.daily)) return null;
    return parsed;
  } catch {
    return null;
  }
}

const priorArchive = await readArchive();
const now = new Date();
const nowIso = now.toISOString();

function inferCategories(repo: GitHubRepo, seeded: Iterable<Category>): Set<Category> {
  const result = new Set<Category>(seeded);
  const text = `${repo.name} ${repo.description ?? ''} ${(repo.topics ?? []).join(' ')}`.toLowerCase();
  const rules: Array<[Category, RegExp]> = [
    ['Agent', /\b(agent|agentic|multi-agent|multiagent|autonomous agent)\b/],
    ['MCP', /\b(mcp|model context protocol)\b/],
    ['Coding', /\b(coding agent|code agent|codegen|code generation|copilot|vibe coding|developer agent)\b/],
    ['LLM', /\b(llm|large language model|language model|transformer|inference engine)\b/],
    ['Local AI', /\b(local ai|local llm|on-device|ollama|llama\.cpp|gguf)\b/],
    ['RAG', /\b(rag|retrieval augmented|retrieval-augmented|vector search|embedding search)\b/],
    ['Computer Use', /\b(computer use|browser agent|browser automation|gui agent|desktop agent)\b/],
    ['AI Image', /\b(image generation|text-to-image|diffusion|stable diffusion|flux\.1|comfyui)\b/],
    ['AI Video', /\b(video generation|text-to-video|image-to-video|video diffusion)\b/],
  ];
  for (const [category, pattern] of rules) if (pattern.test(text)) result.add(category);
  return result;
}

function starsAbout24HoursAgo(fullName: string): number | null {
  if (!priorArchive) return null;
  const target = now.getTime() - 24 * 60 * 60 * 1000;
  const pool = [...priorArchive.snapshots, ...priorArchive.daily];
  let best: { diff: number; stars: number } | null = null;
  for (const snapshot of pool) {
    const age = Math.abs(new Date(snapshot.at).getTime() - target);
    if (age > 12 * 60 * 60 * 1000) continue;
    const repo = snapshot.repositories.find((item) => item.fullName === fullName);
    if (!repo) continue;
    if (!best || age < best.diff) best = { diff: age, stars: repo.stars };
  }
  return best?.stars ?? null;
}

function compact(item: ReturnType<typeof enrichRepository>): CompactRepo {
  return {
    fullName: item.fullName,
    stars: item.stars,
    star24h: item.star24h,
    star7d: item.star7d,
    star30d: item.star30d,
    star90d: item.star90d,
    star365d: item.star365d,
    signal: item.earlySignalScore,
    acceleration: Number(item.acceleration.toFixed(4)),
    categories: item.categories,
  };
}

function sum(items: CompactRepo[], key: keyof Pick<CompactRepo, 'stars' | 'star24h' | 'star7d' | 'star30d' | 'star90d' | 'star365d'>) {
  return items.reduce((total, item) => total + Number(item[key]), 0);
}

function buildCategorySummaries(items: CompactRepo[]) {
  const result: Record<string, CategorySummary> = {};
  for (const category of categories) {
    const matches = items.filter((item) => item.categories.includes(category));
    const leader = [...matches].sort((a, b) => b.star7d - a.star7d)[0]?.fullName ?? null;
    result[category] = {
      repositories: matches.length,
      totalStars: sum(matches, 'stars'),
      star24h: sum(matches, 'star24h'),
      star7d: sum(matches, 'star7d'),
      star30d: sum(matches, 'star30d'),
      star90d: sum(matches, 'star90d'),
      star365d: sum(matches, 'star365d'),
      averageSignal: matches.length ? Math.round(matches.reduce((total, item) => total + item.signal, 0) / matches.length) : 0,
      averageAcceleration: matches.length ? Number((matches.reduce((total, item) => total + item.acceleration, 0) / matches.length).toFixed(2)) : 0,
      leader,
    };
  }
  return result;
}

// Search every configured synonym, but deliberately pace requests below the
// Search API's normal authenticated rate limit.
for (const group of CATEGORY_QUERIES) {
  for (const term of group.terms) {
    for (const band of [`stars:${MIN_STARS}..999`, 'stars:1000..20000']) {
      const query = `${term} in:name,description,topics ${band} archived:false`;
      try {
        const repos = await searchRepositories(query);
        for (const repo of repos) {
          const existing = candidates.get(repo.full_name);
          if (existing) existing.categories.add(group.category);
          else candidates.set(repo.full_name, { repo, categories: new Set([group.category]) });
        }
      } catch (error) {
        console.warn(`[search] ${group.category} / ${term} / ${band}:`, error instanceof Error ? error.message : error);
      }
      await delay(2300);
    }
  }
}

for (const candidate of candidates.values()) {
  candidate.categories = inferCategories(candidate.repo, candidate.categories);
}

const selected = [...candidates.values()]
  .filter(({ repo }) => !repo.archived && !repo.fork && repo.stargazers_count >= MIN_STARS)
  .sort((a, b) => new Date(b.repo.pushed_at).getTime() - new Date(a.repo.pushed_at).getTime())
  .slice(0, MAX_CANDIDATES);

console.log(`Discovered ${candidates.size} unique repositories; checking up to one year of history for ${selected.length}.`);

const withHistory: Array<{ candidate: Candidate; weeks: Awaited<ReturnType<typeof getStarHistory>> }> = [];
for (let i = 0; i < selected.length; i += 5) {
  const batch = selected.slice(i, i + 5);
  const results = await Promise.all(batch.map(async (candidate) => {
    try {
      const weeks = await getStarHistory(candidate.repo.full_name);
      return weeks.length ? { candidate, weeks } : null;
    } catch (error) {
      console.warn(`[history] ${candidate.repo.full_name}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }));
  withHistory.push(...results.filter((value): value is NonNullable<typeof value> => value !== null));
  await delay(320);
}

let enriched = withHistory.map(({ candidate, weeks }) => enrichRepository(candidate.repo, [...candidate.categories], weeks, null));
enriched.sort((a, b) => b.earlySignalScore - a.earlySignalScore);

const releaseMap = new Map<string, Awaited<ReturnType<typeof getLatestRelease>>>();
for (let i = 0; i < Math.min(35, enriched.length); i += 5) {
  const batch = enriched.slice(i, i + 5);
  const releases = await Promise.all(batch.map(async (item) => {
    try { return [item.fullName, await getLatestRelease(item.fullName)] as const; }
    catch { return [item.fullName, null] as const; }
  }));
  releases.forEach(([fullName, release]) => releaseMap.set(fullName, release));
  await delay(240);
}

enriched = withHistory.map(({ candidate, weeks }) => {
  const item = enrichRepository(candidate.repo, [...candidate.categories], weeks, releaseMap.get(candidate.repo.full_name) ?? null);
  const priorStars = starsAbout24HoursAgo(item.fullName);
  return priorStars === null ? item : { ...item, star24h: Math.max(0, item.stars - priorStars) };
});
enriched.sort((a, b) => b.earlySignalScore - a.earlySignalScore);
const outputRepos = enriched.slice(0, OUTPUT_LIMIT);

if (outputRepos.length < 5) {
  throw new Error(`Safety stop: only ${outputRepos.length} repositories were enriched. Existing radar data was not overwritten.`);
}

const data = {
  generatedAt: nowIso,
  source: {
    mode: 'live' as const,
    apiVersion: API_VERSION,
    refreshCadenceHours: 6,
    historyCoverageDays: 365,
    note: 'Generated by GitHub Actions using Repository Search and privacy-safe Star History REST API. This is a periodically refreshed static snapshot, not a streaming feed.',
  },
  summary: {
    scannedRepositories: selected.length,
    qualifiedRepositories: outputRepos.filter((repo) => repo.earlySignalScore >= 65).length,
    fastest24hRepo: [...outputRepos].sort((a, b) => b.star24h - a.star24h)[0]?.fullName ?? null,
    averageSignal: outputRepos.length ? Math.round(outputRepos.reduce((total, repo) => total + repo.earlySignalScore, 0) / outputRepos.length) : 0,
  },
  repositories: outputRepos,
};

const compactRepos = outputRepos.map(compact);
const snapshot: ArchiveSnapshot = {
  at: nowIso,
  summary: {
    repositories: compactRepos.length,
    qualifiedRepositories: compactRepos.filter((repo) => repo.signal >= 65).length,
    averageSignal: compactRepos.length ? Math.round(compactRepos.reduce((total, repo) => total + repo.signal, 0) / compactRepos.length) : 0,
    star24h: sum(compactRepos, 'star24h'),
    star7d: sum(compactRepos, 'star7d'),
    fastest24hRepo: [...compactRepos].sort((a, b) => b.star24h - a.star24h)[0]?.fullName ?? null,
  },
  categories: buildCategorySummaries(compactRepos),
  repositories: compactRepos,
};

const trackingStartedAt = priorArchive?.trackingStartedAt ?? nowIso;
const snapshots = [...(priorArchive?.snapshots ?? []), snapshot]
  .filter((entry) => now.getTime() - new Date(entry.at).getTime() <= 30 * 86_400_000)
  .slice(-140);

const dateKey = nowIso.slice(0, 10);
const priorDaily = (priorArchive?.daily ?? []).filter((entry) => entry.at.slice(0, 10) !== dateKey);
const daily = [...priorDaily, snapshot]
  .filter((entry) => now.getTime() - new Date(entry.at).getTime() <= 730 * 86_400_000)
  .slice(-730);

const archive: RadarArchive = {
  schemaVersion: 2,
  trackingStartedAt,
  updatedAt: nowIso,
  cadenceHours: 6,
  intradayRetentionDays: 30,
  dailyRetentionDays: 730,
  snapshots,
  daily,
};

const latestPaths = [resolve('public/data/repositories.json'), resolve('docs/data/repositories.json')];
const archivePaths = [resolve('public/data/radar-history.json'), resolve('docs/data/radar-history.json')];
for (const outputPath of latestPaths) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Wrote ${outputRepos.length} repositories to ${outputPath}.`);
}
for (const outputPath of archivePaths) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(archive, null, 2)}\n`);
  console.log(`Wrote archive (${archive.snapshots.length} intraday / ${archive.daily.length} daily) to ${outputPath}.`);
}
