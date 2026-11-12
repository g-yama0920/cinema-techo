/**
 * 今回の作業完了条件（全107作品）の自動テスト。
 * 実データが未提供のため、同じ構成の架空データ tests/fixtures/sample_full_catalog.(json|csv) を使う。
 * 実データでは tests/seed-verify.test.ts（npm run verify:seed）で同じ条件を確認する。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { CinemaDB } from '../src/data/dexie/db';
import { DexieRepository } from '../src/data/dexie/DexieRepository';
import { buildIndex } from '../src/domain/library';
import { reconcileWithCsv } from '../src/domain/reconcile';
import { normalizeSeed, summarizeSeed } from '../src/domain/seed';
import { queryWorks } from '../src/domain/selectors';
import { computeStats } from '../src/domain/stats';
import { createBackup, parseBackup, previewImport } from '../src/services/backup';
import { planSeedImport } from '../src/services/seedImport';
import type { TmdbClient, TmdbSearchResult } from '../src/services/tmdb/client';
import { enrichWorks, pickCandidate } from '../src/services/tmdb/enrich';
import { freshRepo, importSeed, loadFixture } from './helpers';

const JSON_PATH = 'tests/fixtures/sample_full_catalog.json';
const CSV_PATH = 'tests/fixtures/sample_full_catalog.csv';
const raw = loadFixture(JSON_PATH);
const csvText = readFileSync(CSV_PATH, 'utf8');

async function imported() {
  const { repo, db } = freshRepo();
  await importSeed(repo, raw);
  return { repo, db, idx: buildIndex(await repo.load()) };
}

describe('全107作品の投入', () => {
  it('107作品が重複なく登録され、作品番号 = 元の番号', async () => {
    const { idx } = await imported();
    expect(idx.bundles).toHaveLength(107);
    expect(new Set(idx.bundles.map((b) => b.work.legacyId)).size).toBe(107);
    expect(new Set(idx.bundles.map((b) => b.work.catalogNo)).size).toBe(107);
    for (const b of idx.bundles) expect(b.work.catalogNo).toBe(b.work.legacyId);
  });

  it('分類が一致：評価済み44・評価保留7・未視聴1・見たい3・未確認52', async () => {
    const { idx } = await imported();
    const by = (s: string) => idx.bundles.filter((b) => b.user.status === s).length;
    expect(idx.bundles.filter((b) => b.user.rating != null)).toHaveLength(44);
    expect(by('watched')).toBe(44);
    expect(by('pending')).toBe(7);
    expect(by('unwatched')).toBe(1);
    expect(by('want')).toBe(3);
    expect(by('unconfirmed')).toBe(52);
    // 評価保留は星なし
    for (const b of idx.bundles.filter((x) => x.user.status === 'pending')) expect(b.user.rating).toBeNull();
  });

  it('評価済み44作品の平均は 3.00、未確認は視聴済みに含めない', async () => {
    const { idx } = await imported();
    const s = computeStats(idx, { kind: 'all' }, 'all');
    expect(s.ratedCount).toBe(44);
    expect(s.averageRating!.toFixed(2)).toBe('3.00');
    expect(s.watchedWorks).toBe(51); // 評価済み44 + 評価保留7
    expect(s.unconfirmedCount).toBe(52);
    expect(s.distribution).toEqual([6, 8, 16, 8, 6]);
  });

  it('作品番号と見たいリストの固定番号は別々に保存される', async () => {
    const { idx } = await imported();
    const want = idx.activeWatchlist.map((x) => [x.bundle.work.catalogNo, x.entry.fixedNumber]);
    expect(want).toEqual([
      [105, 1],
      [106, 2],
      [107, 3],
    ]);
    for (const x of idx.activeWatchlist) expect(x.bundle.user.legacyWatchlistNumber).toBe(x.entry.fixedNumber);
    // 次に追加する作品・見たい番号は既存と衝突しない
    expect(idx.snapshot.counters.nextCatalogNo).toBe(108);
    expect(idx.snapshot.counters.nextWatchlistNo).toBe(4);
  });

  it('視聴日が無い作品に架空の日付を入れない（登録日も視聴日にしない）', async () => {
    const { idx } = await imported();
    const dated = idx.bundles.flatMap((b) => b.events).filter((e) => e.watchedOn);
    expect(dated.map((e) => e.watchedOn).sort()).toEqual(['2026-10', '2026-11-03']);
    // 未確認・見たい・未視聴には視聴イベントを作らない
    for (const b of idx.bundles.filter((x) => ['unconfirmed', 'want', 'unwatched'].includes(x.user.status))) expect(b.events).toHaveLength(0);
  });

  it('同名作品は統合せず、漫画・版が曖昧なものは確認待ち', async () => {
    const { idx } = await imported();
    expect(idx.bundles.filter((b) => b.work.title === '灯台守')).toHaveLength(2);
    const review = idx.bundles.filter((b) => b.work.needsReview).map((b) => b.work.legacyId);
    expect(review).toEqual(expect.arrayContaining([47, 60]));
    expect(idx.bundles.find((b) => b.work.legacyId === 60)!.work.type).toBe('other');
  });

  it('元データに明示された状態を優先（No.50 は評価保留のまま）', async () => {
    const { idx } = await imported();
    expect(idx.bundles.find((b) => b.work.legacyId === 50)!.user.status).toBe('pending');
    expect(idx.bundles.find((b) => b.work.title === '三体')!.user.rating).toBe(1);
  });

  it('同じファイルを再インポートしても重複しない', async () => {
    const { repo } = await imported();
    const before = await repo.load();
    const { plan } = await importSeed(repo, raw);
    const after = await repo.load();
    expect(plan.added).toBe(0);
    expect(plan.diffs).toHaveLength(0);
    expect(after.works).toHaveLength(107);
    expect(after.watchlist).toHaveLength(before.watchlist.length);
    expect(after.watchEvents).toHaveLength(before.watchEvents.length);
  });

  it('JSON 記載の集計値（件数・平均）とプレビューが一致', () => {
    const seed = normalizeSeed(raw);
    const s = summarizeSeed(seed);
    expect(seed.errors).toEqual([]);
    expect(s.totalWorks).toBe(107);
    expect(s.averageRating!.toFixed(2)).toBe('3.00');
    expect(seed.declared.averageRating).toBe(3);
  });
});

describe('CSV との照合', () => {
  it('同じ内容なら 107件すべて一致', () => {
    const r = reconcileWithCsv(normalizeSeed(raw), csvText);
    expect(r.csvErrors).toEqual([]);
    expect(r.matched).toBe(107);
    expect(r.mismatches).toEqual([]);
    expect(r.onlyInJson).toEqual([]);
    expect(r.onlyInCsv).toEqual([]);
  });

  it('評価や状態の食い違い・欠けを検出する', () => {
    const lines = csvText.split('\r\n');
    const i1 = lines.findIndex((l) => l.startsWith('1,'));
    lines[i1] = lines[i1].replace(/,\d,評価済み,/, ',5,評価済み,');
    const i9 = lines.findIndex((l) => l.startsWith('9,'));
    lines.splice(i9, 1);
    const r = reconcileWithCsv(normalizeSeed(raw), lines.join('\r\n'));
    expect(r.mismatches.some((m) => m.no === 1 && m.field === '評価')).toBe(true);
    expect(r.onlyInJson.map((x) => x.no)).toContain(9);
  });
});

describe('既存データを守る', () => {
  it('既存データは削除・上書きしない。差分は利用者が選んだときだけ反映', async () => {
    const { repo } = freshRepo();
    // 先に、旧データ相当（No.1 を★5、No.44 を未視聴）と手入力の作品を登録しておく
    const partial = { works: (raw as { works: Record<string, unknown>[] }).works.slice(0, 50).map((w) => (w.work_no === 1 ? { ...w, my_rating: 5 } : w.work_no === 44 ? { ...w, my_rating: null, status: '未視聴' } : w)) };
    await importSeed(repo, partial);
    const manualId = await repo.createWork({ work: { title: '手入力の作品', type: 'movie' }, status: 'watched', rating: 4 });
    const no1 = buildIndex(await repo.load()).bundles.find((b) => b.work.legacyId === 1)!;
    await repo.updateUserWork(no1.work.id, { review: '自分の感想' });

    const seed = normalizeSeed(raw);
    const plan = planSeedImport(seed, await repo.load());
    expect(plan.added).toBe(57);
    expect(plan.diffs.map((d) => d.legacyId).sort((a, b) => a - b)).toEqual([1, 44]);
    await repo.applyChanges(plan.changes, 'merge');
    let idx = buildIndex(await repo.load());
    expect(idx.bundles).toHaveLength(108);
    expect(idx.byId.get(manualId)!.user.rating).toBe(4);
    expect(idx.byId.get(no1.work.id)!.user.rating).toBe(5); // 上書きしていない
    // 取り込み前に手入力した作品が No.51 を使っていたため、元データの No.51 は空き番号を割り当て（元番号は保持・注意を表示）
    expect(idx.byId.get(manualId)!.work.catalogNo).toBe(51);
    const rec51 = idx.bundles.find((b) => b.work.legacyId === 51)!;
    expect(rec51.work.catalogNo).toBe(108);
    expect(plan.warnings.join()).toMatch(/No.51.*管理番号 No.108/);
    expect(new Set(idx.bundles.map((b) => b.work.catalogNo)).size).toBe(108);

    // 利用者が「差分を反映」を選んだ場合
    await repo.applyChanges(plan.updates, 'merge');
    idx = buildIndex(await repo.load());
    const u1 = idx.byId.get(no1.work.id)!;
    expect(u1.user.rating).not.toBe(5);
    expect(u1.user.review).toBe('自分の感想'); // 感想は残る
    expect(u1.ratingHistory[0].source).toBe('import');
    const n44 = idx.bundles.find((b) => b.work.legacyId === 44)!;
    expect(n44.user.status).toBe('watched');
    expect(n44.events).toHaveLength(1);
    const s = computeStats(idx, { kind: 'all' }, 'all');
    expect(s.ratedCount).toBe(45); // 44 + 手入力1
  });
});

describe('操作', () => {
  it('検索・評価変更・視聴状態変更が保存され、再起動後も残る', async () => {
    const name = `full-restart-${Date.now()}`;
    const repo1 = new DexieRepository(new CinemaDB(name));
    await importSeed(repo1, raw);
    let idx = buildIndex(await repo1.load());
    const hits = queryWorks(idx, { type: 'all', status: 'all', sort: 'title', q: '灯台守' });
    expect(hits).toHaveLength(2);
    const unconfirmed = idx.bundles.find((b) => b.user.status === 'unconfirmed' && !b.work.needsReview)!;
    const rated = idx.bundles.find((b) => b.user.rating === 3)!;
    await repo1.setRating(rated.work.id, 4);
    await repo1.setStatus(unconfirmed.work.id, 'unwatched');
    await repo1.markWatched(idx.bundles.find((b) => b.user.status === 'pending')!.work.id, { watchedOn: null, watchedOnPrecision: null }, 2);
    repo1.db.close();

    const repo2 = new DexieRepository(new CinemaDB(name));
    idx = buildIndex(await repo2.load());
    expect(idx.byId.get(rated.work.id)!.user.rating).toBe(4);
    expect(idx.byId.get(unconfirmed.work.id)!.user.status).toBe('unwatched');
    const s = computeStats(idx, { kind: 'all' }, 'all');
    expect(s.ratedCount).toBe(45);
    expect(s.unconfirmedCount).toBe(51);
    expect(s.pendingCount).toBe(6);
  });

  it('バックアップから別の端末へ復元しても件数・評価・番号が一致', async () => {
    const { repo } = await imported();
    const snap = await repo.load();
    const parsed = parseBackup(JSON.stringify(createBackup(snap)));
    if (!parsed.ok) throw new Error(parsed.error);
    const other = freshRepo();
    await other.repo.applyChanges(previewImport(parsed.backup, await other.repo.load()).replace, 'replace');
    const r = buildIndex(await other.repo.load());
    expect(r.bundles).toHaveLength(107);
    expect(computeStats(r, { kind: 'all' }, 'all').averageRating!.toFixed(2)).toBe('3.00');
    expect(r.activeWatchlist.map((x) => x.entry.fixedNumber)).toEqual([1, 2, 3]);
  });
});

describe('TMDb から作品情報を取得（モック）', () => {
  const R = (o: Partial<TmdbSearchResult>): TmdbSearchResult => ({
    tmdbId: 1, mediaType: 'movie', title: '', originalTitle: '', year: null, posterPath: null, overview: '', originCountry: [], originalLanguage: 'ja', isAnimation: false, suggestedType: 'movie', ...o,
  });
  const work = (o: Partial<import('../src/domain/types').Work>) => ({
    id: 'w', catalogNo: 1, legacyId: 1, title: '灯台守', alternateTitles: [], edition: null, type: 'movie' as const, releaseYear: 2019, genres: [], synopsis: null, posterPath: null,
    tmdbId: null, tmdbMediaType: null, country: [], directors: [], cast: [], runtime: null, seasonCount: null, episodeCount: null, watchProviders: [], watchProvidersFetchedAt: null,
    needsReview: null, source: 'seed' as const, createdAt: '', updatedAt: '', ...o,
  });

  it('タイトル・区分・公開年が一致する候補が1件だけなら紐付け', () => {
    const m = pickCandidate(work({}), [R({ tmdbId: 10, title: '灯台守', year: 2019 }), R({ tmdbId: 11, title: '灯台守', year: 1990 }), R({ tmdbId: 12, title: '灯台', year: 2019 })]);
    expect(m.kind === 'unique' && m.result.tmdbId).toBe(10);
  });

  it('同名の候補が複数・区分違いは確認待ち、見つからなければ何もしない', () => {
    expect(pickCandidate(work({ releaseYear: null }), [R({ tmdbId: 10, title: '灯台守', year: 2019 }), R({ tmdbId: 11, title: '灯台守', year: 1990 })]).kind).toBe('ambiguous');
    expect(pickCandidate(work({ type: 'drama' }), [R({ title: '灯台守', year: 2019, mediaType: 'movie' })]).kind).toBe('ambiguous');
    expect(pickCandidate(work({ type: 'anime' }), [R({ title: '灯台守', year: 2019, mediaType: 'tv', isAnimation: false })]).kind).toBe('ambiguous');
    expect(pickCandidate(work({}), [R({ title: '別の作品', year: 2019 })]).kind).toBe('none');
  });

  it('一括取得：紐付け・確認待ち・対象外を正しく振り分け、空欄だけ埋める', async () => {
    const { repo } = await imported();
    const idx = buildIndex(await repo.load());
    const works = idx.bundles.map((b) => b.work);
    const search = vi.fn(async (q: string) => {
      if (q === '灯台守') return { totalPages: 1, results: [R({ tmdbId: 500, title: '灯台守', year: 2019 }), R({ tmdbId: 501, title: '灯台守', mediaType: 'tv', year: 2023 })] };
      if (q === '三体') return { totalPages: 1, results: [R({ tmdbId: 600, title: '三体', mediaType: 'tv', year: 2023 }), R({ tmdbId: 601, title: '三体', mediaType: 'tv', year: 2024 })] };
      return { totalPages: 1, results: [] };
    });
    const details = vi.fn(async (_m: string, id: number) => ({
      tmdbId: id, mediaType: 'movie', title: 'x', originalTitle: 'Lighthouse', year: 2019, posterPath: `/p${id}.jpg`, overview: 'あらすじ', genres: ['ドラマ'], countries: ['日本'],
      directors: ['監督'], cast: ['俳優'], runtime: 100, seasonCount: null, episodeCount: null, providers: [], isAnimation: false, suggestedType: 'movie',
    }));
    const client = { search, details } as unknown as TmdbClient;
    const out = await enrichWorks(works, client, repo);
    const after = buildIndex(await repo.load());
    const lh = after.bundles.filter((b) => b.work.title === '灯台守');
    expect(lh.find((b) => b.work.type === 'movie')!.work.tmdbId).toBe(500);
    expect(lh.find((b) => b.work.type === 'drama')!.work.tmdbId).toBe(501);
    const santai = after.bundles.find((b) => b.work.title === '三体')!;
    expect(santai.work.tmdbId).toBe(600);
    expect(santai.work.posterPath).toBe('/p600.jpg');
    expect(santai.work.genres).toEqual(['ドラマ']);
    expect(santai.user.rating).toBe(1); // 評価は変えない
    // 確認待ち（No.47, No.60）は対象外
    expect(out.some((o) => o.title === 'モンスター')).toBe(false);
    expect(out.filter((o) => o.result === 'linked')).toHaveLength(3);
  });

  it('同名候補が複数なら勝手に決めず確認待ちにする', async () => {
    const { repo } = freshRepo();
    const id = await repo.createWork({ work: { title: '同名作品', type: 'movie' }, status: 'unconfirmed' });
    const client = {
      search: async () => ({ totalPages: 1, results: [R({ tmdbId: 1, title: '同名作品', year: 2001 }), R({ tmdbId: 2, title: '同名作品', year: 2015 })] }),
      details: async () => null,
    } as unknown as TmdbClient;
    const [o] = await enrichWorks((await repo.load()).works, client, repo);
    expect(o.result).toBe('ambiguous');
    const w = (await repo.load()).works.find((x) => x.id === id)!;
    expect(w.tmdbId).toBeNull();
    expect(w.needsReview).toMatch(/候補を特定できません/);
  });
});
