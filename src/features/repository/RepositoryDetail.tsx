import { ArrowLeft, Bookmark, BookmarkCheck, CalendarDays, CheckCircle2, CircleDot, ExternalLink, GitFork, Package, Sparkles, Star, Terminal, Zap } from 'lucide-react';
import type { RepoPulseRepository, WatchRecord } from '../../types';
import { TrendChart } from '../../components/TrendChart';
import { ScoreRing } from '../../components/ScoreRing';
import { formatAcceleration, formatDate, formatNumber, formatPercent } from '../../utils/format';
import { goHome } from '../../hooks/useHashRoute';

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  return <div className="score-bar"><div><span>{label}</span><strong>{value} / {max}</strong></div><div className="bar-track"><i style={{ width: `${(value / max) * 100}%` }} /></div></div>;
}

export function RepositoryDetail({ repo, watched, onToggleWatch }: {
  repo: RepoPulseRepository;
  watched?: WatchRecord;
  onToggleWatch: (repo: RepoPulseRepository) => void;
}) {
  const freshness = Math.min(30, Math.round(repo.earlySignalScore * 0.31));
  const test = Math.min(25, Math.round(repo.testabilityScore * 0.25));
  const interest = Math.min(20, Math.round((repo.star7d > 0 ? 14 : 8) + Math.min(6, repo.velocity7d / 20)));
  const scarcity = Math.min(15, Math.round(8 + Math.min(7, repo.freshnessDays < 120 ? 6 : 2)));
  const completeness = Math.min(10, Math.round(repo.readmeScore / 10));

  return (
    <div className="page detail-page">
      <button className="back-button" onClick={goHome}><ArrowLeft size={17} /> 레이더로 돌아가기</button>
      <section className="detail-hero">
        <div className="detail-copy">
          <div className="detail-title-row"><h1>{repo.fullName}</h1><a className="icon-button" href={repo.url} target="_blank" rel="noreferrer" aria-label="GitHub에서 열기"><ExternalLink size={18} /></a></div>
          <p>{repo.description}</p>
          <div className="repo-tags detail-tags">{repo.categories.map((category) => <span key={category}>{category}</span>)}{repo.language && <span className="language-dot"><i />{repo.language}</span>}</div>
          <div className="detail-cta-row">
            <button className="primary-button" onClick={() => onToggleWatch(repo)}>{watched ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}{watched ? 'Watch 중' : 'Watch 저장'}</button>
            <a className="secondary-button" href={repo.url} target="_blank" rel="noreferrer"><ExternalLink size={17} /> GitHub 열기</a>
          </div>
        </div>
        <div className="detail-score-card"><span>EARLY SIGNAL</span><ScoreRing score={repo.earlySignalScore} size={118} /><p>{repo.earlySignalScore >= 85 ? '초기 급상승 신호가 매우 강합니다.' : repo.earlySignalScore >= 70 ? '성장 흐름을 계속 관찰할 가치가 있습니다.' : '아직 강한 초기 신호는 아닙니다.'}</p></div>
      </section>

      <section className="metric-grid">
        <div><span><Star size={15} /> 현재 Star</span><strong>{formatNumber(repo.stars)}</strong></div>
        <div className="positive"><span><Zap size={15} /> 최근 24시간</span><strong>+{formatNumber(repo.star24h)}</strong></div>
        <div className="positive"><span>최근 7일</span><strong>+{formatNumber(repo.star7d)}</strong><small>{formatPercent(repo.velocity7d)}</small></div>
        <div className="positive"><span>Acceleration</span><strong>↑ {formatAcceleration(repo.acceleration)}</strong><small>vs previous 7d</small></div>
      </section>

      <div className="detail-grid">
        <section className="content-panel chart-panel">
          <div className="panel-title"><div><span>STAR HISTORY</span><h2>성장 곡선</h2></div><small>최근 30일</small></div>
          <TrendChart data={repo.history} />
          <div className="chart-foot"><span>30일 증가 <strong>+{formatNumber(repo.star30d)}</strong></span><span>7일 증가 <strong>+{formatNumber(repo.star7d)}</strong></span><span>이전 7일 <strong>+{formatNumber(repo.starPrev7d)}</strong></span></div>
        </section>

        <section className="content-panel info-panel">
          <div className="panel-title"><div><span>REPOSITORY</span><h2>프로젝트 정보</h2></div></div>
          <dl className="info-list">
            <div><dt><CalendarDays size={15} /> 생성일</dt><dd>{formatDate(repo.createdAt)}</dd></div>
            <div><dt><Package size={15} /> 최근 Release</dt><dd>{repo.latestReleaseName ?? 'Release 없음'}<small>{formatDate(repo.latestReleaseAt)}</small></dd></div>
            <div><dt><CircleDot size={15} /> Language</dt><dd>{repo.language ?? 'Unknown'}</dd></div>
            <div><dt><CheckCircle2 size={15} /> License</dt><dd>{repo.license ?? 'Not detected'}</dd></div>
            <div><dt><GitFork size={15} /> Forks</dt><dd>{formatNumber(repo.forks)}</dd></div>
          </dl>
        </section>
      </div>

      <div className="detail-grid lower">
        <section className="content-panel">
          <div className="panel-title"><div><span>WHY TRENDING</span><h2>왜 지금 오르고 있나</h2></div><Sparkles size={18} /></div>
          <ol className="reason-list">{repo.whyTrending.map((reason) => <li key={reason}>{reason}</li>)}</ol>
        </section>
        <section className="content-panel">
          <div className="panel-title"><div><span>TRY THIS</span><h2>직접 만들어볼 것</h2></div><Terminal size={18} /></div>
          <ul className="idea-list">{repo.tryThis.map((idea) => <li key={idea}>{idea}</li>)}</ul>
          {repo.installCommand && <div className="install-command"><code>{repo.installCommand}</code><button onClick={() => navigator.clipboard.writeText(repo.installCommand ?? '')}>복사</button></div>}
        </section>
      </div>

      <section className="blog-panel">
        <div className="blog-head"><div><span>BLOG ANGLE</span><h2>블로그 글감 평가</h2><p>지금 이 프로젝트를 글로 다룰 가치가 있는지 빠르게 판단합니다.</p></div><div className="blog-total"><strong>{repo.blogScore}</strong><span>/ 100</span><em>{repo.blogRecommendation}</em></div></div>
        <div className="blog-body">
          <div className="score-bars"><ScoreBar label="신선도" value={freshness} max={30} /><ScoreBar label="직접 테스트" value={test} max={25} /><ScoreBar label="독자 관심" value={interest} max={20} /><ScoreBar label="국내 희소성" value={scarcity} max={15} /><ScoreBar label="프로젝트 완성도" value={completeness} max={10} /></div>
          <div className="angle-list"><span>추천 제목 후보</span>{repo.blogAngles.map((angle) => <button key={angle} onClick={() => navigator.clipboard.writeText(angle)}>{angle}<small>클릭해 복사</small></button>)}</div>
        </div>
      </section>
    </div>
  );
}
