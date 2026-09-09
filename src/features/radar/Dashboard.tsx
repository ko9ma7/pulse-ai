import { Activity, ArrowDownUp, Clock3, Database, RefreshCw, Search, Sparkles } from 'lucide-react';
import { useMemo, useState, type ChangeEvent } from 'react';
import type { RadarCategory, RadarData, RepoPulseRepository, WatchRecord } from '../../types';
import { RepoRow } from './RepoRow';
import { EmptyState } from '../../components/EmptyState';
import { formatNumber, relativeTime } from '../../utils/format';

const categories: Array<'All' | RadarCategory> = ['All', 'Agent', 'MCP', 'Coding', 'LLM', 'Local AI', 'RAG', 'Computer Use', 'AI Image', 'AI Video'];
type Window = '24H' | '7D' | '30D';
type SortMode = 'signal' | 'growth' | 'acceleration' | 'stars';

export function Dashboard({ data, watchlist, onToggleWatch }: {
  data: RadarData;
  watchlist: WatchRecord[];
  onToggleWatch: (repo: RepoPulseRepository) => void;
}) {
  const [window, setWindow] = useState<Window>('7D');
  const [category, setCategory] = useState<'All' | RadarCategory>('All');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('signal');

  const repositories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.repositories
      .filter((repo) => category === 'All' || repo.categories.includes(category))
      .filter((repo) => !normalized || [repo.fullName, repo.description, ...repo.topics].join(' ').toLowerCase().includes(normalized))
      .sort((a, b) => {
        if (sort === 'growth') {
          const key = window === '24H' ? 'star24h' : window === '7D' ? 'star7d' : 'star30d';
          return b[key] - a[key];
        }
        if (sort === 'acceleration') return b.acceleration - a.acceleration;
        if (sort === 'stars') return b.stars - a.stars;
        return b.earlySignalScore - a.earlySignalScore;
      });
  }, [data.repositories, category, query, sort, window]);

  return (
    <div className="page dashboard-page">
      <section className="hero-row">
        <div>
          <h1>Today's Fastest Rising<br /><span>AI Repositories</span></h1>
          <p>이미 유명한 프로젝트보다, 지금 막 성장 속도가 붙기 시작한 AI 오픈소스를 먼저 찾습니다.</p>
        </div>
        <div className="freshness-box">
          <span className={`status-dot ${data.source.mode}`} />
          <div><strong>{data.source.mode === 'live' ? 'Live radar data' : 'Demo snapshot'}</strong><span><Clock3 size={13} /> {relativeTime(data.generatedAt)} 갱신</span></div>
        </div>
      </section>

      {data.source.mode === 'demo' && (
        <div className="notice-banner">
          <Database size={18} />
          <div><strong>현재 번들 데모 데이터입니다.</strong><span>GitHub Actions의 “Refresh radar & deploy”를 실행하면 실제 GitHub Star History 데이터로 자동 교체됩니다.</span></div>
        </div>
      )}

      <section className="summary-strip" aria-label="Radar 요약">
        <div><span>분석 후보</span><strong>{formatNumber(data.summary.scannedRepositories)}</strong><small>repos scanned</small></div>
        <div><span>급상승 후보</span><strong>{formatNumber(data.summary.qualifiedRepositories)}</strong><small>qualified signals</small></div>
        <div><span>최고 Early Signal</span><strong>{data.repositories[0]?.earlySignalScore ?? 0}</strong><small>/ 100</small></div>
        <div><span>평균 Signal</span><strong>{data.summary.averageSignal}</strong><small>/ 100</small></div>
      </section>

      <section className="radar-panel">
        <div className="radar-toolbar">
          <div className="period-tabs" aria-label="분석 기간">
            {(['24H', '7D', '30D'] as Window[]).map((value) => (
              <button key={value} className={window === value ? 'active' : ''} onClick={() => setWindow(value)}>{value}</button>
            ))}
          </div>
          <div className="toolbar-right">
            <label className="search-box"><Search size={17} /><input value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="Repository 검색" aria-label="Repository 검색" /></label>
            <label className="sort-select"><ArrowDownUp size={16} /><select value={sort} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSort(event.target.value as SortMode)} aria-label="정렬 기준">
              <option value="signal">Early Signal 순</option>
              <option value="growth">증가량 순</option>
              <option value="acceleration">가속도 순</option>
              <option value="stars">총 Star 순</option>
            </select></label>
          </div>
        </div>
        <div className="category-scroller" aria-label="카테고리 필터">
          {categories.map((value) => <button key={value} className={category === value ? 'active' : ''} onClick={() => setCategory(value)}>{value}</button>)}
        </div>

        <div className="table-head" aria-hidden="true">
          <span>Repository</span><span>Stars</span><span>7D Growth</span><span>Acceleration</span><span>Trend</span><span>Signal</span><span />
        </div>
        <div className="repo-list">
          {repositories.length ? repositories.map((repo, index) => (
            <RepoRow key={repo.fullName} repo={repo} rank={index + 1} watched={watchlist.find((record) => record.fullName === repo.fullName)} onToggleWatch={onToggleWatch} />
          )) : <EmptyState title="조건에 맞는 Repository가 없습니다" description="검색어나 카테고리를 바꾸거나 다른 기간을 확인해 보세요." />}
        </div>
      </section>

      <section className="method-note">
        <Sparkles size={18} />
        <div><strong>Early Signal은 Star 총량 순위가 아닙니다.</strong><p>7일 Star 증가 속도 35%, 성장 가속도 20%, 최근 활동 15%, 프로젝트 신선도 10%, README 완성도 10%, 직접 테스트 가능성 10%를 조합합니다.</p></div>
        <a href="#/methodology">산식 보기</a>
      </section>
    </div>
  );
}
