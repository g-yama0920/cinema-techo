/** 同梱の TMDb 作品情報の反映ルール（架空のデータで確認） */
import { describe, expect, it } from 'vitest';
import { buildIndex } from '../src/domain/library';
import { REVIEW_FLAG_TEXT, UNKNOWN_TYPE_TEXT } from '../src/domain/seed';
import { metadataPatch, planMetadataApply, type TmdbMetadataFile } from '../src/domain/tmdbMetadata';
import type { Work } from '../src/domain/types';
import { freshRepo, importSeed } from './helpers';
import { normalizeSeed } from '../src/domain/seed';
import { planSeedImport } from '../src/services/seedImport';

const item = (o: Partial<TmdbMetadataFile['items'][string]> = {}) => ({
  tmdbId: 100, mediaType: 'tv' as const, match: 'confirmed' as const, suggestedType: 'anime' as const, title: 'T', originalTitle: 'Orig',
  posterPath: '/p.jpg', releaseYear: 2020, synopsis: 'あらすじ', genres: ['アニメーション'], country: ['日本'], directors: ['監督'], cast: ['俳優'],
  runtime: 24, seasonCount: 2, episodeCount: 24, watchProviders: [{ name: 'Netflix', logoPath: null, kind: 'flatrate' as const }], ...o,
});
const meta: TmdbMetadataFile = {
  version: 1, generatedAt: '', source: 'TMDB',
  items: { '1': item(), '2': item({ tmdbId: 200, match: 'estimated', suggestedType: 'movie', mediaType: 'movie' }), '3': item({ tmdbId: 300 }) },
  unresolved: { '4': '候補：A、B' },
};
const work = (o: Partial<Work>): Work => ({
  id: 'w', catalogNo: 1, legacyId: 1, title: 'T', alternateTitles: [], edition: null, type: 'other', releaseYear: null, genres: [], synopsis: null, posterPath: null,
  tmdbId: null, tmdbMediaType: null, country: [], directors: [], cast: [], runtime: null, seasonCount: null, episodeCount: null, watchProviders: [], watchProvidersFetchedAt: null,
  needsReview: REVIEW_FLAG_TEXT, source: 'seed', createdAt: '', updatedAt: '', ...o,
});

describe('TMDb 作品情報の反映', () => {
  it('空欄だけを埋め、種類不明は TMDb の区分にし、自動で付けた確認待ちを外す', () => {
    const p = metadataPatch(work({}), meta, 'now')!;
    expect(p).toMatchObject({ tmdbId: 100, posterPath: '/p.jpg', releaseYear: 2020, synopsis: 'あらすじ', type: 'anime', needsReview: null, watchProvidersFetchedAt: 'now' });
    expect(p.alternateTitles).toEqual(['Orig']);
  });

  it('利用者が入力した値・区分・確認待ちのメモは変えない', () => {
    const p = metadataPatch(work({ type: 'drama', synopsis: '自分で書いた', releaseYear: 1999, needsReview: '自分のメモ' }), meta, 'now')!;
    expect(p.type).toBeUndefined();
    expect(p.synopsis).toBe('自分で書いた');
    expect(p.releaseYear).toBe(1999);
    expect(p.needsReview).toBeUndefined();
  });

  it('既に TMDb と紐付けた作品・元番号の無い作品は対象外', () => {
    expect(metadataPatch(work({ tmdbId: 999 }), meta, 'now')).toBeNull();
    expect(metadataPatch(work({ legacyId: null }), meta, 'now')).toBeNull();
  });

  it('推定で選んだものはデータメモに明記、紐付けなかったものは候補をメモ', () => {
    expect(metadataPatch(work({ legacyId: 2 }), meta, 'now')!.importNote).toMatch(/推定/);
    expect(metadataPatch(work({ legacyId: 4, needsReview: UNKNOWN_TYPE_TEXT }), meta, 'now')!.needsReview).toMatch(/候補：A、B。正しい作品は/);
  });

  it('取り込み時に反映され、評価・状態は変わらない。既存端末への反映は1回で済む（2回目は変更なし）', async () => {
    const rows = [
      { legacy_id: '1', title: 'アニメA', media_type: 'unknown', status: 'watched_rated', rating: '4', metadata_review_required: 'True' },
      { legacy_id: '2', title: '映画B', media_type: 'movie', status: 'unconfirmed', rating: '', metadata_review_required: 'True' },
      { legacy_id: '4', title: '不明C', media_type: 'unknown', status: 'unconfirmed', rating: '', metadata_review_required: 'True' },
    ];
    // 既存端末：作品情報なしで登録済み → あとから反映
    const { repo } = freshRepo();
    await importSeed(repo, rows);
    let snap = await repo.load();
    const updates = planMetadataApply(snap.works, meta, 'now');
    expect(updates).toHaveLength(3);
    await repo.applyChanges({ works: updates.map(({ workId, patch }) => ({ ...snap.works.find((w) => w.id === workId)!, ...patch })) }, 'merge');
    snap = await repo.load();
    const idx = buildIndex(snap);
    const a = idx.bundles.find((b) => b.work.legacyId === 1)!;
    expect(a.work.posterPath).toBe('/p.jpg');
    expect(a.work.type).toBe('anime');
    expect(a.user.rating).toBe(4);
    expect(idx.bundles.find((b) => b.work.legacyId === 2)!.user.status).toBe('unconfirmed');
    expect(planMetadataApply(snap.works, meta, 'now')).toHaveLength(0);

    // 新しい端末：取り込み時にそのまま反映
    const fresh = freshRepo();
    const plan = planSeedImport(normalizeSeed(rows), await fresh.repo.load(), 'now', meta);
    await fresh.repo.applyChanges(plan.changes, 'merge');
    const w1 = (await fresh.repo.load()).works.find((w) => w.legacyId === 1)!;
    expect(w1).toMatchObject({ tmdbId: 100, posterPath: '/p.jpg', type: 'anime', needsReview: null });
  });
});
