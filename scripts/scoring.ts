import type { GitHubRepo, Release, StarWeek } from './github';

type Category = 'Agent' | 'MCP' | 'Coding' | 'LLM' | 'Local AI' | 'RAG' | 'Computer Use' | 'AI Image' | 'AI Video';
type TrendPoint = { date: string; gained: number; total: number };

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const daysSince = (iso: string | null) => iso ? Math.max(0, (Date.now() - new Date(iso).getTime()) / 86_400_000) : 9999;

export function historyMetrics(stars: number, weeks: StarWeek[]) {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const daily = weeks
    .flatMap((week) => week.days.map((gained, index) => {
      const date = new Date(week.week * 1000);
      date.setUTCDate(date.getUTCDate() + index);
      return { date: date.toISOString().slice(0, 10), gained };
    }))
    .filter((point) => point.date <= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date));

  const unique = [...new Map(daily.map((point) => [point.date, point])).values()];
  const recent365 = unique.slice(-365);
  const recent90 = unique.slice(-90);
  const recent30 = unique.slice(-30);
  const recent7 = unique.slice(-7);
  const previous7 = unique.slice(-14, -7);
  const star24h = unique.at(-1)?.gained ?? 0;
  const star7d = recent7.reduce((sum, point) => sum + point.gained, 0);
  const starPrev7d = previous7.reduce((sum, point) => sum + point.gained, 0);
  const star30d = recent30.reduce((sum, point) => sum + point.gained, 0);
  const star90d = recent90.reduce((sum, point) => sum + point.gained, 0);
  const star365d = recent365.reduce((sum, point) => sum + point.gained, 0);
  const velocity7d = stars > 0 ? (star7d / stars) * 100 : 0;
  const acceleration = (star7d + 5) / (starPrev7d + 5);
  let running = Math.max(0, stars - star365d);
  const history: TrendPoint[] = recent365.map((point) => {
    running += point.gained;
    return { ...point, total: running };
  });
  return { star24h, star7d, starPrev7d, star30d, star90d, star365d, velocity7d, acceleration, history };
}

function activityScore(repo: GitHubRepo, release: Release | null) {
  const pushedDays = daysSince(repo.pushed_at);
  const releaseDays = daysSince(release?.published_at ?? null);
  const pushScore = clamp(100 - pushedDays * 4);
  const releaseScore = release ? clamp(100 - releaseDays * 1.8) : 35;
  return Math.round(pushScore * 0.7 + releaseScore * 0.3);
}

function freshnessScore(repo: GitHubRepo) {
  const age = daysSince(repo.created_at);
  if (age <= 30) return 100;
  if (age >= 730) return 10;
  return Math.round(100 - ((age - 30) / 700) * 90);
}

function metadataReadmeScore(repo: GitHubRepo) {
  let score = 35;
  if ((repo.description?.length ?? 0) > 35) score += 20;
  if ((repo.topics?.length ?? 0) >= 3) score += 20;
  if (repo.license?.spdx_id) score += 15;
  if (repo.homepage) score += 10;
  return clamp(score);
}

function testabilityScore(repo: GitHubRepo) {
  let score = 52;
  const easyLanguages = new Set(['Python', 'TypeScript', 'JavaScript', 'Go', 'Rust']);
  if (repo.language && easyLanguages.has(repo.language)) score += 18;
  if (repo.license?.spdx_id) score += 10;
  if (repo.description) score += 8;
  if ((repo.topics?.length ?? 0) >= 2) score += 7;
  if (repo.homepage) score += 5;
  return clamp(score);
}

function earlySignal(metrics: ReturnType<typeof historyMetrics>, activity: number, freshness: number, readme: number, testability: number) {
  const absoluteMomentum = clamp((Math.log10(metrics.star7d + 1) / 3.25) * 65);
  const relativeMomentum = clamp((metrics.velocity7d / 45) * 35);
  const velocity = clamp(absoluteMomentum + relativeMomentum);
  const acceleration = clamp(50 + Math.log2(Math.max(0.15, metrics.acceleration)) * 24);
  return Math.round(velocity * 0.35 + acceleration * 0.20 + activity * 0.15 + freshness * 0.10 + readme * 0.10 + testability * 0.10);
}

function classifyDifficulty(testability: number): 'Easy' | 'Medium' | 'Hard' {
  return testability >= 78 ? 'Easy' : testability >= 58 ? 'Medium' : 'Hard';
}

const templates: Record<Category, string[]> = {
  Agent: ['하나의 반복 업무를 이 Agent에 맡기고 성공률을 기록하기', '두 모델을 연결해 역할 분담형 미니 Agent 만들기', '실패 케이스를 수집해 프롬프트/도구 호출 안정성 비교하기'],
  MCP: ['로컬 파일 검색 MCP를 연결해 개인 지식 도구 만들기', '두 개의 MCP 서버를 한 Agent에서 조합해보기', '권한 범위를 최소화한 MCP 연결 예제 만들기'],
  Coding: ['작은 CRUD 앱을 처음부터 끝까지 생성시켜보기', '동일 요구사항으로 기존 코딩 Agent와 속도/수정 횟수 비교하기', '테스트 실패를 스스로 수정하는 루프 실험하기'],
  LLM: ['작은 벤치마크 입력 20개로 품질/속도 비교하기', '기존 LLM 파이프라인 한 곳을 이 도구로 교체하기', '한국어 입력에서 결과 안정성 확인하기'],
  'Local AI': ['노트북 한 대에서 로컬 실행 메모리 사용량 측정하기', '클라우드 API 대비 응답속도와 비용 비교하기', '오프라인 상태에서 사용할 수 있는 미니 도구 만들기'],
  RAG: ['PDF 10개로 초소형 RAG 검색기를 만들기', '기본 벡터 검색과 결과 품질 비교하기', '한국어 문서에서 검색 누락 사례를 기록하기'],
  'Computer Use': ['브라우저 반복 작업 1개를 자동화해 성공률 측정하기', '실패 시 복구 행동이 가능한지 테스트하기', '스크린샷 기반 작업과 DOM 기반 작업 비교하기'],
  'AI Image': ['같은 프롬프트 10개로 생성 품질과 속도 비교하기', '로컬/클라우드 워크플로를 하나로 묶어보기', '블로그 썸네일 자동 생성 미니 도구 만들기'],
  'AI Video': ['10초 클립 생성 파이프라인을 재현해보기', '동일 프롬프트에서 스타일 일관성 측정하기', '이미지→영상 워크플로 미니 앱 만들기'],
};

export function enrichRepository(repo: GitHubRepo, categories: Category[], weeks: StarWeek[], release: Release | null) {
  const metrics = historyMetrics(repo.stargazers_count, weeks);
  const freshnessDays = Math.round(daysSince(repo.created_at));
  const activity = activityScore(repo, release);
  const freshness = freshnessScore(repo);
  const readme = metadataReadmeScore(repo);
  const testability = testabilityScore(repo);
  const signal = earlySignal(metrics, activity, freshness, readme, testability);
  const blogScore = Math.round(clamp(signal * 0.48 + freshness * 0.18 + testability * 0.18 + clamp(metrics.velocity7d * 2.5) * 0.16));
  const primary = categories[0] ?? 'LLM';
  const accelText = metrics.acceleration >= 1.8 ? `최근 7일 Star 증가가 이전 7일의 ${metrics.acceleration.toFixed(1)}배입니다.` : `최근 7일 Star 증가량이 +${metrics.star7d.toLocaleString('en-US')}입니다.`;
  const velocityText = `현재 Star의 ${metrics.velocity7d.toFixed(1)}%가 최근 7일에 추가됐습니다.`;
  const activityText = daysSince(repo.pushed_at) <= 3 ? '최근 3일 이내 코드 업데이트가 있어 프로젝트 활동성이 높습니다.' : '최근 업데이트 흐름과 Star 상승을 함께 관찰할 가치가 있습니다.';
  const safeName = repo.name.replace(/[^a-zA-Z0-9._-]/g, '');
  return {
    id: repo.id,
    fullName: repo.full_name,
    owner: repo.owner.login,
    name: repo.name,
    url: repo.html_url,
    description: repo.description || 'GitHub 공개 메타데이터에 설명이 없습니다.',
    categories,
    topics: repo.topics ?? [],
    language: repo.language,
    license: repo.license?.spdx_id ?? null,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    pushedAt: repo.pushed_at,
    latestReleaseAt: release?.published_at ?? null,
    latestReleaseName: release?.name || release?.tag_name || null,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    ...metrics,
    freshnessDays,
    activityScore: activity,
    readmeScore: readme,
    testabilityScore: testability,
    earlySignalScore: signal,
    blogScore,
    blogRecommendation: blogScore >= 82 ? '오늘 작성 권장' : blogScore >= 68 ? '이번 주 검토' : '관찰 유지',
    testingDifficulty: classifyDifficulty(testability),
    installCommand: `git clone https://github.com/${repo.full_name}.git && cd ${safeName}`,
    whyTrending: [accelText, velocityText, activityText],
    tryThis: templates[primary].slice(0, 3),
    blogAngles: [
      `GitHub Star가 갑자기 오르는 ${repo.name}, 직접 써보니`,
      `${repo.name}는 왜 지금 뜨기 시작했을까? 7일 Star 변화 분석`,
      `아직 덜 알려진 AI 오픈소스 ${repo.name} 직접 테스트`,
    ],
  };
}
