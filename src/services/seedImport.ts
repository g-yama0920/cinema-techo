import type { ChangeSet } from '../data/repository';
import { nowISO } from '../domain/dates';
import { STATUS_LABEL } from '../domain/labels';
import type { NormalizedSeed, SeedRecord, SeedWatchItem } from '../domain/seed';
import { newId, titleKey } from '../domain/text';
import {
  RESERVED_LEGACY_MAX,
  type LibrarySnapshot,
  type RatingChange,
  type UserWork,
  type WatchEvent,
  type WatchlistEntry,
  type WatchStatus,
  type Work,
} from '../domain/types';

export interface SeedPlanRow {
  kind: 'record' | 'watchlist';
  label: string;
  title: string;
  action: 'add' | 'skip' | 'link';
  reason?: string;
}

export interface SeedDiff {
  legacyId: number;
  title: string;
  changes: { field: string; from: string; to: string }[];
  /** タイトルが違う＝別作品の可能性。自動では更新しない */
  conflict: boolean;
}

export interface SeedPlan {
  /** 新規追加だけの変更（既存データには一切触れない） */
  changes: ChangeSet;
  /** 利用者が「差分を反映する」を選んだときだけ追加で適用する変更 */
  updates: ChangeSet;
  diffs: SeedDiff[];
  rows: SeedPlanRow[];
  added: number;
  skipped: number;
  linked: number;
  warnings: string[];
}

const label = (s: WatchStatus) => STATUS_LABEL[s];
const isWatched = (s: WatchStatus) => s === 'watched' || s === 'pending';

/**
 * 初期データの取り込み計画を作る（純粋関数）。
 * 冪等性: 元番号（legacyId）・見たいリスト元番号（legacyWatchlistNumber）が既にあるものは追加しない。
 * 既存データ（ユーザーが後から変えた評価など）は上書きしない。差分は diffs / updates として別に返す。
 */
export function planSeedImport(seed: NormalizedSeed, snap: LibrarySnapshot, now: string = nowISO()): SeedPlan {
  const rows: SeedPlanRow[] = [];
  const warnings: string[] = [];
  const works: Work[] = [];
  const userWorks: UserWork[] = [];
  const watchEvents: WatchEvent[] = [];
  const watchlist: WatchlistEntry[] = [];
  const ratingHistory: RatingChange[] = [];
  const diffs: SeedDiff[] = [];
  const updates: Required<Pick<ChangeSet, 'works' | 'userWorks' | 'watchEvents' | 'watchlist' | 'ratingHistory'>> = {
    works: [],
    userWorks: [],
    watchEvents: [],
    watchlist: [],
    ratingHistory: [],
  };

  const byLegacy = new Map<number, Work>();
  for (const w of snap.works) if (w.legacyId != null) byLegacy.set(w.legacyId, w);
  const usedCatalog = new Set(snap.works.map((w) => w.catalogNo));
  const usedWlNo = new Set(snap.watchlist.map((e) => e.fixedNumber));
  const userByWork = new Map(snap.userWorks.map((u) => [u.workId, u]));
  const existingWlLegacy = new Set(snap.userWorks.map((u) => u.legacyWatchlistNumber).filter((n): n is number => n != null));

  const maxLegacy = Math.max(RESERVED_LEGACY_MAX, ...seed.records.map((r) => r.legacyId));
  let nextCatalog = Math.max(snap.counters.nextCatalogNo, maxLegacy + 1, ...snap.works.map((w) => w.catalogNo + 1));
  const maxSeedWl = Math.max(0, ...seed.records.map((r) => r.watchlistNumber ?? 0), ...seed.watchlist.map((w) => w.number));
  let nextWl = Math.max(snap.counters.nextWatchlistNo, maxSeedWl + 1, ...snap.watchlist.map((e) => e.fixedNumber + 1), 1);
  let priority = Math.max(0, ...snap.watchlist.filter((e) => e.status === 'active').map((e) => e.priority));

  const allocCatalog = () => {
    while (usedCatalog.has(nextCatalog)) nextCatalog++;
    usedCatalog.add(nextCatalog);
    return nextCatalog++;
  };
  const allocWl = (wanted: number | null, what: string): number => {
    if (wanted != null && !usedWlNo.has(wanted)) {
      usedWlNo.add(wanted);
      nextWl = Math.max(nextWl, wanted + 1);
      return wanted;
    }
    while (usedWlNo.has(nextWl)) nextWl++;
    const n = nextWl++;
    usedWlNo.add(n);
    if (wanted != null) warnings.push(`${what} の見たい番号 No.${wanted} は使用済みのため No.${n} を割り当てました`);
    return n;
  };
  const entry = (workId: string, fixedNumber: number, title: string, x: Partial<WatchlistEntry> = {}): WatchlistEntry => ({
    id: newId(),
    workId,
    fixedNumber,
    priority: ++priority,
    plannedDate: null,
    releaseDate: null,
    availableOn: [],
    note: '',
    addedAt: now,
    status: 'active',
    closedAt: null,
    titleSnapshot: title,
    ...x,
  });
  const undatedEvent = (workId: string, r: Pick<SeedRecord, 'watchedOn' | 'watchedOnPrecision' | 'platform'>): WatchEvent => ({
    id: newId(),
    workId,
    watchedOn: r.watchedOn,
    watchedOnPrecision: r.watchedOnPrecision,
    location: null,
    platform: r.platform,
    watchedMinutes: null,
    seasonNumber: null,
    episodeNumber: null,
    notes: r.watchedOn ? '' : '初期データ（視聴日不明）',
    createdAt: now,
  });

  /** 今回追加する記録（No.→作品）。見たいリストの紐付けに使う */
  const newByLegacy = new Map<number, Work>();

  for (const r of seed.records) {
    const lbl = `No.${r.legacyId}`;
    const existing = byLegacy.get(r.legacyId);
    if (existing) {
      rows.push({ kind: 'record', label: lbl, title: r.title, action: 'skip', reason: '取り込み済み（上書きしません）' });
      const d = diffRecord(r, existing, userByWork.get(existing.id));
      if (d) {
        diffs.push(d);
        if (!d.conflict) buildUpdate(r, existing, userByWork.get(existing.id), snap, now, updates, allocWl, entry, undatedEvent);
      }
      continue;
    }
    let catalogNo = r.legacyId;
    if (usedCatalog.has(catalogNo)) {
      catalogNo = allocCatalog();
      warnings.push(`${lbl}「${r.title}」の番号は既に別の作品が使っているため、管理番号 No.${catalogNo} を割り当てました（元番号 ${r.legacyId} は保持）`);
    } else {
      usedCatalog.add(catalogNo);
    }
    const work = recordToWork(r, catalogNo, now);
    works.push(work);
    newByLegacy.set(r.legacyId, work);
    let wlNo: number | null = null;
    if (r.status === 'want') {
      wlNo = allocWl(r.watchlistNumber, lbl);
      watchlist.push(entry(work.id, wlNo, work.title, { plannedDate: r.plannedDate, releaseDate: r.releaseDate, availableOn: r.availableOn }));
    }
    userWorks.push({
      workId: work.id,
      status: r.status,
      rating: r.rating,
      ratedAt: null, // 評価した日時は不明
      review: r.review,
      tags: r.tags,
      addedAt: now,
      updatedAt: now,
      legacyWatchlistNumber: wlNo,
    });
    if (r.rating !== null) {
      ratingHistory.push({ id: newId(), workId: work.id, from: null, to: r.rating, changedAt: now, source: 'seed' });
    }
    // 視聴した事実だけを記録。日付が無い場合は null のまま（架空の日付は付けない）
    if (isWatched(r.status)) watchEvents.push(undatedEvent(work.id, r));
    rows.push({ kind: 'record', label: lbl, title: r.title, action: 'add', reason: [r.status === 'want' ? `見たい No.${wlNo}` : '', ...r.notes].filter(Boolean).join(' / ') || undefined });
  }

  for (const item of seed.watchlist) {
    const lbl = `見たい No.${item.number}`;
    if (existingWlLegacy.has(item.number)) {
      rows.push({ kind: 'watchlist', label: lbl, title: item.title, action: 'skip', reason: '取り込み済み' });
      continue;
    }
    const fixedNumber = allocWl(item.number, lbl);
    const linkedWork = item.linkedLegacyId != null ? (newByLegacy.get(item.linkedLegacyId) ?? byLegacy.get(item.linkedLegacyId)) : undefined;
    let workId: string;
    let title = item.title;
    if (linkedWork) {
      workId = linkedWork.id;
      title = linkedWork.title;
      const u = userWorks.find((x) => x.workId === workId) ?? (userByWork.get(workId) ? { ...userByWork.get(workId)! } : undefined);
      if (u) {
        u.legacyWatchlistNumber = item.number;
        if (!userWorks.includes(u)) userWorks.push(u);
      }
      rows.push({ kind: 'watchlist', label: lbl, title: item.title, action: 'link', reason: `No.${item.linkedLegacyId} と同じ作品` });
    } else {
      const work = watchItemToWork(item, allocCatalog(), now);
      works.push(work);
      workId = work.id;
      userWorks.push({
        workId,
        status: 'want',
        rating: null,
        ratedAt: null,
        review: '',
        tags: [],
        addedAt: now,
        updatedAt: now,
        legacyWatchlistNumber: item.number,
      });
      rows.push({ kind: 'watchlist', label: lbl, title: item.title, action: 'add', reason: item.notes.join(' / ') || undefined });
    }
    const linkedUser = userWorks.find((u) => u.workId === workId) ?? userByWork.get(workId);
    const alreadyWatched = linkedUser && isWatched(linkedUser.status);
    watchlist.push(
      entry(workId, fixedNumber, title, {
        plannedDate: item.plannedDate,
        releaseDate: item.releaseDate,
        availableOn: item.availableOn,
        note: item.note,
        // 既に視聴済みの作品に紐付く場合は、番号の履歴として「視聴済み」で残す
        status: alreadyWatched ? 'watched' : 'active',
        closedAt: alreadyWatched ? now : null,
      }),
    );
  }

  const added = rows.filter((r) => r.action === 'add').length;
  return {
    changes: {
      works,
      userWorks,
      watchEvents,
      watchlist,
      ratingHistory,
      counters: { nextCatalogNo: nextCatalog, nextWatchlistNo: nextWl },
      settings: added ? { seedImportedAt: now } : undefined,
    },
    updates: { ...updates, counters: { nextCatalogNo: nextCatalog, nextWatchlistNo: nextWl } },
    diffs,
    rows,
    added,
    skipped: rows.filter((r) => r.action === 'skip').length,
    linked: rows.filter((r) => r.action === 'link').length,
    warnings,
  };
}

function diffRecord(r: SeedRecord, w: Work, u: UserWork | undefined): SeedDiff | null {
  const changes: SeedDiff['changes'] = [];
  const conflict = titleKey(r.title) !== titleKey(w.title) && !w.alternateTitles.map(titleKey).includes(titleKey(r.title));
  if (conflict) changes.push({ field: 'タイトル', from: w.title, to: r.title });
  if (r.type !== w.type) changes.push({ field: '区分', from: w.type, to: r.type });
  if (r.releaseYear != null && r.releaseYear !== w.releaseYear) changes.push({ field: '公開年', from: String(w.releaseYear ?? '—'), to: String(r.releaseYear) });
  if (u && r.status !== u.status) changes.push({ field: '状態', from: label(u.status), to: label(r.status) });
  if (u && r.rating !== u.rating) changes.push({ field: '評価', from: u.rating ? `★${u.rating}` : 'なし', to: r.rating ? `★${r.rating}` : 'なし' });
  return changes.length ? { legacyId: r.legacyId, title: w.title, changes, conflict } : null;
}

/** 差分を反映する場合の変更（感想・タグ・視聴記録など利用者が入れた情報は残す） */
function buildUpdate(
  r: SeedRecord,
  w: Work,
  u: UserWork | undefined,
  snap: LibrarySnapshot,
  now: string,
  out: Required<Pick<ChangeSet, 'works' | 'userWorks' | 'watchEvents' | 'watchlist' | 'ratingHistory'>>,
  allocWl: (wanted: number | null, what: string) => number,
  entry: (workId: string, fixedNumber: number, title: string, x?: Partial<WatchlistEntry>) => WatchlistEntry,
  event: (workId: string, r: Pick<SeedRecord, 'watchedOn' | 'watchedOnPrecision' | 'platform'>) => WatchEvent,
) {
  out.works.push({
    ...w,
    type: r.type,
    releaseYear: r.releaseYear ?? w.releaseYear,
    edition: w.edition ?? r.edition,
    needsReview: w.needsReview ?? r.needsReview,
    updatedAt: now,
  });
  if (!u) return;
  const nu: UserWork = { ...u, status: r.status, rating: r.rating, updatedAt: now };
  if (r.rating !== u.rating) out.ratingHistory.push({ id: newId(), workId: w.id, from: u.rating, to: r.rating, changedAt: now, source: 'import' });
  const active = snap.watchlist.filter((e) => e.workId === w.id && e.status === 'active');
  if (r.status === 'want' && !active.length) {
    const n = allocWl(r.watchlistNumber, `No.${r.legacyId}`);
    nu.legacyWatchlistNumber = nu.legacyWatchlistNumber ?? n;
    out.watchlist.push(entry(w.id, n, w.title));
  }
  if (r.status !== 'want' && r.status !== 'watching') {
    for (const e of active) out.watchlist.push({ ...e, status: isWatched(r.status) ? 'watched' : 'removed', closedAt: now });
  }
  if (isWatched(r.status) && !snap.watchEvents.some((e) => e.workId === w.id)) out.watchEvents.push(event(w.id, r));
  out.userWorks.push(nu);
}

function recordToWork(r: SeedRecord, catalogNo: number, now: string): Work {
  return {
    id: newId(),
    catalogNo,
    legacyId: r.legacyId,
    title: r.title,
    alternateTitles: r.alternateTitles,
    edition: r.edition,
    type: r.type,
    releaseYear: r.releaseYear,
    genres: r.genres,
    synopsis: r.synopsis,
    posterPath: r.posterPath,
    tmdbId: r.tmdbId,
    tmdbMediaType: r.tmdbId != null ? r.tmdbMediaType : null,
    country: r.country,
    directors: r.directors,
    cast: r.cast,
    runtime: r.runtime,
    seasonCount: r.seasonCount,
    episodeCount: r.episodeCount,
    watchProviders: [],
    watchProvidersFetchedAt: null,
    needsReview: r.needsReview,
    source: 'seed',
    createdAt: now,
    updatedAt: now,
  };
}

function watchItemToWork(item: SeedWatchItem, catalogNo: number, now: string): Work {
  return {
    id: newId(),
    catalogNo,
    legacyId: null,
    title: item.title,
    alternateTitles: item.alternateTitles,
    edition: null,
    type: item.type,
    releaseYear: item.releaseYear,
    genres: [],
    synopsis: null,
    posterPath: null,
    tmdbId: null,
    tmdbMediaType: null,
    country: [],
    directors: [],
    cast: [],
    runtime: null,
    seasonCount: null,
    episodeCount: null,
    watchProviders: [],
    watchProvidersFetchedAt: null,
    needsReview: item.needsReview,
    source: 'seed',
    createdAt: now,
    updatedAt: now,
  };
}
