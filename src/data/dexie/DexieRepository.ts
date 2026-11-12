import { liveQuery } from 'dexie';
import { nowISO } from '../../domain/dates';
import { newId } from '../../domain/text';
import {
  DEFAULT_COUNTERS,
  DEFAULT_SETTINGS,
  type Counters,
  type LibrarySnapshot,
  type Rating,
  type RatingChange,
  type Settings,
  type UserWork,
  type WatchEvent,
  type WatchlistEntry,
  type WatchStatus,
  type Work,
} from '../../domain/types';
import type { ChangeSet, LibraryRepository, NewWorkInput, WatchInput, WorkPatch } from '../repository';
import { CinemaDB } from './db';

const COUNTERS_KEY = 'counters';
const SETTINGS_KEY = 'settings';

export class DexieRepository implements LibraryRepository {
  readonly db: CinemaDB;

  constructor(db: CinemaDB = new CinemaDB()) {
    this.db = db;
  }

  private get allTables() {
    const db = this.db;
    return [db.works, db.userWorks, db.watchEvents, db.watchlist, db.ratingHistory, db.meta];
  }

  // ---------- 読み込み ----------

  async load(): Promise<LibrarySnapshot> {
    const db = this.db;
    return db.transaction('r', this.allTables, async () => {
      const [works, userWorks, watchEvents, watchlist, ratingHistory, counters, settings] = await Promise.all([
        db.works.toArray(),
        db.userWorks.toArray(),
        db.watchEvents.toArray(),
        db.watchlist.toArray(),
        db.ratingHistory.toArray(),
        db.meta.get(COUNTERS_KEY),
        db.meta.get(SETTINGS_KEY),
      ]);
      return {
        works,
        userWorks,
        watchEvents,
        watchlist,
        ratingHistory,
        counters: { ...DEFAULT_COUNTERS, ...((counters?.value as Partial<Counters>) ?? {}) },
        settings: { ...DEFAULT_SETTINGS, ...((settings?.value as Partial<Settings>) ?? {}) },
      };
    });
  }

  subscribe(listener: (snap: LibrarySnapshot) => void, onError: (e: unknown) => void): () => void {
    const sub = liveQuery(() => this.load()).subscribe({ next: listener, error: onError });
    return () => sub.unsubscribe();
  }

  // ---------- 内部ヘルパー（トランザクション内で使用） ----------

  private async getCounters(): Promise<Counters> {
    const rec = await this.db.meta.get(COUNTERS_KEY);
    return { ...DEFAULT_COUNTERS, ...((rec?.value as Partial<Counters>) ?? {}) };
  }

  private async putCounters(c: Counters): Promise<void> {
    await this.db.meta.put({ key: COUNTERS_KEY, value: c });
  }

  /** 固定管理番号を払い出す（既存の最大番号より必ず大きい番号。再利用しない） */
  private async allocateCatalogNo(): Promise<number> {
    const c = await this.getCounters();
    const last = await this.db.works.orderBy('catalogNo').last();
    const no = Math.max(c.nextCatalogNo, (last?.catalogNo ?? 0) + 1);
    await this.putCounters({ ...c, nextCatalogNo: no + 1 });
    return no;
  }

  private async allocateWatchlistNo(): Promise<number> {
    const c = await this.getCounters();
    const last = await this.db.watchlist.orderBy('fixedNumber').last();
    const no = Math.max(c.nextWatchlistNo, (last?.fixedNumber ?? 0) + 1);
    await this.putCounters({ ...c, nextWatchlistNo: no + 1 });
    return no;
  }

  private async requireUser(workId: string): Promise<UserWork> {
    const u = await this.db.userWorks.get(workId);
    if (!u) throw new Error(`作品が見つかりません: ${workId}`);
    return u;
  }

  private async recordRating(user: UserWork, to: Rating | null, source: RatingChange['source'] = 'user') {
    if (user.rating === to) return;
    await this.db.ratingHistory.add({
      id: newId(),
      workId: user.workId,
      from: user.rating,
      to,
      changedAt: nowISO(),
      source,
    });
  }

  private async closeActiveWatchlist(workId: string, status: 'watched' | 'removed') {
    const now = nowISO();
    const entries = await this.db.watchlist.where('workId').equals(workId).toArray();
    for (const e of entries) {
      if (e.status === 'active') await this.db.watchlist.update(e.id, { status, closedAt: now });
    }
  }

  private buildEvent(workId: string, watch: WatchInput): WatchEvent {
    return {
      id: newId(),
      workId,
      watchedOn: watch.watchedOn ?? null,
      watchedOnPrecision: watch.watchedOn ? (watch.watchedOnPrecision ?? null) : null,
      location: watch.location ?? null,
      platform: watch.platform ?? null,
      watchedMinutes: watch.watchedMinutes ?? null,
      seasonNumber: watch.seasonNumber ?? null,
      episodeNumber: watch.episodeNumber ?? null,
      notes: watch.notes ?? '',
      createdAt: nowISO(),
    };
  }

  // ---------- 作品 ----------

  async createWork(input: NewWorkInput): Promise<string> {
    const db = this.db;
    return db.transaction('rw', this.allTables, async () => {
      const now = nowISO();
      const id = newId();
      const catalogNo = await this.allocateCatalogNo();
      const w = input.work;
      const work: Work = {
        id,
        catalogNo,
        legacyId: w.legacyId ?? null,
        title: w.title.trim(),
        alternateTitles: w.alternateTitles ?? [],
        edition: w.edition ?? null,
        type: w.type,
        releaseYear: w.releaseYear ?? null,
        genres: w.genres ?? [],
        synopsis: w.synopsis ?? null,
        posterPath: w.posterPath ?? null,
        tmdbId: w.tmdbId ?? null,
        tmdbMediaType: w.tmdbMediaType ?? null,
        country: w.country ?? [],
        directors: w.directors ?? [],
        cast: w.cast ?? [],
        runtime: w.runtime ?? null,
        seasonCount: w.seasonCount ?? null,
        episodeCount: w.episodeCount ?? null,
        watchProviders: w.watchProviders ?? [],
        watchProvidersFetchedAt: w.watchProvidersFetchedAt ?? null,
        needsReview: w.needsReview ?? null,
        source: w.source ?? 'manual',
        createdAt: now,
        updatedAt: now,
      };
      await db.works.add(work);

      const rating = input.rating ?? null;
      let status: WatchStatus = input.status;
      if (rating !== null) status = 'watched';
      const user: UserWork = {
        workId: id,
        status,
        rating,
        ratedAt: rating !== null ? now : null,
        review: input.review ?? '',
        tags: input.tags ?? [],
        addedAt: now,
        updatedAt: now,
        legacyWatchlistNumber: null,
      };
      await db.userWorks.add(user);
      if (rating !== null) {
        await db.ratingHistory.add({ id: newId(), workId: id, from: null, to: rating, changedAt: now, source: 'user' });
      }
      if ((status === 'watched' || status === 'pending') && input.watch) {
        await db.watchEvents.add(this.buildEvent(id, input.watch));
      }
      if (status === 'want') {
        const fixedNumber = await this.allocateWatchlistNo();
        await db.watchlist.add(await this.newWatchlistEntry(id, work.title, fixedNumber));
      }
      return id;
    });
  }

  private async newWatchlistEntry(workId: string, title: string, fixedNumber: number): Promise<WatchlistEntry> {
    const active = await this.db.watchlist.where('status').equals('active').toArray();
    const priority = active.reduce((m, e) => Math.max(m, e.priority), 0) + 1;
    return {
      id: newId(),
      workId,
      fixedNumber,
      priority,
      plannedDate: null,
      releaseDate: null,
      availableOn: [],
      note: '',
      addedAt: nowISO(),
      status: 'active',
      closedAt: null,
      titleSnapshot: title,
    };
  }

  async updateWork(workId: string, patch: WorkPatch): Promise<void> {
    await this.db.transaction('rw', this.db.works, this.db.watchlist, async () => {
      const n = await this.db.works.update(workId, { ...patch, updatedAt: nowISO() });
      if (!n) throw new Error('作品が見つかりません');
      if (patch.title) {
        const entries = await this.db.watchlist.where('workId').equals(workId).toArray();
        for (const e of entries) await this.db.watchlist.update(e.id, { titleSnapshot: patch.title });
      }
    });
  }

  async deleteWork(workId: string): Promise<void> {
    const db = this.db;
    await db.transaction('rw', this.allTables, async () => {
      const now = nowISO();
      // 見たいリストの番号は履歴として残す（作品との紐付けだけ外す）
      const entries = await db.watchlist.where('workId').equals(workId).toArray();
      for (const e of entries) {
        await db.watchlist.update(e.id, {
          workId: null,
          status: e.status === 'active' ? 'removed' : e.status,
          closedAt: e.closedAt ?? now,
        });
      }
      await db.watchEvents.where('workId').equals(workId).delete();
      await db.ratingHistory.where('workId').equals(workId).delete();
      await db.userWorks.delete(workId);
      await db.works.delete(workId);
      // 番号カウンタは戻さない（再利用しない）
    });
  }

  async updateUserWork(workId: string, patch: Partial<Pick<UserWork, 'review' | 'tags'>>): Promise<void> {
    const n = await this.db.userWorks.update(workId, { ...patch, updatedAt: nowISO() });
    if (!n) throw new Error('作品が見つかりません');
  }

  // ---------- 評価・状態 ----------

  async setRating(workId: string, rating: Rating | null): Promise<void> {
    const db = this.db;
    await db.transaction('rw', db.userWorks, db.ratingHistory, db.watchlist, async () => {
      const user = await this.requireUser(workId);
      await this.recordRating(user, rating);
      const now = nowISO();
      const patch: Partial<UserWork> = { rating, updatedAt: now, ratedAt: rating !== null ? now : user.ratedAt };
      if (rating !== null && user.status !== 'watched') {
        patch.status = 'watched';
        await this.closeActiveWatchlist(workId, 'watched');
      }
      await db.userWorks.update(workId, patch);
    });
  }

  async setPending(workId: string): Promise<void> {
    const db = this.db;
    await db.transaction('rw', db.userWorks, db.ratingHistory, db.watchlist, async () => {
      const user = await this.requireUser(workId);
      await this.recordRating(user, null);
      await db.userWorks.update(workId, { status: 'pending', rating: null, updatedAt: nowISO() });
      await this.closeActiveWatchlist(workId, 'watched');
    });
  }

  async setStatus(workId: string, status: WatchStatus): Promise<void> {
    if (status === 'pending') return this.setPending(workId);
    const db = this.db;
    await db.transaction('rw', this.allTables, async () => {
      const user = await this.requireUser(workId);
      const patch: Partial<UserWork> = { status, updatedAt: nowISO() };
      // 未視聴系の状態に戻すときは評価を外す（未視聴作品を評価済みとして数えないため）
      if (status === 'want' || status === 'unwatched' || status === 'unconfirmed' || status === 'watching') {
        if (user.rating !== null && status !== 'watching') {
          await this.recordRating(user, null);
          patch.rating = null;
        }
      }
      await db.userWorks.update(workId, patch);
      if (status === 'want') {
        const active = await db.watchlist.where('workId').equals(workId).filter((e) => e.status === 'active').count();
        if (!active) {
          const work = await db.works.get(workId);
          const no = await this.allocateWatchlistNo();
          await db.watchlist.add(await this.newWatchlistEntry(workId, work?.title ?? '', no));
        }
      } else if (status === 'unwatched' || status === 'unconfirmed') {
        await this.closeActiveWatchlist(workId, 'removed');
      } else if (status === 'watched') {
        await this.closeActiveWatchlist(workId, 'watched');
      }
    });
  }

  async markWatched(workId: string, watch: WatchInput, rating: Rating | null): Promise<void> {
    const db = this.db;
    await db.transaction('rw', this.allTables, async () => {
      const user = await this.requireUser(workId);
      await db.watchEvents.add(this.buildEvent(workId, watch));
      const now = nowISO();
      if (rating !== null) {
        await this.recordRating(user, rating);
        await db.userWorks.update(workId, { status: 'watched', rating, ratedAt: now, updatedAt: now });
      } else if (user.rating !== null) {
        // 再視聴で「後で評価する」を選んだ場合は既存の評価を維持する
        await db.userWorks.update(workId, { status: 'watched', updatedAt: now });
      } else {
        await db.userWorks.update(workId, { status: 'pending', updatedAt: now });
      }
      await this.closeActiveWatchlist(workId, 'watched');
    });
  }

  async startWatching(workId: string): Promise<void> {
    const n = await this.db.userWorks.update(workId, { status: 'watching', updatedAt: nowISO() });
    if (!n) throw new Error('作品が見つかりません');
  }

  // ---------- 見たいリスト ----------

  async addToWatchlist(
    workId: string,
    opts: Partial<Pick<WatchlistEntry, 'plannedDate' | 'releaseDate' | 'availableOn' | 'note'>> = {},
  ): Promise<number> {
    const db = this.db;
    return db.transaction('rw', this.allTables, async () => {
      const user = await this.requireUser(workId);
      const existing = await db.watchlist.where('workId').equals(workId).filter((e) => e.status === 'active').first();
      if (existing) {
        if (Object.keys(opts).length) await db.watchlist.update(existing.id, opts);
        return existing.fixedNumber;
      }
      const work = await db.works.get(workId);
      const no = await this.allocateWatchlistNo();
      const entry = { ...(await this.newWatchlistEntry(workId, work?.title ?? '', no)), ...opts };
      await db.watchlist.add(entry);
      // 視聴済み作品は「もう一度見たい」扱い：状態は変えない
      if (user.status !== 'watched' && user.status !== 'pending' && user.status !== 'watching') {
        await db.userWorks.update(workId, { status: 'want', updatedAt: nowISO() });
      }
      return no;
    });
  }

  async removeFromWatchlist(entryId: string): Promise<void> {
    const db = this.db;
    await db.transaction('rw', db.watchlist, db.userWorks, async () => {
      const e = await db.watchlist.get(entryId);
      if (!e) return;
      await db.watchlist.update(entryId, { status: 'removed', closedAt: nowISO() });
      if (e.workId) {
        const u = await db.userWorks.get(e.workId);
        if (u?.status === 'want') await db.userWorks.update(e.workId, { status: 'unwatched', updatedAt: nowISO() });
      }
    });
  }

  async updateWatchlistEntry(
    entryId: string,
    patch: Partial<Pick<WatchlistEntry, 'plannedDate' | 'releaseDate' | 'availableOn' | 'note'>>,
  ): Promise<void> {
    await this.db.watchlist.update(entryId, patch);
  }

  async reorderWatchlist(orderedEntryIds: string[]): Promise<void> {
    await this.db.transaction('rw', this.db.watchlist, async () => {
      let p = 1;
      for (const id of orderedEntryIds) await this.db.watchlist.update(id, { priority: p++ });
    });
  }

  // ---------- 視聴イベント ----------

  async addWatchEvent(workId: string, watch: WatchInput): Promise<string> {
    const ev = this.buildEvent(workId, watch);
    await this.db.watchEvents.add(ev);
    return ev.id;
  }

  async updateWatchEvent(eventId: string, patch: Partial<WatchInput>): Promise<void> {
    const p: Partial<WatchEvent> = { ...patch } as Partial<WatchEvent>;
    if ('watchedOn' in patch && !patch.watchedOn) {
      p.watchedOn = null;
      p.watchedOnPrecision = null;
    }
    await this.db.watchEvents.update(eventId, p);
  }

  async deleteWatchEvent(eventId: string): Promise<void> {
    await this.db.watchEvents.delete(eventId);
  }

  // ---------- 設定 ----------

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    await this.db.transaction('rw', this.db.meta, async () => {
      const rec = await this.db.meta.get(SETTINGS_KEY);
      const cur = { ...DEFAULT_SETTINGS, ...((rec?.value as Partial<Settings>) ?? {}) };
      await this.db.meta.put({ key: SETTINGS_KEY, value: { ...cur, ...patch } });
    });
  }

  // ---------- 一括 ----------

  async applyChanges(changes: ChangeSet, mode: 'merge' | 'replace'): Promise<void> {
    const db = this.db;
    await db.transaction('rw', this.allTables, async () => {
      let settings: Settings = { ...DEFAULT_SETTINGS };
      const prevSettings = await db.meta.get(SETTINGS_KEY);
      if (prevSettings) settings = { ...settings, ...(prevSettings.value as Partial<Settings>) };
      if (mode === 'replace') {
        await Promise.all([
          db.works.clear(),
          db.userWorks.clear(),
          db.watchEvents.clear(),
          db.watchlist.clear(),
          db.ratingHistory.clear(),
        ]);
        await db.meta.delete(COUNTERS_KEY);
      }
      if (changes.works?.length) await db.works.bulkPut(changes.works);
      if (changes.userWorks?.length) await db.userWorks.bulkPut(changes.userWorks);
      if (changes.watchEvents?.length) await db.watchEvents.bulkPut(changes.watchEvents);
      if (changes.watchlist?.length) await db.watchlist.bulkPut(changes.watchlist);
      if (changes.ratingHistory?.length) await db.ratingHistory.bulkPut(changes.ratingHistory);

      // カウンタは「これまでの最大値＋1」を下回らないようにする
      const cur = await this.getCounters();
      const lastWork = await db.works.orderBy('catalogNo').last();
      const lastWl = await db.watchlist.orderBy('fixedNumber').last();
      const next: Counters = {
        nextCatalogNo: Math.max(cur.nextCatalogNo, changes.counters?.nextCatalogNo ?? 0, (lastWork?.catalogNo ?? 0) + 1),
        nextWatchlistNo: Math.max(cur.nextWatchlistNo, changes.counters?.nextWatchlistNo ?? 0, (lastWl?.fixedNumber ?? 0) + 1),
      };
      await this.putCounters(next);
      if (changes.settings) settings = { ...settings, ...changes.settings };
      await db.meta.put({ key: SETTINGS_KEY, value: settings });
    });
  }
}
