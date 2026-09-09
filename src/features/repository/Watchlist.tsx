import { BookmarkX, Clock3, Star } from 'lucide-react';
import type { RepoPulseRepository, WatchRecord } from '../../types';
import { EmptyState } from '../../components/EmptyState';
import { formatNumber, relativeTime } from '../../utils/format';
import { goRepo } from '../../hooks/useHashRoute';

export function Watchlist({ repositories, watchlist, onRemove }: {
  repositories: RepoPulseRepository[];
  watchlist: WatchRecord[];
  onRemove: (fullName: string) => void;
}) {
  const rows = watchlist.map((watch) => ({ watch, repo: repositories.find((repo) => repo.fullName === watch.fullName) })).filter((row): row is { watch: WatchRecord; repo: RepoPulseRepository } => Boolean(row.repo));
  return (
    <div className="page watch-page">
      <section className="hero-row compact-hero"><div><h1>Watchlist</h1><p>발견 당시 Star와 현재 Star를 비교해 레이더가 실제로 빨리 찾았는지 확인합니다.</p></div></section>
      <section className="watch-panel">
        {rows.length ? rows.map(({ watch, repo }) => {
          const gained = repo.stars - watch.starsAtWatch;
          return <article className="watch-row" key={watch.fullName}>
            <button className="watch-main" onClick={() => goRepo(repo.fullName)}><strong>{repo.fullName}</strong><span>{repo.description}</span></button>
            <div><span><Clock3 size={14} /> 저장</span><strong>{relativeTime(watch.watchedAt)}</strong></div>
            <div><span><Star size={14} /> 발견 당시</span><strong>{formatNumber(watch.starsAtWatch)}</strong></div>
            <div className="positive"><span>현재 변화</span><strong>{gained >= 0 ? '+' : ''}{formatNumber(gained)}</strong></div>
            <button className="icon-button" aria-label="Watchlist에서 제거" onClick={() => onRemove(watch.fullName)}><BookmarkX size={18} /></button>
          </article>;
        }) : <EmptyState title="아직 저장한 Repository가 없습니다" description="오늘의 레이더에서 관심 프로젝트를 Watch에 추가하면 발견 시점 Star가 기록됩니다." />}
      </section>
    </div>
  );
}
