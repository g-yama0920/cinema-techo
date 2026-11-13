/**
 * 実データ（movie_tracker_full_catalog.json / .csv）での作業完了条件の確認。
 *
 *   seed/ に置いて  npm run verify:seed
 *   または  SEED_PATH=/path/to/catalog.json CSV_PATH=/path/to/catalog.csv npm run verify:seed
 *
 * 期待値は依頼の作業完了条件（全107・評価済み44・平均3.00・評価保留7・未視聴1・見たい3・未確認52）。
 * 変える場合は EXPECT='{"total":107,...}' を指定。ファイルが無い場合はスキップする。
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIndex } from '../src/domain/library';
import { reconcileWithCsv } from '../src/domain/reconcile';
import { normalizeSeed, summarizeSeed } from '../src/domain/seed';
import { computeStats } from '../src/domain/stats';
import { freshRepo, importSeed, loadFixture as loadJson } from './helpers';
import type { TmdbMetadataFile } from '../src/domain/tmdbMetadata';
import { planSeedImport } from '../src/services/seedImport';
import { csvToObjects } from '../src/domain/reconcile';

/** JSON でも CSV でも読めるようにする */
const loadFixture = (p: string): unknown => (p.endsWith('.csv') ? csvToObjects(readFileSync(p, 'utf8')) : loadJson(p));

const candidates = [process.env.SEED_PATH, 'seed/movie_tracker_full_catalog.json', 'seed/movie_tracker_full_catalog.csv', 'seed/movie_tracker_seed.json'].filter(Boolean) as string[];
const path = candidates.find((p) => existsSync(p));
const csvPath = [process.env.CSV_PATH, 'seed/movie_tracker_full_catalog.csv'].filter(Boolean).find((p) => existsSync(p!) && p !== path);
const expected = { total: 107, rated: 44, average: 3.0, pending: 7, unwatched: 1, want: 3, unconfirmed: 52, ...JSON.parse(process.env.EXPECT ?? '{}') };

describe.skipIf(!path)(`実データの確認（${path}）`, () => {
  it('変換結果（目視用に件数・注意を出力）', () => {
    const seed = normalizeSeed(loadFixture(path!));
    console.log('\n[seed] 件数', summarizeSeed(seed), '\n[seed] 注意', seed.warnings, '\n[seed] エラー', seed.errors);
    expect(seed.errors).toEqual([]);
  });

  it('全作品が重複なく登録され、分類・平均が一致し、再取り込みで増えない', async () => {
    const raw = loadFixture(path!);
    const { repo } = freshRepo();
    await importSeed(repo, raw);
    const idx = buildIndex(await repo.load());
    const by = (s: string) => idx.bundles.filter((b) => b.user.status === s).length;
    expect(idx.bundles).toHaveLength(expected.total);
    expect(new Set(idx.bundles.map((b) => b.work.catalogNo)).size).toBe(expected.total);
    expect(idx.bundles.filter((b) => b.user.rating != null)).toHaveLength(expected.rated);
    expect(by('pending')).toBe(expected.pending);
    expect(by('unwatched')).toBe(expected.unwatched);
    expect(by('want')).toBe(expected.want);
    expect(by('unconfirmed')).toBe(expected.unconfirmed);
    const stats = computeStats(idx, { kind: 'all' }, 'all');
    expect(stats.averageRating!.toFixed(2)).toBe(expected.average.toFixed(2));
    expect(idx.activeWatchlist).toHaveLength(expected.want);
    // 見たい固定番号は 1..N で重複なし、元データの値と一致
    const fixed = idx.activeWatchlist.map((x) => x.entry.fixedNumber).sort((a, b) => a - b);
    expect(fixed).toEqual(Array.from({ length: expected.want }, (_, i) => i + 1));
    console.log('\n[seed] 見たいリスト', idx.activeWatchlist.map((x) => `No.${x.entry.fixedNumber} ${x.bundle.work.title}（作品 No.${x.bundle.work.legacyId}）`));

    const { plan } = await importSeed(repo, raw);
    expect(plan.added).toBe(0);
    expect((await repo.load()).works).toHaveLength(expected.total);
  });

  it.skipIf(!path?.endsWith('.csv'))('CSV の1行ごとに、タイトル・星・状態・見たい番号・元番号が登録結果と完全に一致', async () => {
    const raw = loadFixture(path!) as Record<string, string>[];
    const { repo } = freshRepo();
    await importSeed(repo, raw);
    const idx = buildIndex(await repo.load());
    const STATUS: Record<string, string> = { watched_rated: 'watched', watched_unrated: 'pending', unwatched: 'unwatched', want_to_watch: 'want', unconfirmed: 'unconfirmed' };
    const mismatches: string[] = [];
    for (const row of raw) {
      const no = Number(row.legacy_id);
      const b = idx.bundles.find((x) => x.work.legacyId === no);
      if (!b) {
        mismatches.push(`No.${no} が登録されていない`);
        continue;
      }
      const wl = b.watchlist.find((e) => e.status === 'active');
      const checks: [string, unknown, unknown][] = [
        ['タイトル', b.work.title, row.title],
        ['星', b.user.rating, row.rating ? Number(row.rating) : null],
        ['状態', b.user.status, STATUS[row.status]],
        ['見たい番号', wl?.fixedNumber ?? null, row.watchlist_fixed_number ? Number(row.watchlist_fixed_number) : null],
        ['管理番号', b.work.catalogNo, no],
        ['視聴日', b.events.find((e) => e.watchedOn)?.watchedOn ?? null, row.watched_on || null],
      ];
      for (const [k, got, want] of checks) if (got !== want) mismatches.push(`No.${no} ${k}: 登録=${String(got)} / CSV=${String(want)}`);
    }
    console.log(`\n[seed] 1行ずつの照合：${raw.length}行、不一致 ${mismatches.length} 件`, mismatches.slice(0, 20));
    expect(mismatches).toEqual([]);
  });

  it.skipIf(!existsSync('seed/tmdb_metadata.json'))('同梱の TMDb 作品情報：紐付けた作品にポスターが入り、評価・状態・見たい番号は変わらない', async () => {
    const meta = JSON.parse(readFileSync('seed/tmdb_metadata.json', 'utf8')) as TmdbMetadataFile;
    const raw = loadFixture(path!);
    const { repo } = freshRepo();
    const plan = planSeedImport(normalizeSeed(raw), await repo.load(), 'now', meta);
    await repo.applyChanges(plan.changes, 'merge');
    const idx = buildIndex(await repo.load());
    const linked = idx.bundles.filter((b) => b.work.tmdbId != null);
    expect(linked).toHaveLength(Object.keys(meta.items).length);
    expect(linked.every((b) => b.work.posterPath)).toBe(true);
    // 同じ TMDb 作品を2つの作品に付けていない
    expect(new Set(linked.map((b) => `${b.work.tmdbMediaType}:${b.work.tmdbId}`)).size).toBe(linked.length);
    const by = (s: string) => idx.bundles.filter((b) => b.user.status === s).length;
    expect([by('watched'), by('pending'), by('unwatched'), by('want'), by('unconfirmed')]).toEqual([expected.rated, expected.pending, expected.unwatched, expected.want, expected.unconfirmed]);
    expect(computeStats(idx, { kind: 'all' }, 'all').averageRating!.toFixed(2)).toBe(expected.average.toFixed(2));
    console.log(`\n[tmdb] ポスターあり ${linked.length} / ${idx.bundles.length}、種類未確認 ${idx.bundles.filter((b) => b.work.type === 'other').length}、確認待ち ${idx.bundles.filter((b) => b.work.needsReview).length}`);
  });

  it.skipIf(!csvPath)(`CSV（${csvPath}）と照合して差異がない`, () => {
    const r = reconcileWithCsv(normalizeSeed(loadFixture(path!)), readFileSync(csvPath!, 'utf8'));
    console.log('\n[csv] 照合', { matched: r.matched, mismatches: r.mismatches, onlyInJson: r.onlyInJson, onlyInCsv: r.onlyInCsv, errors: r.csvErrors });
    expect(r.mismatches).toEqual([]);
    expect(r.onlyInJson).toEqual([]);
    expect(r.onlyInCsv).toEqual([]);
  });
});

it.skipIf(!!path)('実データが未配置のためスキップ（seed/movie_tracker_full_catalog.json）', () => {
  expect(path).toBeUndefined();
});
