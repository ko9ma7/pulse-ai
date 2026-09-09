import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { API_VERSION, CATEGORY_QUERIES, MIN_STARS } from './config';
import { delay, getStarHistory, searchRepositories, type GitHubRepo, type StarWeek } from './github';

type Category = (typeof CATEGORY_QUERIES)[number]['category'];
type Candidate = {
  fullName: string;
  categories: Set<Category>;
  stars: number;
  createdAt: string;
  description: string;
  language: string | null;
  url: string;
  source: 'current-radar' | 'historical-search';
};

type DailyPoint = { date: string; gained: number; total: number };
type HistoricalRank = {
  fullName: string;
  categories: Category[];
  starsAt: number;
  star7d: number;
  star30d: number;
  velocity7d: number;
  acceleration: number;
  momentumScore: number;
};
type HistoricalSnapshot = {
  at: string;
  repositories: number;
  star7d: number;
  star30d: number;
  averageMomentum: number;
  leaders: HistoricalRank[];
  categories: Record<string, HistoricalRank[]>;
};

type CurrentRadar = {
  repositories?: Array<{
    fullName: string;
    categories: Category[];
    stars: number;
    createdAt: string;
    description: string;
    language: string | null;
    url: string;
  }>;
};

const months = Math.max(1, Math.min(18, Number(process.env.BACKFILL_MONTHS || 12)));
const maxRepos = Math.max(60, Math.min(300, Number(process.env.BACKFILL_MAX_REPOS || 180)));
const topPerSnapshot = Math.max(20, Math.min(80, Number(process.env.BACKFILL_TOP || 40)));
const output = resolve('public/data/historical-backfill.json');
const currentPath = resolve('public/data/repositories.json');
const DAY = 86_400_000;
const WEEK = 7 * DAY;
const now = new Date();
const startDate = new Date(now.getTime() - months * 31 * DAY);
const candidates = new Map<string, Candidate>();

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addCandidate(candidate: Candidate) {
  const existing = candidates.get(candidate.fullName);
  if (!existing) {
    candidates.set(candidate.fullName, candidate);
    return;
  }
  for (const category of candidate.categories) existing.categories.add(category);
  if (candidate.stars > existing.stars) existing.stars = candidate.stars;
}

function inferCategories(repo: Pick<GitHubRepo, 'name' | 'description' | 'topics'>, seeded: Iterable<Category>) {
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

function monthWindows(count: number) {
  const windows: Array<{ start: string; end: string }> = [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let i = 0; i < count; i += 1) {
    const end = new Date(cursor.getTime() - 1);
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    windows.unshift({ start: isoDate(start), end: isoDate(end) });
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }
  // Include the current partial month as the newest window.
  windows.push({ start: isoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))), end: isoDate(now) });
  return windows.slice(-(count + 1));
}

function flattenWeeks(stars: number, weeks: StarWeek[]): DailyPoint[] {
  const byDate = new Map<string, number>();
  for (const bucket of weeks) {
    for (let i = 0; i < bucket.days.length; i += 1) {
      const date = new Date((bucket.week + i * 86_400) * 1000);
      if (date.getTime() > now.getTime() + DAY) continue;
      const key = isoDate(date);
      byDate.set(key, (byDate.get(key) ?? 0) + Number(bucket.days[i] ?? 0));
    }
  }
  const raw = [...byDate.entries()]
    .map(([date, gained]) => ({ date, gained }))
    .filter((point) => new Date(`${point.date}T00:00:00Z`).getTime() >= startDate.getTime() - 14 * DAY)
    .sort((a, b) => a.date.localeCompare(b.date));
  const totalHistoryGain = raw.reduce((sum, point) => sum + point.gained, 0);
  let running = Math.max(0, stars - totalHistoryGain);
  return raw.map((point) => {
    running += point.gained;
    return { ...point, total: running };
  });
}

function gainBetween(points: DailyPoint[], endDate: string, days: number) {
  const end = new Date(`${endDate}T23:59:59Z`).getTime();
  const start = end - (days - 1) * DAY;
  return points.reduce((sum, point) => {
    const time = new Date(`${point.date}T12:00:00Z`).getTime();
    return time >= start && time <= end ? sum + point.gained : sum;
  }, 0);
}

function totalAt(points: DailyPoint[], currentStars: number, date: string) {
  const end = new Date(`${date}T23:59:59Z`).getTime();
  const after = points.reduce((sum, point) => {
    const time = new Date(`${point.date}T12:00:00Z`).getTime();
    return time > end ? sum + point.gained : sum;
  }, 0);
  return Math.max(0, currentStars - after);
}

function metricsAt(candidate: Candidate, points: DailyPoint[], date: string): HistoricalRank | null {
  const starsAt = totalAt(points, candidate.stars, date);
  if (starsAt < MIN_STARS) return null;
  const star7d = gainBetween(points, date, 7);
  const star30d = gainBetween(points, date, 30);
  const previousEnd = new Date(new Date(`${date}T00:00:00Z`).getTime() - 7 * DAY);
  const prev7 = gainBetween(points, isoDate(previousEnd), 7);
  const velocity7d = starsAt > 0 ? (star7d / starsAt) * 100 : 0;
  const acceleration = (star7d + 5) / (prev7 + 5);
  const ageDays = Math.max(0, (new Date(`${date}T00:00:00Z`).getTime() - new Date(candidate.createdAt).getTime()) / DAY);
  const freshness = ageDays <= 30 ? 100 : ageDays >= 730 ? 10 : 100 - ((ageDays - 30) / 700) * 90;
  const absoluteMomentum = Math.min(100, (Math.log10(star7d + 1) / 3.25) * 65);
  const relativeMomentum = Math.min(100, (velocity7d / 45) * 35);
  const velocityScore = Math.min(100, absoluteMomentum + relativeMomentum);
  const accelerationScore = Math.max(0, Math.min(100, 50 + Math.log2(Math.max(0.15, acceleration)) * 24));
  // Historical activity/release state cannot be reconstructed reliably from this endpoint.
  // This deliberately uses a separate "momentumScore" instead of pretending it is the live Early Signal Score.
  const momentumScore = Math.round(velocityScore * 0.65 + accelerationScore * 0.25 + freshness * 0.10);
  return {
    fullName: candidate.fullName,
    categories: [...candidate.categories],
    starsAt,
    star7d,
    star30d,
    velocity7d: Number(velocity7d.toFixed(2)),
    acceleration: Number(acceleration.toFixed(3)),
    momentumScore,
  };
}

function weeklyDates() {
  const dates: string[] = [];
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (let cursor = new Date(end); cursor.getTime() >= startDate.getTime(); cursor = new Date(cursor.getTime() - WEEK)) {
    dates.unshift(isoDate(cursor));
  }
  return dates;
}

console.log(`RepoPulse 1Y backfill: months=${months}, maxRepos=${maxRepos}`);

try {
  const current = JSON.parse(await readFile(currentPath, 'utf8')) as CurrentRadar;
  for (const repo of current.repositories ?? []) {
    addCandidate({
      fullName: repo.fullName,
      categories: new Set(repo.categories),
      stars: repo.stars,
      createdAt: repo.createdAt,
      description: repo.description,
      language: repo.language,
      url: repo.url,
      source: 'current-radar',
    });
  }
  console.log(`Seeded ${candidates.size} repositories from the current Radar.`);
} catch (error) {
  console.warn('Could not seed from current Radar:', error instanceof Error ? error.message : error);
}

// Discover repositories that were created during the backfill window. This is not a
// full historical market census; GH Archive BigQuery is provided separately for that.
for (const window of monthWindows(months)) {
  for (const group of CATEGORY_QUERIES) {
    const term = group.terms[0];
    const query = `${term} in:name,description,topics created:${window.start}..${window.end} stars:${MIN_STARS}..50000 archived:false`;
    try {
      const repos = await searchRepositories(query, { sort: 'stars', order: 'desc', perPage: 20 });
      for (const repo of repos) {
        if (repo.fork || repo.archived) continue;
        const inferred = inferCategories(repo, [group.category]);
        addCandidate({
          fullName: repo.full_name,
          categories: inferred,
          stars: repo.stargazers_count,
          createdAt: repo.created_at,
          description: repo.description ?? '',
          language: repo.language,
          url: repo.html_url,
          source: 'historical-search',
        });
      }
    } catch (error) {
      console.warn(`[search ${window.start}] ${group.category}:`, error instanceof Error ? error.message : error);
    }
    await delay(2200);
  }
}

const currentSeeds = [...candidates.values()].filter((item) => item.source === 'current-radar');
const discovered = [...candidates.values()].filter((item) => item.source === 'historical-search');
const balanced: Candidate[] = [...currentSeeds];
const seen = new Set(balanced.map((item) => item.fullName));
const perCategory = Math.max(8, Math.ceil((maxRepos - balanced.length) / CATEGORY_QUERIES.length));
for (const group of CATEGORY_QUERIES) {
  const matches = discovered
    .filter((item) => item.categories.has(group.category) && !seen.has(item.fullName))
    .sort((a, b) => b.stars - a.stars)
    .slice(0, perCategory);
  for (const item of matches) {
    if (balanced.length >= maxRepos) break;
    balanced.push(item);
    seen.add(item.fullName);
  }
}
for (const item of discovered.sort((a, b) => b.stars - a.stars)) {
  if (balanced.length >= maxRepos) break;
  if (seen.has(item.fullName)) continue;
  balanced.push(item);
  seen.add(item.fullName);
}

console.log(`Historical candidate pool: ${candidates.size}; fetching Star History for ${balanced.length}.`);

const histories = new Map<string, DailyPoint[]>();
const usable: Candidate[] = [];
for (let i = 0; i < balanced.length; i += 4) {
  const batch = balanced.slice(i, i + 4);
  const results = await Promise.all(batch.map(async (candidate) => {
    try {
      const weeks = await getStarHistory(candidate.fullName);
      const points = flattenWeeks(candidate.stars, weeks);
      return points.length ? { candidate, points } : null;
    } catch (error) {
      console.warn(`[history] ${candidate.fullName}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }));
  for (const result of results) {
    if (!result) continue;
    histories.set(result.candidate.fullName, result.points);
    usable.push(result.candidate);
  }
  if (i + 4 < balanced.length) await delay(850);
}

const snapshots: HistoricalSnapshot[] = weeklyDates().map((date) => {
  const ranks = usable
    .map((candidate) => metricsAt(candidate, histories.get(candidate.fullName) ?? [], date))
    .filter((item): item is HistoricalRank => Boolean(item))
    .sort((a, b) => b.momentumScore - a.momentumScore || b.star7d - a.star7d);
  const categoryRanks: Record<string, HistoricalRank[]> = {};
  for (const group of CATEGORY_QUERIES) {
    categoryRanks[group.category] = ranks.filter((item) => item.categories.includes(group.category)).slice(0, 20);
  }
  return {
    at: `${date}T23:59:59.000Z`,
    repositories: ranks.length,
    star7d: ranks.reduce((sum, item) => sum + item.star7d, 0),
    star30d: ranks.reduce((sum, item) => sum + item.star30d, 0),
    averageMomentum: ranks.length ? Math.round(ranks.reduce((sum, item) => sum + item.momentumScore, 0) / ranks.length) : 0,
    leaders: ranks.slice(0, topPerSnapshot),
    categories: categoryRanks,
  };
});

const repositoryHistory = usable.map((candidate) => ({
  fullName: candidate.fullName,
  categories: [...candidate.categories],
  currentStars: candidate.stars,
  createdAt: candidate.createdAt,
  description: candidate.description,
  language: candidate.language,
  url: candidate.url,
  discoverySource: candidate.source,
  history: histories.get(candidate.fullName) ?? [],
}));

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  range: { months, start: isoDate(startDate), end: isoDate(now) },
  source: {
    type: 'github-star-history-reconstruction',
    apiVersion: API_VERSION,
    endpoint: 'GET /repos/{owner}/{repo}/stargazers/history',
    cohort: 'current Radar + AI repositories created during the requested historical window',
    note: 'Historical Momentum is reconstructed from official GitHub star-growth buckets. It is intentionally distinct from the live Early Signal Score because historical commit/release/README state is not fully reconstructed.',
  },
  limitations: [
    'This is not a complete census of every repository that was popular at each historical date.',
    'Repositories that trended in the past but are no longer discoverable by the current Radar or historical creation-window search can be missing.',
    'GitHub notes that Star History week/day boundaries are not guaranteed to align with UTC; displayed dates are normalized for analysis.',
    'For a broader historical market census, use the bundled GH Archive BigQuery query and import its WatchEvent result set.',
  ],
  summary: {
    candidatesDiscovered: candidates.size,
    repositoriesBackfilled: repositoryHistory.length,
    weeklySnapshots: snapshots.length,
  },
  snapshots,
  repositories: repositoryHistory,
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await mkdir(resolve('docs/data'), { recursive: true });
await writeFile(resolve('docs/data/historical-backfill.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Wrote ${output}: ${repositoryHistory.length} repositories, ${snapshots.length} weekly snapshots.`);
