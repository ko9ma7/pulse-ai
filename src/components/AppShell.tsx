import { Bookmark, Github, Menu, Moon, Radar, Sun, X } from 'lucide-react';
import { useState } from 'react';
import { Logo } from './Logo';
import type { ThemeMode } from '../hooks/useTheme';
import { goHome, goWatchlist } from '../hooks/useHashRoute';

export function AppShell({ children, routeName, theme, setTheme }: {
  children: React.ReactNode;
  routeName: 'home' | 'watchlist' | 'repo';
  theme: ThemeMode;
  setTheme: (value: ThemeMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  return (
    <div className="app-shell">
      <header className="mobile-header">
        <Logo />
        <button className="icon-button" onClick={() => setOpen((value) => !value)} aria-label="메뉴 열기">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="sidebar-head"><Logo /></div>
        <nav className="sidebar-nav" aria-label="주요 메뉴">
          <button className={routeName === 'home' ? 'nav-item active' : 'nav-item'} onClick={() => { goHome(); setOpen(false); }}>
            <Radar size={18} /><span>오늘의 레이더</span>
          </button>
          <button className={routeName === 'watchlist' ? 'nav-item active' : 'nav-item'} onClick={() => { goWatchlist(); setOpen(false); }}>
            <Bookmark size={18} /><span>Watchlist</span>
          </button>
        </nav>
        <div className="sidebar-foot">
          <button className="nav-item" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}<span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <a className="nav-item" href="https://github.com" target="_blank" rel="noreferrer"><Github size={18} /><span>GitHub</span></a>
          <div className="sidebar-note">Star total보다<br /><strong>성장 속도</strong>를 먼저 봅니다.</div>
        </div>
      </aside>
      {open && <button className="sidebar-backdrop" aria-label="메뉴 닫기" onClick={() => setOpen(false)} />}
      <main className="main-content">{children}</main>
    </div>
  );
}
