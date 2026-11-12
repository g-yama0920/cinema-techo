import { NavLink, Outlet, ScrollRestoration } from 'react-router';
import { useLibraryState } from '../data/LibraryProvider';
import { IconCalendar, IconGear, IconHome, IconList, IconStats, IconWorks } from '../ui/icons';
import { Button, ErrorState, LoadingState } from '../ui/primitives';
import { AutoSeed } from './AutoSeed';
import { UpdateBanner } from './UpdateBanner';

const NAV = [
  { to: '/', en: 'HOME', ja: 'ホーム', icon: IconHome, end: true },
  { to: '/calendar', en: 'CALENDAR', ja: 'カレンダー', icon: IconCalendar },
  { to: '/works', en: 'WORKS', ja: '作品', icon: IconWorks },
  { to: '/watchlist', en: 'WATCHLIST', ja: '見たい', icon: IconList },
  { to: '/stats', en: 'STATS', ja: '統計', icon: IconStats },
];

export function Shell() {
  const state = useLibraryState();

  return (
    <div className="min-h-dvh bg-paper">
      <a href="#main" className="sr-only-focusable fixed top-2 left-2 z-[60] bg-ink px-3 py-2 font-bold text-paper">
        本文へ移動
      </a>
      {/* PC：上部ナビ */}
      <header className="sticky top-0 z-30 hidden bg-gradient-to-b from-black/90 to-paper/70 backdrop-blur md:block">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
          <NavLink to="/" className="flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-red">シネマ手帖</span>
          </NavLink>
          <nav aria-label="メイン" className="ml-auto flex h-full items-stretch">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 text-[14px] transition-colors ${isActive ? 'font-bold text-ink' : 'text-ink-soft hover:text-ink'}`
                }
              >
                <n.icon size={18} />
                {n.ja}
              </NavLink>
            ))}
            <NavLink
              to="/settings"
              aria-label="設定・バックアップ"
              className={({ isActive }) => `ml-3 grid w-11 place-items-center ${isActive ? 'text-ink' : 'text-ink-soft hover:text-ink'}`}
            >
              <IconGear />
            </NavLink>
          </nav>
        </div>
      </header>

      <main id="main" className="pb-nav mx-auto max-w-6xl px-4 md:px-6" key={state.status}>
        {state.status === 'loading' && <LoadingState label="記録を読み込み中…" />}
        {state.status === 'error' && (
          <div className="pt-10">
            <ErrorState
              title="データを読み込めませんでした"
              action={
                <Button variant="ink" onClick={() => window.location.reload()}>
                  再読み込み
                </Button>
              }
            >
              <p>
                ブラウザの保存領域（IndexedDB）にアクセスできません。プライベートブラウズでは保存できない場合があります。
              </p>
              <p className="mt-1 text-xs text-ink-soft">{String((state.error as Error)?.message ?? state.error)}</p>
            </ErrorState>
          </div>
        )}
        {state.status === 'ready' && <Outlet />}
      </main>

      {/* スマホ：下部固定ナビ */}
      <nav
        aria-label="メイン"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#121212]/95 pb-[var(--safe-b)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto grid h-[var(--nav-h)] max-w-lg grid-cols-5">
          {NAV.map((n) => (
            <li key={n.to} className="min-w-0">
              <NavLink
                to={n.to}
                end={n.end}
                aria-label={n.ja}
                className={({ isActive }) =>
                  `relative flex h-full flex-col items-center justify-center gap-1 ${isActive ? 'text-ink' : 'text-gray'}`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute top-0 h-[3px] w-6 rounded-b bg-red" aria-hidden="true" />}
                    <n.icon size={23} strokeWidth={isActive ? 2.2 : 1.7} />
                    <span className="text-[10px] font-bold">{n.ja}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <AutoSeed />
      <UpdateBanner />
      <ScrollRestoration getKey={(loc) => loc.pathname + loc.search} />
    </div>
  );
}
