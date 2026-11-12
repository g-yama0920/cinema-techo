import { describe, expect, it } from 'vitest';
import { buildIndex } from '../src/domain/library';
import { worksToCsv } from '../src/services/csv';
import { freshRepo, importSeed, loadFixture } from './helpers';

describe('CSV 書き出し', () => {
  it('BOM 付き・全作品の行・評価と番号を含み、数式は無害化する', async () => {
    const { repo } = freshRepo();
    await importSeed(repo, loadFixture());
    await repo.createWork({ work: { title: '=HYPERLINK("x")', type: 'movie' }, status: 'unwatched' });
    const csv = worksToCsv(buildIndex(await repo.load()));
    expect(csv.startsWith('﻿管理番号,元番号,タイトル')).toBe(true);
    expect(csv.trim().split('\r\n')).toHaveLength(1 + 54);
    expect(csv).toContain('22,22,三体,,中国ドラマ版,ドラマ,2023,視聴済み,1');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
