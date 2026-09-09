import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { AppShell } from './components/AppShell';
import { Dashboard } from './features/radar/Dashboard';
import { RepositoryDetail } from './features/repository/RepositoryDetail';
import { Watchlist } from './features/repository/Watchlist';
import { Methodology } from './features/scoring/Methodology';
import { useHashRoute } from './hooks/useHashRoute';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useTheme } from './hooks/useTheme';
import { loadRadarData } from './utils/data';
import type { RadarData, RepoPulseRepository, WatchRecord } from './types';

export default function App() {
  const route = useHashRoute();
  const { theme, setTheme } = useTheme();
  const [data, setData] = useState<RadarData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useLocalStorage<WatchRecord[]>('repo-pulse-watchlist', []);

  const refresh = () => {
    setError(null);
    loadRadarData().then(setData).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unknown data error'));
  };
  useEffect(refresh, []);

  const toggleWatch = (repo: RepoPulseRepository) => {
    setWatchlist((current) => current.some((item) => item.fullName === repo.fullName)
      ? current.filter((item) => item.fullName !== repo.fullName)
      : [...current, { fullName: repo.fullName, watchedAt: new Date().toISOString(), starsAtWatch: repo.stars }]);
  };

  const removeWatch = (fullName: string) => setWatchlist((current) => current.filter((item) => item.fullName !== fullName));

  let content: React.ReactNode;
  if (error) {
    content = <div className="center-state"><AlertTriangle size={28} /><h1>Radar 데이터를 불러오지 못했습니다</h1><p>{error}</p><button className="primary-button" onClick={refresh}><RefreshCw size={17} /> 다시 시도</button></div>;
  } else if (!data) {
    content = <div className="center-state"><span className="loader" /><h1>신호를 불러오는 중</h1><p>저장된 Star History 스냅샷을 읽고 있습니다.</p></div>;
  } else if (route.name === 'repo') {
    const repo = data.repositories.find((item) => item.fullName === route.fullName);
    content = repo ? <RepositoryDetail repo={repo} watched={watchlist.find((item) => item.fullName === repo.fullName)} onToggleWatch={toggleWatch} /> : <div className="center-state"><AlertTriangle size={28} /><h1>Repository를 찾을 수 없습니다</h1><a className="primary-button" href="#/">레이더로 이동</a></div>;
  } else if (route.name === 'watchlist') {
    content = <Watchlist repositories={data.repositories} watchlist={watchlist} onRemove={removeWatch} />;
  } else if (route.name === 'methodology') {
    content = <Methodology />;
  } else {
    content = <Dashboard data={data} watchlist={watchlist} onToggleWatch={toggleWatch} />;
  }

  return <AppShell routeName={route.name === 'repo' || route.name === 'methodology' ? 'home' : route.name} theme={theme} setTheme={setTheme}>{content}</AppShell>;
}
