import { API_VERSION } from './config';

export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  fork: boolean;
  archived: boolean;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  topics?: string[];
  license: { spdx_id: string | null; name?: string } | null;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  homepage?: string | null;
  owner: { login: string };
};

type SearchResponse = { items: GitHubRepo[] };
export type StarWeek = { week: number; total: number; days: number[] };
export type Release = { name: string | null; tag_name: string; published_at: string | null };

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

async function request<T>(url: string, allow404 = false): Promise<T | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
    'User-Agent': 'RepoPulse-AI',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers });
  if (allow404 && response.status === 404) return null;
  if (!response.ok) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    throw new Error(`GitHub API ${response.status} ${response.statusText} (${url}) remaining=${remaining ?? '?'}`);
  }
  return response.json() as Promise<T>;
}

export async function searchRepositories(
  query: string,
  options: { sort?: 'updated' | 'stars'; order?: 'asc' | 'desc'; perPage?: number } = {},
): Promise<GitHubRepo[]> {
  const params = new URLSearchParams({
    q: query,
    sort: options.sort ?? 'updated',
    order: options.order ?? 'desc',
    per_page: String(Math.min(100, Math.max(1, options.perPage ?? 12))),
  });
  const result = await request<SearchResponse>(`https://api.github.com/search/repositories?${params}`);
  return result?.items ?? [];
}


// The Star History endpoint returns weekly buckets. Two pages x 30 weeks gives
// enough daily points for a one-year view while staying comfortably within the
// normal GitHub Actions API budget.
export async function getStarHistory(fullName: string): Promise<StarWeek[]> {
  const pages = await Promise.all([1, 2].map(async (page) => {
    const result = await request<StarWeek[]>(
      `https://api.github.com/repos/${fullName}/stargazers/history?per_page=30&page=${page}`,
    );
    return result ?? [];
  }));
  return pages.flat();
}

export async function getLatestRelease(fullName: string): Promise<Release | null> {
  return request<Release>(`https://api.github.com/repos/${fullName}/releases/latest`, true);
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
