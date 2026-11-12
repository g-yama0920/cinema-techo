import { titleKey } from './text';
import type { LibrarySnapshot, RatingChange, UserWork, WatchEvent, WatchlistEntry, Work, WorkBundle } from './types';

/** 画面で使いやすい形に整えた索引。スナップショットから毎回作り直す（数百〜数千件なら十分速い） */
export interface LibraryIndex {
  snapshot: LibrarySnapshot;
  bundles: WorkBundle[];
  byId: Map<string, WorkBundle>;
  /** 有効な見たいリスト（並び順） */
  activeWatchlist: { entry: WatchlistEntry; bundle: WorkBundle }[];
  /** 閉じた見たいリスト（番号の履歴） */
  closedWatchlist: WatchlistEntry[];
}

const FALLBACK_USER = (workId: string, addedAt: string): UserWork => ({
  workId,
  status: 'unwatched',
  rating: null,
  ratedAt: null,
  review: '',
  tags: [],
  addedAt,
  updatedAt: addedAt,
  legacyWatchlistNumber: null,
});

export function buildIndex(snapshot: LibrarySnapshot): LibraryIndex {
  const users = new Map(snapshot.userWorks.map((u) => [u.workId, u]));
  const events = groupBy(snapshot.watchEvents, (e) => e.workId);
  const wl = groupBy(snapshot.watchlist.filter((e) => e.workId), (e) => e.workId!);
  const rh = groupBy(snapshot.ratingHistory, (r) => r.workId);

  const bundles: WorkBundle[] = snapshot.works.map((work) => ({
    work,
    user: users.get(work.id) ?? FALLBACK_USER(work.id, work.createdAt),
    events: (events.get(work.id) ?? []).sort(compareEventsDesc),
    watchlist: (wl.get(work.id) ?? []).sort((a, b) => a.fixedNumber - b.fixedNumber),
    ratingHistory: (rh.get(work.id) ?? []).sort((a: RatingChange, b: RatingChange) => b.changedAt.localeCompare(a.changedAt)),
  }));
  bundles.sort((a, b) => a.work.catalogNo - b.work.catalogNo);
  const byId = new Map(bundles.map((b) => [b.work.id, b]));

  const activeWatchlist = snapshot.watchlist
    .filter((e) => e.status === 'active' && e.workId && byId.has(e.workId))
    .sort((a, b) => a.priority - b.priority || a.fixedNumber - b.fixedNumber)
    .map((entry) => ({ entry, bundle: byId.get(entry.workId!)! }));
  const closedWatchlist = snapshot.watchlist
    .filter((e) => e.status !== 'active')
    .sort((a, b) => a.fixedNumber - b.fixedNumber);

  return { snapshot, bundles, byId, activeWatchlist, closedWatchlist };
}

/** 新しい視聴が先。日付不明は最後（作成日時で並べる） */
export function compareEventsDesc(a: WatchEvent, b: WatchEvent): number {
  if (a.watchedOn && b.watchedOn) return b.watchedOn.localeCompare(a.watchedOn) || b.createdAt.localeCompare(a.createdAt);
  if (a.watchedOn) return -1;
  if (b.watchedOn) return 1;
  return b.createdAt.localeCompare(a.createdAt);
}

/** 日付が分かっている最新の視聴日 */
export function latestWatchDate(b: WorkBundle): string | null {
  for (const e of b.events) if (e.watchedOn) return e.watchedOn;
  return null;
}

export function activeWatchlistEntry(b: WorkBundle): WatchlistEntry | undefined {
  return b.watchlist.find((e) => e.status === 'active');
}

/** 重複候補：tmdbId 一致、またはタイトル（別題含む）の正規化一致。自動統合はしない */
export function findDuplicateCandidates(
  bundles: WorkBundle[],
  query: { title: string; tmdbId?: number | null; tmdbMediaType?: string | null; alternateTitles?: string[] },
): { bundle: WorkBundle; reason: 'tmdb' | 'title' }[] {
  const keys = new Set([query.title, ...(query.alternateTitles ?? [])].map(titleKey).filter(Boolean));
  const out: { bundle: WorkBundle; reason: 'tmdb' | 'title' }[] = [];
  for (const b of bundles) {
    const w: Work = b.work;
    if (query.tmdbId && w.tmdbId === query.tmdbId && (!query.tmdbMediaType || w.tmdbMediaType === query.tmdbMediaType)) {
      out.push({ bundle: b, reason: 'tmdb' });
      continue;
    }
    const wk = [w.title, ...w.alternateTitles].map(titleKey);
    if (wk.some((k) => keys.has(k))) out.push({ bundle: b, reason: 'title' });
  }
  return out;
}

export function displayTitle(w: Work): string {
  return w.edition ? `${w.title}（${w.edition}）` : w.title;
}

function groupBy<T>(list: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const item of list) {
    const k = key(item);
    const arr = m.get(k);
    if (arr) arr.push(item);
    else m.set(k, [item]);
  }
  return m;
}
