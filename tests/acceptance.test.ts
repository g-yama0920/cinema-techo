/**
 * 依頼書「12. 受け入れ条件」の自動テスト。
 * 実データ（movie_tracker_seed.json）が未提供のため、同じ構成の架空データ tests/fixtures/sample_seed.json を使う。
 * 実データでの確認は tests/seed-verify.test.ts（npm run verify:seed）を使用。
 */
import { describe, expect, it } from 'vitest';
import { DexieRepository } from '../src/data/dexie/DexieRepository';
import { CinemaDB } from '../src/data/dexie/db';
import { calendarMonth } from '../src/domain/calendar';
import { buildIndex } from '../src/domain/library';
import { computeStats } from '../src/domain/stats';
import { createBackup, parseBackup, previewImport } from '../src/services/backup';
import { freshRepo, importSeed, loadFixture } from './helpers';

const fixture = loadFixture() as { summary: { averageRating: number }; records: { no: number; rating: number | null }[] };

describe('初期データ移行', () => {
  it('No.1〜49 が重複なく登録され、評価済み41・評価保留7・未視聴1 に分類される', async () => {
    const { repo } = freshRepo();
    await importSeed(repo, fixture);
    const snap = await repo.load();
    const idx = buildIndex(snap);
    const legacy = idx.bundles.filter((b) => b.work.legacyId != null && b.work.legacyId <= 49);
    expect(legacy).toHaveLength(49);
    expect(new Set(legacy.map((b) => b.work.legacyId)).size).toBe(49);
    expect(legacy.filter((b) => b.user.rating != null)).toHaveLength(41);
    expect(legacy.filter((b) => b.user.status === 'pending')).toHaveLength(7);
    expect(legacy.filter((b) => b.user.status === 'unwatched')).toHaveLength(1);
    // 管理番号 = 元の番号
    for (const b of legacy) expect(b.work.catalogNo).toBe(b.work.legacyId);
  });

  it('No.50 は確認待ち、見たいリストは3件で番号 1〜3', async () => {
    const { repo } = freshRepo();
    await importSeed(repo, fixture);
    const idx = buildIndex(await repo.load());
    const no50 = idx.bundles.find((b) => b.work.legacyId === 50)!;
    expect(no50.user.status).toBe('unconfirmed');
    expect(no50.user.rating).toBeNull();
    expect(idx.activeWatchlist.map((x) => x.entry.fixedNumber)).toEqual([1, 2, 3]);
    // 見たいリストの作品は 51 番以降の管理番号（既存番号と衝突しない）
    for (const x of idx.activeWatchlist) expect(x.bundle.work.catalogNo).toBeGreaterThan(50);
  });

  it('既存の評価値を変更しない（元データと完全一致）', async () => {
    const { repo } = freshRepo();
    await importSeed(repo, fixture);
    const idx = buildIndex(await repo.load());
    for (const r of fixture.records) {
      const b = idx.bundles.find((x) => x.work.legacyId === r.no)!;
      expect(b.user.rating).toBe(r.rating);
    }
  });

  it('平均評価が既存データに一致する', async () => {
    const { repo } = freshRepo();
    await importSeed(repo, fixture);
    const stats = computeStats(buildIndex(await repo.load()), { kind: 'all' }, 'all');
    const rated = fixture.records.filter((r) => r.rating != null);
    const expected = rated.reduce((s, r) => s + (r.rating as number), 0) / rated.length;
    expect(stats.ratedCount).toBe(41);
    expect(stats.averageRating).toBeCloseTo(expected, 10);
    expect(Number(stats.averageRating!.toFixed(2))).toBe(fixture.summary.averageRating);
  });

  it('同じ初期データを再インポートしても重複しない', async () => {
    const { repo } = freshRepo();
    await importSeed(repo, fixture);
    const before = await repo.load();
    const { plan } = await importSeed(repo, fixture);
    const after = await repo.load();
    expect(plan.added).toBe(0);
    expect(after.works).toHaveLength(before.works.length);
    expect(after.watchlist).toHaveLength(before.watchlist.length);
    expect(after.watchEvents).toHaveLength(before.watchEvents.length);
    expect(after.ratingHistory).toHaveLength(before.ratingHistory.length);
  });

  it('同名作品（灯台守 2019映画 / 2023ドラマ）を統合しない', async () => {
    const { repo } = freshRepo();
    await importSeed(repo, fixture);
    const idx = buildIndex(await repo.load());
    const same = idx.bundles.filter((b) => b.work.title === '灯台守');
    expect(same).toHaveLength(2);
    expect(new Set(same.map((b) => b.work.type))).toEqual(new Set(['movie', 'drama']));
  });

  it('個別ルール: No.31 の別題 / No.38 未視聴 / No.47 要確認 / 三体 ★1 中国ドラマ版', async () => {
    const { repo } = freshRepo();
    await importSeed(repo, fixture);
    const idx = buildIndex(await repo.load());
    const by = (n: number) => idx.bundles.find((b) => b.work.legacyId === n)!;
    expect(by(31).work.alternateTitles).toContain('SWITCHED');
    expect(by(38).user.status).toBe('unwatched');
    expect(by(38).user.rating).toBeNull();
    expect(by(47).work.needsReview).toMatch(/版が未特定/);
    expect(by(47).work.tmdbId).toBeNull();
    expect(by(47).user.rating).toBe(3);
    const santai = idx.bundles.find((b) => b.work.title === '三体')!;
    expect(santai.user.rating).toBe(1);
    expect(santai.work.edition).toBe('中国ドラマ版');
    expect(santai.work.type).toBe('drama');
  });
});

describe('評価の保存', () => {
  it('評価変更が再起動後も保持され、変更履歴が残る', async () => {
    const name = `restart-${Date.now()}`;
    const repo1 = new DexieRepository(new CinemaDB(name));
    await importSeed(repo1, fixture);
    const target = buildIndex(await repo1.load()).bundles.find((b) => b.work.legacyId === 1)!;
    const before = target.user.rating;
    await repo1.setRating(target.work.id, 2);
    repo1.db.close();

    const repo2 = new DexieRepository(new CinemaDB(name)); // 再起動を想定
    const idx = buildIndex(await repo2.load());
    const after = idx.byId.get(target.work.id)!;
    expect(after.user.rating).toBe(2);
    expect(after.ratingHistory[0]).toMatchObject({ from: before, to: 2, source: 'user' });
  });
});

describe('カレンダー・統計', () => {
  it('視聴日が不明・年月のみの記録はカレンダーに表示されない／登録日を視聴日にしない', async () => {
    const { repo } = freshRepo();
    await importSeed(repo, fixture);
    const idx = buildIndex(await repo.load());
    const all = [...Array(12)].flatMap((_, i) => [...calendarMonth(idx, 2026, i + 1, 'all').values()].flat());
    const watchedDays = all.filter((x) => x.kind === 'watched');
    // fixture で日単位の視聴日がある 6 件のみ（2026-09 は月精度なので除外）
    expect(watchedDays.map((x) => x.bundle.work.legacyId).sort((a, b) => a! - b!)).toEqual([2, 3, 6, 9, 16, 24]);
    // registeredAt(2025-04-01) は使われない
    const april2025 = [...calendarMonth(idx, 2025, 4, 'all').values()].flat();
    expect(april2025).toHaveLength(0);
    // 日付不明の視聴イベントは null のまま
    const undated = idx.bundles.find((b) => b.work.legacyId === 1)!;
    expect(undated.events[0].watchedOn).toBeNull();
  });

  it('未視聴作品は視聴済みとして計算されない', async () => {
    const { repo } = freshRepo();
    await importSeed(repo, fixture);
    const idx = buildIndex(await repo.load());
    const stats = computeStats(idx, { kind: 'all' }, 'all');
    expect(stats.watchedWorks).toBe(48); // 評価済み41 + 評価保留7（未視聴1・確認待ち1・見たい3 は除外）
    expect(stats.unwatchedCount).toBe(1);
    expect(stats.pendingCount).toBe(7);
  });

  it('月別・年別には日付不明を含めず、全期間の評価統計には含める', async () => {
    const { repo } = freshRepo();
    await importSeed(repo, fixture);
    const idx = buildIndex(await repo.load());
    const nov = computeStats(idx, { kind: 'month', year: 2026, month: 11 }, 'all');
    expect(nov.watchedWorks).toBe(4); // No.2, 3, 6, 24
    const y2026 = computeStats(idx, { kind: 'year', year: 2026 }, 'all');
    expect(y2026.watchedWorks).toBe(7); // + No.9, 16, 44(月精度)
    const all = computeStats(idx, { kind: 'all' }, 'all');
    expect(all.ratedCount).toBe(41);
  });

  it('視聴時間が未確認の作品は合計に加算せず、ドラマ・アニメは推定しない', async () => {
    const { repo } = freshRepo();
    await importSeed(repo, fixture);
    let idx = buildIndex(await repo.load());
    const movie = idx.bundles.find((b) => b.work.legacyId === 2)!; // 映画
    const drama = idx.bundles.find((b) => b.work.legacyId === 3)!; // ドラマ
    await repo.updateWork(movie.work.id, { runtime: 120 });
    await repo.updateWork(drama.work.id, { runtime: 45, episodeCount: 10 });
    idx = buildIndex(await repo.load());
    const nov = computeStats(idx, { kind: 'month', year: 2026, month: 11 }, 'all');
    expect(nov.totalMinutes).toBe(120);
    expect(nov.minutesUnknown).toBe(3);
  });
});

describe('バックアップ', () => {
  it('エクスポート→インポート（上書き）後も評価と番号が保持される', async () => {
    const { repo } = freshRepo();
    await importSeed(repo, fixture);
    const src = await repo.load();
    // 削除して番号に欠番を作る
    const victim = buildIndex(src).bundles.find((b) => b.work.legacyId === 10)!;
    await repo.deleteWork(victim.work.id);
    const snap = await repo.load();
    const text = JSON.stringify(createBackup(snap));

    const { repo: other } = freshRepo();
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    const preview = previewImport(parsed.backup, await other.load());
    await other.applyChanges(preview.replace, 'replace');
    const restored = await other.load();

    const key = (s: typeof snap) =>
      s.works
        .map((w) => `${w.catalogNo}:${w.legacyId}:${w.title}:${s.userWorks.find((u) => u.workId === w.id)?.rating}`)
        .sort()
        .join('|');
    expect(key(restored)).toBe(key(snap));
    expect(restored.watchlist.map((e) => e.fixedNumber).sort()).toEqual(snap.watchlist.map((e) => e.fixedNumber).sort());
    expect(restored.counters.nextCatalogNo).toBe(snap.counters.nextCatalogNo);
    // 新規作成しても削除済みの番号は再利用されない
    const id = await other.createWork({ work: { title: '新しい作品', type: 'movie' }, status: 'unwatched' });
    const created = (await other.load()).works.find((w) => w.id === id)!;
    expect(created.catalogNo).toBeGreaterThanOrEqual(54);
  });

  it('マージ時、同じ元番号の別IDデータは重複として追加しない', async () => {
    const a = freshRepo();
    const b = freshRepo();
    await importSeed(a.repo, fixture);
    await importSeed(b.repo, fixture); // 別端末で別々に取り込んだ状態
    const backup = createBackup(await a.repo.load());
    const preview = previewImport(backup, await b.repo.load());
    expect(preview.newWorks).toBe(0);
    expect(preview.conflicts.length).toBe(backup.data.works.length);
  });

  it('個人トークンはバックアップに含めない', async () => {
    const { repo } = freshRepo();
    await repo.updateSettings({ tmdbPersonalToken: 'secret-token' });
    const text = JSON.stringify(createBackup(await repo.load()));
    expect(text).not.toContain('secret-token');
  });
});

describe('見たいリスト', () => {
  it('固定番号は削除しても再利用せず、「見た」で除外され番号は履歴に残る', async () => {
    const { repo } = freshRepo();
    await importSeed(repo, fixture);
    let idx = buildIndex(await repo.load());
    const [first, second] = idx.activeWatchlist;
    await repo.removeFromWatchlist(second.entry.id);
    await repo.markWatched(first.bundle.work.id, { watchedOn: '2026-11-12', watchedOnPrecision: 'day' }, 5);
    const id = await repo.createWork({ work: { title: '追加の見たい作品', type: 'movie' }, status: 'want' });
    idx = buildIndex(await repo.load());
    expect(idx.activeWatchlist.map((x) => x.entry.fixedNumber)).toEqual([3, 4]);
    expect(idx.byId.get(id)!.watchlist[0].fixedNumber).toBe(4);
    const closed = idx.closedWatchlist.map((e) => [e.fixedNumber, e.status]);
    expect(closed).toEqual([
      [1, 'watched'],
      [2, 'removed'],
    ]);
    const watched = idx.byId.get(first.bundle.work.id)!;
    expect(watched.user.status).toBe('watched');
    expect(watched.user.rating).toBe(5);
  });

  it('「後で評価する」は評価保留になる', async () => {
    const { repo } = freshRepo();
    const id = await repo.createWork({ work: { title: 'テスト', type: 'drama' }, status: 'want' });
    await repo.markWatched(id, { watchedOn: null, watchedOnPrecision: null }, null);
    const b = buildIndex(await repo.load()).byId.get(id)!;
    expect(b.user.status).toBe('pending');
    expect(b.user.rating).toBeNull();
    expect(b.events[0].watchedOn).toBeNull();
  });
});
