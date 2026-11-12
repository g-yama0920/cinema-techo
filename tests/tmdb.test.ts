/** TMDb：サーバー側プロキシとクライアント（ネットワークはモック） */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleTmdbRequest } from '../server/tmdb-core';
import { TmdbClient, TmdbError } from '../src/services/tmdb/client';

afterEach(() => vi.unstubAllGlobals());

describe('プロキシ（サーバー側）', () => {
  it('キー未設定でも _status は答え、検索は 503', async () => {
    const st = await handleTmdbRequest(new Request('http://x/api/tmdb/_status'), {});
    expect(await st.json()).toEqual({ configured: false });
    const res = await handleTmdbRequest(new Request('http://x/api/tmdb/3/search/movie?query=a'), {});
    expect(res.status).toBe(503);
  });

  it('許可していないパスは中継しない', async () => {
    const res = await handleTmdbRequest(new Request('http://x/api/tmdb/3/account'), { TMDB_READ_ACCESS_TOKEN: 't' });
    expect(res.status).toBe(404);
  });

  it('キーはサーバー側でヘッダーに付け、余計なパラメータは捨てる', async () => {
    const fetchMock = vi.fn(async () => new Response('{"results":[]}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await handleTmdbRequest(new Request('http://x/api/tmdb/3/search/tv?query=三体&evil=1'), { TMDB_READ_ACCESS_TOKEN: 'secret' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toContain('https://api.themoviedb.org/3/search/tv');
    expect(String(url)).toContain('language=ja-JP');
    expect(String(url)).not.toContain('evil');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer secret');
  });
});

describe('クライアント', () => {
  const settings = { tmdbMode: 'proxy' as const, tmdbPersonalToken: '' };

  it('アニメーションは「アニメ」、TV は「ドラマ」として候補を出す（同名作品は年・種別で区別）', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        total_pages: 1,
        results: [
          { media_type: 'tv', id: 1, name: '三体', original_name: '三体', first_air_date: '2023-01-15', genre_ids: [18], origin_country: ['CN'] },
          { media_type: 'tv', id: 2, name: '三体', original_name: '3 Body Problem', first_air_date: '2024-03-21', genre_ids: [18], origin_country: ['US'] },
          { media_type: 'tv', id: 3, name: 'ルパン三世', first_air_date: '1984-03-03', genre_ids: [16, 35], origin_country: ['JP'] },
          { media_type: 'person', id: 9, name: '人物' },
        ],
      }),
    );
    const c = new TmdbClient({ getSettings: () => settings, proxyBase: 'http://x/api/tmdb', fetchImpl: fetchImpl as unknown as typeof fetch });
    const { results } = await c.search('三体', 'multi');
    expect(results.map((r) => [r.tmdbId, r.year, r.suggestedType])).toEqual([
      [1, 2023, 'drama'],
      [2, 2024, 'drama'],
      [3, 1984, 'anime'],
    ]);
  });

  it('詳細：監督・出演・制作国・日本の配信サービスを取り出す', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        id: 10,
        title: '作品',
        original_title: 'Work',
        release_date: '2020-05-01',
        runtime: 118,
        genres: [{ id: 18, name: 'ドラマ' }],
        production_countries: [{ iso_3166_1: 'JP' }],
        overview: 'あらすじ',
        credits: { crew: [{ job: 'Director', name: '監督A' }], cast: [{ name: '俳優A' }, { name: '俳優B' }] },
        'watch/providers': { results: { JP: { flatrate: [{ provider_name: 'Netflix', logo_path: '/n.png' }], rent: [{ provider_name: 'Apple TV', logo_path: null }] } } },
      }),
    );
    const c = new TmdbClient({ getSettings: () => settings, proxyBase: 'http://x/api/tmdb', fetchImpl: fetchImpl as unknown as typeof fetch });
    const d = await c.details('movie', 10);
    expect(d.directors).toEqual(['監督A']);
    expect(d.cast).toEqual(['俳優A', '俳優B']);
    expect(d.countries).toEqual(['日本']);
    expect(d.runtime).toBe(118);
    expect(d.providers.map((p) => `${p.kind}:${p.name}`)).toEqual(['flatrate:Netflix', 'rent:Apple TV']);
  });

  it('キー未設定・オフライン時は分かりやすいエラー（アプリ本体は止めない）', async () => {
    const c503 = new TmdbClient({ getSettings: () => settings, proxyBase: 'http://x', fetchImpl: (async () => new Response('', { status: 503 })) as unknown as typeof fetch });
    await expect(c503.search('a', 'movie')).rejects.toMatchObject({ kind: 'not_configured' });
    const offline = new TmdbClient({ getSettings: () => settings, proxyBase: 'http://x', fetchImpl: (async () => { throw new TypeError('fail'); }) as unknown as typeof fetch });
    await expect(offline.search('a', 'movie')).rejects.toBeInstanceOf(TmdbError);
    expect(await offline.isAvailable()).toBe(false);
    const off = new TmdbClient({ getSettings: () => ({ tmdbMode: 'off', tmdbPersonalToken: '' }), proxyBase: 'http://x' });
    expect(await off.isAvailable()).toBe(false);
  });
});
