import { useEffect, useState } from 'react';

type Route =
  | { name: 'home' }
  | { name: 'watchlist' }
  | { name: 'methodology' }
  | { name: 'repo'; fullName: string };

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  if (!raw) return { name: 'home' };
  if (raw === 'watchlist') return { name: 'watchlist' };
  if (raw === 'methodology') return { name: 'methodology' };
  if (raw.startsWith('repo/')) return { name: 'repo', fullName: decodeURIComponent(raw.slice(5)) };
  return { name: 'home' };
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => parseHash());
  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}
export function goHome() { window.location.hash = '#/'; }
export function goWatchlist() { window.location.hash = '#/watchlist'; }
export function goRepo(fullName: string) { window.location.hash = `#/repo/${encodeURIComponent(fullName)}`; }
