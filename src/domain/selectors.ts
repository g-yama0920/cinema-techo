import { inMonth, inYear, todayISO } from './dates';
import { latestWatchDate, type LibraryIndex } from './library';
import { titleKey } from './text';
import type { WatchStatus, WorkBundle, WorkType } from './types';

export interface HomeCounts {
  thisYear: number;
  thisMonth: number;
  rated: number;
  want: number;
}

export function homeCounts(index: LibraryIndex, now = new Date()): HomeCounts {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const year = new Set<string>();
  const month = new Set<string>();
  for (const b of index.bundles) {
    for (const e of b.events) {
      if (inYear(e.watchedOn, y)) year.add(b.work.id);
      if (inMonth(e.watchedOn, y, m)) month.add(b.work.id);
    }
  }
  return {
    thisYear: year.size,
    thisMonth: month.size,
    rated: index.bundles.filter((b) => b.user.rating != null).length,
    want: index.activeWatchlist.length,
  };
}

/** 日付が分かっている視聴だけを新しい順に（日付不明は含めない） */
export function recentWatched(index: LibraryIndex, limit = 12): { bundle: WorkBundle; date: string }[] {
  const items = index.bundles
    .map((b) => ({ bundle: b, date: latestWatchDate(b) }))
    .filter((x): x is { bundle: WorkBundle; date: string } => !!x.date);
  items.sort((a, b) => b.date.localeCompare(a.date) || b.bundle.events[0].createdAt.localeCompare(a.bundle.events[0].createdAt));
  return items.slice(0, limit);
}

/** アプリ内で評価した日時がある作品（初期データの評価は日時不明のため含めない） */
export function recentRated(index: LibraryIndex, limit = 12): WorkBundle[] {
  return index.bundles
    .filter((b) => b.user.rating != null && b.user.ratedAt)
    .sort((a, b) => b.user.ratedAt!.localeCompare(a.user.ratedAt!))
    .slice(0, limit);
}

export function recentAdded(index: LibraryIndex, limit = 12): WorkBundle[] {
  return [...index.bundles]
    .sort((a, b) => b.user.addedAt.localeCompare(a.user.addedAt) || b.work.catalogNo - a.work.catalogNo)
    .slice(0, limit);
}

export function pendingWorks(index: LibraryIndex): WorkBundle[] {
  return index.bundles.filter((b) => b.user.status === 'pending');
}

/** 確認待ち（同名作品・原作との区別などが曖昧で、利用者の判断が必要なもの） */
export function needsReviewWorks(index: LibraryIndex): WorkBundle[] {
  return index.bundles.filter((b) => b.work.needsReview);
}

/** 視聴状況が未確認の作品 */
export function unconfirmedWorks(index: LibraryIndex): WorkBundle[] {
  return index.bundles.filter((b) => b.user.status === 'unconfirmed');
}

/**
 * 見たいリストからのおすすめ。
 * 予定日が近いもの → 優先順位の上位、の順。先頭の1本は日替わりで上位5本から選ぶ。
 */
export function recommendations(index: LibraryIndex, now = new Date(), limit = 6): WorkBundle[] {
  const today = todayISO(now);
  const list = [...index.activeWatchlist];
  const soon = list
    .filter((x) => x.entry.plannedDate && x.entry.plannedDate >= today)
    .sort((a, b) => a.entry.plannedDate!.localeCompare(b.entry.plannedDate!));
  const rest = list.filter((x) => !soon.includes(x));
  if (rest.length > 1) {
    const top = Math.min(5, rest.length);
    const day = Math.floor(now.getTime() / 86400000);
    const pick = day % top;
    const [featured] = rest.splice(pick, 1);
    rest.unshift(featured);
  }
  return [...soon, ...rest].slice(0, limit).map((x) => x.bundle);
}

// ---------- WORKS の絞り込み・並び替え ----------

export type StatusFilter = 'all' | WatchStatus;
export type SortKey = 'rating-desc' | 'rating-asc' | 'recent-watched' | 'recent-added' | 'year' | 'title';

export const SORT_LABEL: Record<SortKey, string> = {
  'rating-desc': '評価が高い順',
  'rating-asc': '評価が低い順',
  'recent-watched': '最近見た順',
  'recent-added': '最近登録した順',
  year: '公開年順（新しい順）',
  title: 'タイトル順',
};

export interface WorksQuery {
  type: 'all' | WorkType;
  status: StatusFilter;
  sort: SortKey;
  q: string;
  /** 確認待ちだけに絞る */
  review?: boolean;
}

const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });

export function queryWorks(index: LibraryIndex, query: WorksQuery): WorkBundle[] {
  const q = titleKey(query.q);
  const list = index.bundles.filter((b) => {
    if (query.type !== 'all' && b.work.type !== query.type) return false;
    if (query.status !== 'all' && b.user.status !== query.status) return false;
    if (query.review && !b.work.needsReview) return false;
    if (q) {
      const hay = [b.work.title, ...b.work.alternateTitles, b.work.edition ?? '', ...b.work.cast, ...b.work.directors, ...b.user.tags]
        .map(titleKey)
        .join('|');
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const byNo = (a: WorkBundle, b: WorkBundle) => a.work.catalogNo - b.work.catalogNo;
  const nullsLast = <T>(a: T | null, b: T | null, cmp: (x: T, y: T) => number) => {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return cmp(a, b);
  };
  switch (query.sort) {
    case 'rating-desc':
      return list.sort((a, b) => nullsLast(a.user.rating, b.user.rating, (x, y) => y - x) || byNo(a, b));
    case 'rating-asc':
      return list.sort((a, b) => nullsLast(a.user.rating, b.user.rating, (x, y) => x - y) || byNo(a, b));
    case 'recent-watched':
      return list.sort((a, b) => nullsLast(latestWatchDate(a), latestWatchDate(b), (x, y) => y.localeCompare(x)) || byNo(b, a));
    case 'recent-added':
      return list.sort((a, b) => b.user.addedAt.localeCompare(a.user.addedAt) || byNo(b, a));
    case 'year':
      return list.sort((a, b) => nullsLast(a.work.releaseYear, b.work.releaseYear, (x, y) => y - x) || byNo(a, b));
    case 'title':
      return list.sort((a, b) => collator.compare(a.work.title, b.work.title) || byNo(a, b));
  }
}

export function statusCounts(index: LibraryIndex, type: 'all' | WorkType): Record<StatusFilter, number> {
  const out: Record<StatusFilter, number> = { all: 0, want: 0, watching: 0, watched: 0, pending: 0, unwatched: 0, unconfirmed: 0 };
  for (const b of index.bundles) {
    if (type !== 'all' && b.work.type !== type) continue;
    out.all++;
    out[b.user.status]++;
  }
  return out;
}
