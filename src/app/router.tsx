import { createHashRouter } from 'react-router';
import { WorkDetailPage } from '../features/detail/WorkDetailPage';
import { HomePage } from '../features/home/HomePage';
import { WorksPage } from '../features/works/WorksPage';
import { NotFound } from './NotFound';
import { Shell } from './Shell';

/**
 * どの静的ホスティングでも動くようハッシュ方式（/#/works）にしている。
 * よく使う HOME・WORKS・詳細は即時読み込み、それ以外は必要になったときに読み込む。
 */
export const router = createHashRouter([
  {
    path: '/',
    element: <Shell />,
    errorElement: <NotFound crashed />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'works', element: <WorksPage /> },
      { path: 'works/:id', element: <WorkDetailPage /> },
      { path: 'works/:id/edit', lazy: () => import('../features/detail/WorkEditPage').then((m) => ({ Component: m.WorkEditPage })) },
      { path: 'add', lazy: () => import('../features/add/AddWorkPage').then((m) => ({ Component: m.AddWorkPage })) },
      { path: 'calendar', lazy: () => import('../features/calendar/CalendarPage').then((m) => ({ Component: m.CalendarPage })) },
      { path: 'watchlist', lazy: () => import('../features/watchlist/WatchlistPage').then((m) => ({ Component: m.WatchlistPage })) },
      { path: 'stats', lazy: () => import('../features/stats/StatsPage').then((m) => ({ Component: m.StatsPage })) },
      { path: 'settings', lazy: () => import('../features/settings/SettingsPage').then((m) => ({ Component: m.SettingsPage })) },
      { path: 'settings/seed', lazy: () => import('../features/settings/SeedImportPage').then((m) => ({ Component: m.SeedImportPage })) },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
