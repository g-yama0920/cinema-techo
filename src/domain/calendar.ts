import type { LibraryIndex } from './library';
import type { WatchEvent, WatchlistEntry, WorkBundle, WorkType } from './types';

export type CalendarItem =
  | { kind: 'watched'; date: string; bundle: WorkBundle; event: WatchEvent }
  | { kind: 'planned'; date: string; bundle: WorkBundle; entry: WatchlistEntry };

/**
 * 指定月のカレンダー項目（日付 → 項目）。
 * 日単位の視聴日がある視聴イベントと、見たいリストの視聴予定日だけを表示する。
 * 日付不明・年月のみの記録、初期データの登録日は表示しない。
 */
export function calendarMonth(index: LibraryIndex, year: number, month: number, type: 'all' | WorkType): Map<string, CalendarItem[]> {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const map = new Map<string, CalendarItem[]>();
  const push = (item: CalendarItem) => {
    const list = map.get(item.date);
    if (list) list.push(item);
    else map.set(item.date, [item]);
  };
  for (const b of index.bundles) {
    if (type !== 'all' && b.work.type !== type) continue;
    for (const e of b.events) {
      if (e.watchedOnPrecision === 'day' && e.watchedOn?.startsWith(prefix)) push({ kind: 'watched', date: e.watchedOn, bundle: b, event: e });
    }
  }
  for (const { entry, bundle } of index.activeWatchlist) {
    if (type !== 'all' && bundle.work.type !== type) continue;
    if (entry.plannedDate?.startsWith(prefix)) push({ kind: 'planned', date: entry.plannedDate, bundle, entry });
  }
  for (const list of map.values()) list.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'watched' ? -1 : 1));
  return map;
}

/** 月曜始まり・日曜始まりの 6週×7日 グリッド（null は空白セル） */
export function monthGrid(year: number, month: number, weekStartsOn: 0 | 1 = 0): (string | null)[] {
  const first = new Date(year, month - 1, 1);
  const days = new Date(year, month, 0).getDate();
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}
