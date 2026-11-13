import type { Settings, TmdbMediaType, WatchProvider, WorkType } from '../../domain/types';

/** TMDb のジャンル ID: アニメーション */
const ANIMATION = 16;

export interface TmdbSearchResult {
  tmdbId: number;
  mediaType: TmdbMediaType;
  title: string;
  originalTitle: string;
  year: number | null;
  posterPath: string | null;
  overview: string;
  originCountry: string[];
  originalLanguage: string;
  isAnimation: boolean;
  /** アプリ内の区分の候補（最終的にはユーザーが選ぶ） */
  suggestedType: WorkType;
}

export interface TmdbDetails {
  tmdbId: number;
  mediaType: TmdbMediaType;
  title: string;
  originalTitle: string;
  year: number | null;
  posterPath: string | null;
  overview: string;
  genres: string[];
  countries: string[];
  directors: string[];
  cast: string[];
  runtime: number | null;
  seasonCount: number | null;
  episodeCount: number | null;
  providers: WatchProvider[];
  isAnimation: boolean;
  suggestedType: WorkType;
}

export class TmdbError extends Error {
  constructor(
    message: string,
    readonly kind: 'not_configured' | 'network' | 'auth' | 'rate_limit' | 'not_found' | 'unknown',
  ) {
    super(message);
  }
}

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const COUNTRY_JA: Record<string, string> = {
  JP: '日本', US: 'アメリカ', GB: 'イギリス', FR: 'フランス', KR: '韓国', CN: '中国', TW: '台湾', HK: '香港', DE: 'ドイツ', IT: 'イタリア',
  ES: 'スペイン', CA: 'カナダ', AU: 'オーストラリア', IN: 'インド', TH: 'タイ', SE: 'スウェーデン', DK: 'デンマーク', NO: 'ノルウェー',
  NZ: 'ニュージーランド', IE: 'アイルランド', BE: 'ベルギー', MX: 'メキシコ', BR: 'ブラジル', RU: 'ロシア', PL: 'ポーランド', FI: 'フィンランド',
};

export function countryName(code: string): string {
  return COUNTRY_JA[code] ?? code;
}

function yearOf(s: unknown): number | null {
  const m = /^(\d{4})/.exec(String(s ?? ''));
  return m ? Number(m[1]) : null;
}

function suggestType(mediaType: TmdbMediaType, isAnimation: boolean): WorkType {
  if (isAnimation) return 'anime';
  return mediaType === 'movie' ? 'movie' : 'drama';
}

export interface TmdbClientOptions {
  getSettings: () => Pick<Settings, 'tmdbMode' | 'tmdbPersonalToken'>;
  /** プロキシのベース URL（既定: アプリと同じ場所の api/tmdb） */
  proxyBase?: string;
  fetchImpl?: typeof fetch;
}

export class TmdbClient {
  private statusCache: { at: number; ok: boolean } | null = null;
  constructor(private readonly opts: TmdbClientOptions) {}

  private get fetch() {
    return this.opts.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  }

  private proxyBase(): string {
    if (this.opts.proxyBase) return this.opts.proxyBase;
    return new URL(`${import.meta.env.BASE_URL ?? '/'}api/tmdb`, window.location.href).toString().replace(/\/$/, '');
  }

  /** 利用可能か（キー未設定なら false。アプリの他の機能には影響しない） */
  async isAvailable(): Promise<boolean> {
    const s = this.opts.getSettings();
    if (s.tmdbMode === 'off') return false;
    if (s.tmdbMode === 'personal') return Boolean(s.tmdbPersonalToken.trim());
    // 中継サーバーの無い公開先では確認の通信をしない（404 を出さない）
    if (!this.opts.proxyBase && !__TMDB_PROXY__) return false;
    if (this.statusCache && Date.now() - this.statusCache.at < 60_000) return this.statusCache.ok;
    try {
      const res = await this.fetch(`${this.proxyBase()}/_status`, { headers: { accept: 'application/json' } });
      const ok = res.ok && ((await res.json()) as { configured?: boolean }).configured === true;
      this.statusCache = { at: Date.now(), ok };
      return ok;
    } catch {
      this.statusCache = { at: Date.now(), ok: false };
      return false;
    }
  }

  private async get(path: string, params: Record<string, string>): Promise<Raw> {
    const s = this.opts.getSettings();
    if (s.tmdbMode === 'off') throw new TmdbError('TMDb 連携はオフです', 'not_configured');
    const qs = new URLSearchParams({ language: 'ja-JP', ...params });
    let url: string;
    const headers: Record<string, string> = { accept: 'application/json' };
    if (s.tmdbMode === 'personal') {
      const t = s.tmdbPersonalToken.trim();
      if (!t) throw new TmdbError('個人トークンが未設定です', 'not_configured');
      // 32 桁の英数字は v3 API キー、それ以外は v4 読み取りトークンとして扱う
      if (/^[a-f0-9]{32}$/i.test(t)) qs.set('api_key', t);
      else headers.authorization = `Bearer ${t}`;
      url = `https://api.themoviedb.org/3${path}?${qs}`;
    } else {
      url = `${this.proxyBase()}/3${path}?${qs}`;
    }
    let res: Response;
    try {
      res = await this.fetch(url, { headers });
    } catch {
      throw new TmdbError('TMDb に接続できません（オフラインの可能性があります）', 'network');
    }
    if (res.status === 503) throw new TmdbError('TMDb の API キーがサーバーに設定されていません', 'not_configured');
    if (res.status === 401 || res.status === 403) throw new TmdbError('TMDb の認証に失敗しました（キーを確認してください）', 'auth');
    if (res.status === 429) throw new TmdbError('TMDb へのアクセスが多すぎます。少し待ってから再度お試しください', 'rate_limit');
    if (res.status === 404) throw new TmdbError('TMDb に作品が見つかりません', 'not_found');
    if (!res.ok) throw new TmdbError(`TMDb の取得に失敗しました（${res.status}）`, 'unknown');
    return (await res.json()) as Raw;
  }

  async search(query: string, kind: TmdbMediaType | 'multi', page = 1): Promise<{ results: TmdbSearchResult[]; totalPages: number }> {
    const data = await this.get(`/search/${kind}`, { query, page: String(page), include_adult: 'false' });
    const results = ((data.results ?? []) as Raw[])
      .filter((r) => kind !== 'multi' || r.media_type === 'movie' || r.media_type === 'tv')
      .map((r) => {
        const mediaType: TmdbMediaType = kind === 'multi' ? r.media_type : kind;
        const isAnimation = Array.isArray(r.genre_ids) && r.genre_ids.includes(ANIMATION);
        return {
          tmdbId: r.id,
          mediaType,
          title: (mediaType === 'movie' ? r.title : r.name) ?? '',
          originalTitle: (mediaType === 'movie' ? r.original_title : r.original_name) ?? '',
          year: yearOf(mediaType === 'movie' ? r.release_date : r.first_air_date),
          posterPath: r.poster_path ?? null,
          overview: r.overview ?? '',
          originCountry: r.origin_country ?? [],
          originalLanguage: r.original_language ?? '',
          isAnimation,
          suggestedType: suggestType(mediaType, isAnimation),
        } satisfies TmdbSearchResult;
      });
    return { results, totalPages: data.total_pages ?? 1 };
  }

  async details(mediaType: TmdbMediaType, id: number): Promise<TmdbDetails> {
    const d = await this.get(`/${mediaType}/${id}`, { append_to_response: 'credits,watch/providers' });
    const genres = ((d.genres ?? []) as Raw[]).map((g) => String(g.name));
    const isAnimation = ((d.genres ?? []) as Raw[]).some((g) => g.id === ANIMATION);
    const crew = (d.credits?.crew ?? []) as Raw[];
    const directors =
      mediaType === 'movie'
        ? crew.filter((c) => c.job === 'Director').map((c) => String(c.name))
        : ((d.created_by ?? []) as Raw[]).map((c) => String(c.name)).concat(crew.filter((c) => c.job === 'Director').map((c) => String(c.name)));
    const cast = ((d.credits?.cast ?? []) as Raw[]).slice(0, 10).map((c) => String(c.name));
    const countries =
      mediaType === 'movie'
        ? ((d.production_countries ?? []) as Raw[]).map((c) => countryName(String(c.iso_3166_1)))
        : ((d.origin_country ?? []) as string[]).map(countryName);
    const jp = d['watch/providers']?.results?.JP ?? {};
    const providers: WatchProvider[] = [];
    for (const kind of ['flatrate', 'free', 'ads', 'rent', 'buy'] as const) {
      for (const p of (jp[kind] ?? []) as Raw[]) {
        if (!providers.some((x) => x.name === p.provider_name && x.kind === kind)) {
          providers.push({ name: String(p.provider_name), logoPath: p.logo_path ?? null, kind });
        }
      }
    }
    const runtime = mediaType === 'movie' ? (d.runtime || null) : (((d.episode_run_time ?? []) as number[])[0] ?? null);
    return {
      tmdbId: d.id,
      mediaType,
      title: (mediaType === 'movie' ? d.title : d.name) ?? '',
      originalTitle: (mediaType === 'movie' ? d.original_title : d.original_name) ?? '',
      year: yearOf(mediaType === 'movie' ? d.release_date : d.first_air_date),
      posterPath: d.poster_path ?? null,
      overview: d.overview ?? '',
      genres,
      countries: [...new Set(countries)],
      directors: [...new Set(directors)],
      cast,
      runtime,
      seasonCount: mediaType === 'tv' ? (d.number_of_seasons ?? null) : null,
      episodeCount: mediaType === 'tv' ? (d.number_of_episodes ?? null) : null,
      providers,
      isAnimation,
      suggestedType: suggestType(mediaType, isAnimation),
    };
  }
}
