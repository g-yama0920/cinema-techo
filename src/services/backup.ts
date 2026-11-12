import type { ChangeSet } from '../data/repository';
import { nowISO } from '../domain/dates';
import type { Counters, LibrarySnapshot, RatingChange, UserWork, WatchEvent, WatchlistEntry, Work } from '../domain/types';

export const BACKUP_FORMAT = 'cinema-techo-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: {
    works: Work[];
    userWorks: UserWork[];
    watchEvents: WatchEvent[];
    watchlist: WatchlistEntry[];
    ratingHistory: RatingChange[];
    counters: Counters;
  };
}

/** 個人トークンなどの秘密情報は含めない */
export function createBackup(snap: LibrarySnapshot): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: nowISO(),
    data: {
      works: snap.works,
      userWorks: snap.userWorks,
      watchEvents: snap.watchEvents,
      watchlist: snap.watchlist,
      ratingHistory: snap.ratingHistory,
      counters: snap.counters,
    },
  };
}

export function backupFileName(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `cinema-techo-backup-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.json`;
}

export type ParsedBackup = { ok: true; backup: BackupFile } | { ok: false; error: string };

export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON として読み込めません。ファイルが壊れていないか確認してください。' };
  }
  if (!json || typeof json !== 'object') return { ok: false, error: 'バックアップの形式ではありません' };
  const j = json as Partial<BackupFile>;
  if (j.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'このアプリのバックアップファイルではありません。初期データ（movie_tracker_seed.json）は「初期データの取り込み」から読み込んでください。' };
  }
  if (typeof j.version !== 'number' || j.version > BACKUP_VERSION) {
    return { ok: false, error: `未対応のバージョンです（${String(j.version)}）。アプリを更新してください。` };
  }
  const d = j.data;
  if (!d || !Array.isArray(d.works) || !Array.isArray(d.userWorks)) return { ok: false, error: '作品データが含まれていません' };
  const problems: string[] = [];
  d.works.forEach((w, i) => {
    if (!w || typeof w.id !== 'string' || typeof w.title !== 'string' || typeof w.catalogNo !== 'number') problems.push(`作品 ${i + 1}件目`);
  });
  if (problems.length) return { ok: false, error: `必須項目が欠けたデータがあります: ${problems.slice(0, 5).join('、')}` };
  const ids = new Set(d.works.map((w) => w.id));
  const catalogs = new Set<number>();
  for (const w of d.works) {
    if (catalogs.has(w.catalogNo)) return { ok: false, error: `管理番号 No.${w.catalogNo} が重複しています` };
    catalogs.add(w.catalogNo);
  }
  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: j.version,
      exportedAt: j.exportedAt ?? '',
      data: {
        works: d.works,
        userWorks: d.userWorks.filter((u) => ids.has(u.workId)),
        watchEvents: (d.watchEvents ?? []).filter((e) => ids.has(e.workId)),
        watchlist: d.watchlist ?? [],
        ratingHistory: (d.ratingHistory ?? []).filter((r) => ids.has(r.workId)),
        counters: d.counters ?? { nextCatalogNo: 1, nextWatchlistNo: 1 },
      },
    },
  };
}

export interface ImportPreview {
  incoming: { works: number; rated: number; events: number; watchlistActive: number };
  current: { works: number };
  /** 同じ ID → バックアップの内容で更新 */
  sameId: number;
  /** 新規追加 */
  newWorks: number;
  /** ID は違うが同じ管理番号・元番号 → 重複として追加しない（マージ時） */
  conflicts: { title: string; reason: string }[];
  merge: ChangeSet;
  replace: ChangeSet;
}

export function previewImport(backup: BackupFile, snap: LibrarySnapshot): ImportPreview {
  const d = backup.data;
  const curById = new Map(snap.works.map((w) => [w.id, w]));
  const curByCatalog = new Map(snap.works.map((w) => [w.catalogNo, w]));
  const curByLegacy = new Map(snap.works.filter((w) => w.legacyId != null).map((w) => [w.legacyId!, w]));

  const accepted = new Set<string>();
  const conflicts: ImportPreview['conflicts'] = [];
  let sameId = 0;
  for (const w of d.works) {
    if (curById.has(w.id)) {
      const cur = curById.get(w.id)!;
      if (cur.catalogNo !== w.catalogNo && curByCatalog.has(w.catalogNo)) {
        conflicts.push({ title: w.title, reason: `管理番号 No.${w.catalogNo} が別の作品と重複` });
        continue;
      }
      sameId++;
      accepted.add(w.id);
      continue;
    }
    const c = curByCatalog.get(w.catalogNo);
    if (c) {
      conflicts.push({ title: w.title, reason: `管理番号 No.${w.catalogNo} が既存の「${c.title}」と重複` });
      continue;
    }
    if (w.legacyId != null && curByLegacy.has(w.legacyId)) {
      conflicts.push({ title: w.title, reason: `元番号 No.${w.legacyId} が既存の「${curByLegacy.get(w.legacyId)!.title}」と重複` });
      continue;
    }
    accepted.add(w.id);
  }
  const curWlById = new Map(snap.watchlist.map((e) => [e.id, e]));
  const usedWlNo = new Map(snap.watchlist.map((e) => [e.fixedNumber, e.id]));
  const wl = d.watchlist.filter((e) => {
    if (e.workId && !accepted.has(e.workId)) return false;
    const owner = usedWlNo.get(e.fixedNumber);
    return !owner || owner === e.id || curWlById.has(e.id);
  });

  const merge: ChangeSet = {
    works: d.works.filter((w) => accepted.has(w.id)),
    userWorks: d.userWorks.filter((u) => accepted.has(u.workId)),
    watchEvents: d.watchEvents.filter((e) => accepted.has(e.workId)),
    watchlist: wl,
    ratingHistory: d.ratingHistory.filter((r) => accepted.has(r.workId)),
    counters: d.counters,
  };
  const replace: ChangeSet = {
    works: d.works,
    userWorks: d.userWorks,
    watchEvents: d.watchEvents,
    watchlist: d.watchlist,
    ratingHistory: d.ratingHistory,
    counters: d.counters,
  };
  return {
    incoming: {
      works: d.works.length,
      rated: d.userWorks.filter((u) => u.rating != null).length,
      events: d.watchEvents.length,
      watchlistActive: d.watchlist.filter((e) => e.status === 'active').length,
    },
    current: { works: snap.works.length },
    sameId,
    newWorks: accepted.size - sameId,
    conflicts,
    merge,
    replace,
  };
}

/** ブラウザでファイルとして保存させる */
export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
