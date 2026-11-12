import { inMonth, inYear } from './dates';
import { isWatchedStatus } from './labels';
import type { LibraryIndex } from './library';
import type { Rating, WatchEvent, WorkBundle, WorkType } from './types';

export type StatsPeriod = { kind: 'month'; year: number; month: number } | { kind: 'year'; year: number } | { kind: 'all' };
export type TypeFilter = 'all' | WorkType;

export interface NamedCount {
  name: string;
  count: number;
}

export interface GenreStat extends NamedCount {
  ratedCount: number;
  average: number | null;
}

export interface StatsResult {
  /** 期間内に視聴した作品数（同じ作品の再視聴は1本） */
  watchedWorks: number;
  /** 期間内の視聴回数 */
  watchEvents: number;
  /** 視聴時間が分かっている分だけの合計（分） */
  totalMinutes: number;
  /** 視聴時間が未確認で合計に含めなかった視聴回数 */
  minutesUnknown: number;
  averageRating: number | null;
  ratedCount: number;
  /** 星1〜5 の件数（index 0 = 星1） */
  distribution: [number, number, number, number, number];
  /** 月別（年・月表示）または年別（全期間）の視聴本数 */
  timeline: { label: string; key: string; count: number }[];
  timelineUnit: 'month' | 'year';
  genres: GenreStat[];
  /** ジャンル未設定の作品数 */
  genreUnknown: number;
  typeShare: { type: WorkType; count: number }[];
  countries: NamedCount[];
  countryUnknown: number;
  platforms: NamedCount[];
  /** 全期間のみ：状態別 */
  pendingCount: number;
  unwatchedCount: number;
  unconfirmedCount: number;
  wantCount: number;
  /** 視聴済みだが日付が分からず、月別・年別に含まれない作品数 */
  undatedWorks: number;
}

function eventInPeriod(e: WatchEvent, p: StatsPeriod): boolean {
  if (p.kind === 'all') return true;
  if (p.kind === 'year') return inYear(e.watchedOn, p.year);
  return inMonth(e.watchedOn, p.year, p.month);
}

/** 1回の視聴の時間（分）。不明なら null。ドラマ・アニメは実視聴時間がなければ推定しない */
export function eventMinutes(e: WatchEvent, b: WorkBundle): number | null {
  if (e.watchedMinutes != null && e.watchedMinutes > 0) return e.watchedMinutes;
  if (b.work.type === 'movie' && b.work.runtime != null && b.work.runtime > 0 && e.episodeNumber == null) return b.work.runtime;
  return null;
}

export function computeStats(index: LibraryIndex, period: StatsPeriod, type: TypeFilter): StatsResult {
  const bundles = index.bundles.filter((b) => type === 'all' || b.work.type === type);

  // 期間内に視聴した作品
  let watched: WorkBundle[];
  let events: { e: WatchEvent; b: WorkBundle }[];
  if (period.kind === 'all') {
    // 全期間：日付不明も含め、視聴済み・評価保留の作品すべて（未視聴・見たい・確認待ちは含めない）
    watched = bundles.filter((b) => isWatchedStatus(b.user.status));
    events = watched.flatMap((b) => b.events.map((e) => ({ e, b })));
  } else {
    events = bundles.flatMap((b) => b.events.filter((e) => eventInPeriod(e, period)).map((e) => ({ e, b })));
    const ids = new Set(events.map((x) => x.b.work.id));
    watched = bundles.filter((b) => ids.has(b.work.id));
  }

  let totalMinutes = 0;
  let minutesUnknown = 0;
  for (const { e, b } of events) {
    const m = eventMinutes(e, b);
    if (m == null) minutesUnknown++;
    else totalMinutes += m;
  }

  // 評価は「評価あり」だけで平均（評価なし・評価保留は除外）
  const rated = watched.filter((b) => b.user.rating != null);
  const distribution: StatsResult['distribution'] = [0, 0, 0, 0, 0];
  for (const b of rated) distribution[(b.user.rating as Rating) - 1]++;
  const averageRating = rated.length ? rated.reduce((s, b) => s + (b.user.rating as number), 0) / rated.length : null;

  // 時系列（日付が分かる視聴のみ）
  let timeline: StatsResult['timeline'];
  let timelineUnit: StatsResult['timelineUnit'];
  if (period.kind === 'all') {
    timelineUnit = 'year';
    const byYear = new Map<string, Set<string>>();
    for (const b of bundles) {
      for (const e of b.events) {
        if (!e.watchedOn) continue;
        const y = e.watchedOn.slice(0, 4);
        if (!byYear.has(y)) byYear.set(y, new Set());
        byYear.get(y)!.add(b.work.id);
      }
    }
    timeline = [...byYear.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([y, s]) => ({ key: y, label: `${y}`, count: s.size }));
  } else {
    timelineUnit = 'month';
    const year = period.year;
    timeline = Array.from({ length: 12 }, (_, i) => {
      const ids = new Set<string>();
      for (const b of bundles) for (const e of b.events) if (inMonth(e.watchedOn, year, i + 1)) ids.add(b.work.id);
      return { key: `${year}-${String(i + 1).padStart(2, '0')}`, label: `${i + 1}月`, count: ids.size };
    });
  }

  // ジャンル
  const genreMap = new Map<string, { count: number; sum: number; rated: number }>();
  let genreUnknown = 0;
  for (const b of watched) {
    if (!b.work.genres.length) genreUnknown++;
    for (const g of b.work.genres) {
      const cur = genreMap.get(g) ?? { count: 0, sum: 0, rated: 0 };
      cur.count++;
      if (b.user.rating != null) {
        cur.sum += b.user.rating;
        cur.rated++;
      }
      genreMap.set(g, cur);
    }
  }
  const genres = [...genreMap.entries()]
    .map(([name, v]) => ({ name, count: v.count, ratedCount: v.rated, average: v.rated ? v.sum / v.rated : null }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'));

  const typeShare = (['movie', 'drama', 'anime', 'other'] as WorkType[])
    .map((t) => ({ type: t, count: watched.filter((b) => b.work.type === t).length }))
    .filter((x) => x.count > 0 || x.type !== 'other');

  const countryMap = new Map<string, number>();
  let countryUnknown = 0;
  for (const b of watched) {
    if (!b.work.country.length) countryUnknown++;
    for (const c of b.work.country) countryMap.set(c, (countryMap.get(c) ?? 0) + 1);
  }
  const platformMap = new Map<string, number>();
  for (const { e } of events) if (e.platform) platformMap.set(e.platform, (platformMap.get(e.platform) ?? 0) + 1);

  return {
    watchedWorks: watched.length,
    watchEvents: events.length,
    totalMinutes,
    minutesUnknown,
    averageRating,
    ratedCount: rated.length,
    distribution,
    timeline,
    timelineUnit,
    genres,
    genreUnknown,
    typeShare,
    countries: toSorted(countryMap),
    countryUnknown,
    platforms: toSorted(platformMap),
    pendingCount: bundles.filter((b) => b.user.status === 'pending').length,
    unwatchedCount: bundles.filter((b) => b.user.status === 'unwatched').length,
    unconfirmedCount: bundles.filter((b) => b.user.status === 'unconfirmed').length,
    wantCount: bundles.filter((b) => b.user.status === 'want').length,
    undatedWorks: bundles.filter((b) => isWatchedStatus(b.user.status) && !b.events.some((e) => e.watchedOn)).length,
  };
}

function toSorted(m: Map<string, number>): NamedCount[] {
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'));
}

export function formatMinutes(min: number): string {
  if (min <= 0) return '0分';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}分`;
  return m ? `${h}時間${m}分` : `${h}時間`;
}

export function formatAverage(avg: number | null): string {
  return avg == null ? '—' : avg.toFixed(2);
}
