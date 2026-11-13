/**
 * 実データと同じ列構成（schema_version 2）の CSV を正式データとして取り込むテスト。
 * 架空の作品名（tests/fixtures/sample_catalog_v2.csv）で、件数・評価・状態・固定番号の引き継ぎを確認する。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIndex } from '../src/domain/library';
import { csvToObjects } from '../src/domain/reconcile';
import { normalizeSeed } from '../src/domain/seed';
import { computeStats } from '../src/domain/stats';
import { worksToCsv } from '../src/services/csv';
import { freshRepo, importSeed } from './helpers';

const rows = csvToObjects(readFileSync('tests/fixtures/sample_catalog_v2.csv', 'utf8'));

describe('schema v2 の CSV を取り込む', () => {
  it('107件・44/7/1/3/52・平均3.00', async () => {
    const { repo } = freshRepo();
    await importSeed(repo, rows);
    const idx = buildIndex(await repo.load());
    const by = (s: string) => idx.bundles.filter((b) => b.user.status === s).length;
    expect(idx.bundles).toHaveLength(107);
    expect([by('watched'), by('pending'), by('unwatched'), by('want'), by('unconfirmed')]).toEqual([44, 7, 1, 3, 52]);
    expect(computeStats(idx, { kind: 'all' }, 'all').averageRating!.toFixed(2)).toBe('3.00');
  });

  it('見たいリストの固定番号は CSV の値をそのまま使う（作品番号の順に振り直さない）', async () => {
    const { repo } = freshRepo();
    await importSeed(repo, rows);
    const idx = buildIndex(await repo.load());
    expect(idx.activeWatchlist.map((x) => [x.entry.fixedNumber, x.bundle.work.legacyId])).toEqual([
      [1, 106],
      [2, 107],
      [3, 105],
    ]);
  });

  it('media_type unknown は「種類未確認」、metadata_review_required は確認待ち、notes は感想メモに入れない', () => {
    const seed = normalizeSeed(rows);
    const r = (n: number) => seed.records.find((x) => x.legacyId === n)!;
    const unconfirmed = seed.records.find((x) => x.status === 'unconfirmed')!;
    expect(unconfirmed.type).toBe('other');
    expect(unconfirmed.needsReview).toMatch(/作品の特定/);
    expect(unconfirmed.review).toBe('');
    expect(unconfirmed.importNote).toMatch(/未確認/);
    expect(r(12).importNote).toBe('シーズン1・2をまとめて評価');
    expect(r(1).sourceCategory).toBe('テスト用の分類');
    expect(r(1).genres).toEqual([]); // 利用者の分類を公式ジャンル扱いしない
    expect(r(31).alternateTitles).toEqual(expect.arrayContaining(['宇宙を駆ける。SWITCHED', 'SWITCHED']));
  });

  it('元の分類・データメモは保存され、CSV 書き出しにも残る', async () => {
    const { repo } = freshRepo();
    await importSeed(repo, rows);
    const idx = buildIndex(await repo.load());
    const w = idx.bundles.find((b) => b.work.legacyId === 12)!.work;
    expect(w.sourceCategory).toBe('テスト用の分類');
    expect(w.importNote).toBe('シーズン1・2をまとめて評価');
    expect(worksToCsv(idx)).toContain('シーズン1・2をまとめて評価');
  });

  it('同じ CSV を再取り込みしても重複しない', async () => {
    const { repo } = freshRepo();
    await importSeed(repo, rows);
    const { plan } = await importSeed(repo, rows);
    expect(plan.added).toBe(0);
    expect((await repo.load()).works).toHaveLength(107);
  });
});
