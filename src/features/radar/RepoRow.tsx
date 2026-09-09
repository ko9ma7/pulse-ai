import { ArrowUpRight, Bookmark, BookmarkCheck, Flame, Star } from 'lucide-react';
import type { RepoPulseRepository, WatchRecord } from '../../types';
import { formatAcceleration, formatNumber, formatPercent } from '../../utils/format';
import { TrendChart } from '../../components/TrendChart';
import { ScoreRing } from '../../components/ScoreRing';
import { goRepo } from '../../hooks/useHashRoute';

export function RepoRow({ repo, rank, watched, onToggleWatch }: {
  repo: RepoPulseRepository;
  rank: number;
  watched?: WatchRecord;
  onToggleWatch: (repo: RepoPulseRepository) => void;
}) {
  return (
    <article className="repo-row">
      <button className="repo-main" onClick={() => goRepo(repo.fullName)} aria-label={`${repo.fullName} 상세 보기`}>
        <div className="repo-rank">{rank.toString().padStart(2, '0')}</div>
        <div className="repo-identity">
          <div className="repo-title-line">
            <h3>{repo.fullName}</h3>
            {repo.earlySignalScore >= 85 && <span className="hot-label"><Flame size={13} /> 급상승</span>}
          </div>
          <p>{repo.description}</p>
          <div className="repo-tags">
            {repo.categories.slice(0, 2).map((category) => <span key={category}>{category}</span>)}
            {repo.language && <span className="language-dot"><i />{repo.language}</span>}
          </div>
        </div>
      </button>
      <div className="repo-metric stars"><span><Star size={14} /> Stars</span><strong>{formatNumber(repo.stars)}</strong></div>
      <div className="repo-metric gain"><span>7일 증가</span><strong>+{formatNumber(repo.star7d)}</strong><small>{formatPercent(repo.velocity7d)}</small></div>
      <div className="repo-metric acceleration"><span>가속도</span><strong>↑ {formatAcceleration(repo.acceleration)}</strong><small>vs 이전 7일</small></div>
      <div className="repo-spark"><TrendChart compact data={repo.history.slice(-14)} /></div>
      <div className="repo-score"><ScoreRing score={repo.earlySignalScore} size={68} /></div>
      <div className="repo-actions">
        <button className="icon-button" onClick={() => onToggleWatch(repo)} aria-label={watched ? 'Watchlist에서 제거' : 'Watchlist에 저장'} title={watched ? 'Watchlist에서 제거' : 'Watchlist에 저장'}>
          {watched ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
        </button>
        <button className="icon-button" onClick={() => goRepo(repo.fullName)} aria-label="상세 보기"><ArrowUpRight size={18} /></button>
      </div>
    </article>
  );
}
