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
import { freshRepo, importSeed, loadFixture } from './helpers';

const candidates = [process.env.SEED_PATH, 'seed/movie_tracker_full_catalog.json', 'seed/movie_tracker_seed.json'].filter(Boolean) as string[];
const path = candidates.find((p) => existsSync(p));
const csvPath = [process.env.CSV_PATH, 'seed/movie_tracker_full_catalog.csv'].filter(Boolean).find((p) => existsSync(p!));
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

    const { plan } = await importSeed(repo, raw);
    expect(plan.added).toBe(0);
    expect((await repo.load()).works).toHaveLength(expected.total);
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
