// 紐付け表（seed/tmdb_decisions.json）から TMDb の作品情報を取得し、アプリに同梱する
// seed/tmdb_metadata.json を作る。
//   NODE_USE_ENV_PROXY=1 node scripts/tmdb-build-metadata.mjs
// 認証はネットワークの中継（プロキシ）が付けるため、このスクリプトはキーを扱わない。
import { readFileSync, writeFileSync } from 'node:fs';

const API = 'https://api.themoviedb.org/3';
const ANIMATION = 16;
const COUNTRY_JA = {
  JP: '日本', US: 'アメリカ', GB: 'イギリス', FR: 'フランス', KR: '韓国', CN: '中国', TW: '台湾', HK: '香港', DE: 'ドイツ', IT: 'イタリア',
  ES: 'スペイン', CA: 'カナダ', AU: 'オーストラリア', IN: 'インド', TH: 'タイ', SE: 'スウェーデン', DK: 'デンマーク', NO: 'ノルウェー',
  NZ: 'ニュージーランド', IE: 'アイルランド', BE: 'ベルギー', MX: 'メキシコ', BR: 'ブラジル', RU: 'ロシア', PL: 'ポーランド', FI: 'フィンランド',
  ZA: '南アフリカ', CZ: 'チェコ', HU: 'ハンガリー', AT: 'オーストリア', CH: 'スイス', NL: 'オランダ',
};

/** TMDb で日本語名が無い（または不自然な）ジャンル名を日本語にそろえる */
const GENRE_JA = {
  'Action & Adventure': 'アクション・アドベンチャー', 'Sci-Fi & Fantasy': 'SF・ファンタジー', 'War & Politics': '戦争・政治',
  Kids: 'キッズ', News: 'ニュース', Reality: 'リアリティ', Soap: 'ソープ', Talk: 'トーク', 謎: 'ミステリー', 履歴: '歴史',
};

async function get(path, params = {}) {
  const u = new URL(API + path);
  for (const [k, v] of Object.entries({ language: 'ja-JP', ...params })) u.searchParams.set(k, String(v));
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(u, { headers: { accept: 'application/json' } });
    if (r.status === 429) { await new Promise((s) => setTimeout(s, 2000)); continue; }
    if (!r.ok) throw new Error(`${r.status} ${path}`);
    return r.json();
  }
  throw new Error(`rate limited ${path}`);
}

const decisions = JSON.parse(readFileSync('seed/tmdb_decisions.json', 'utf8'));
const now = new Date().toISOString();
const items = {};
const unresolved = {};
let n = 0;
for (const [no, d] of Object.entries(decisions)) {
  if (d.none) { unresolved[no] = d.note; continue; }
  const x = await get(`/${d.mediaType}/${d.tmdbId}`, { append_to_response: 'credits,watch/providers' });
  const movie = d.mediaType === 'movie';
  const animation = (x.genres || []).some((g) => g.id === ANIMATION);
  const crew = x.credits?.crew || [];
  const directors = movie
    ? crew.filter((c) => c.job === 'Director').map((c) => c.name)
    : [...(x.created_by || []).map((c) => c.name), ...crew.filter((c) => c.job === 'Director').map((c) => c.name)];
  const jp = x['watch/providers']?.results?.JP || {};
  const providers = [];
  for (const kind of ['flatrate', 'free', 'ads', 'rent', 'buy']) {
    for (const p of jp[kind] || []) if (!providers.some((q) => q.name === p.provider_name && q.kind === kind)) providers.push({ name: p.provider_name, logoPath: p.logo_path || null, kind });
  }
  const countries = movie ? (x.production_countries || []).map((c) => c.iso_3166_1) : x.origin_country || [];
  items[no] = {
    tmdbId: d.tmdbId,
    mediaType: d.mediaType,
    match: d.match,
    /** TMDb から見た区分（元データで種類が不明な作品だけに使う） */
    suggestedType: animation ? 'anime' : movie ? 'movie' : 'drama',
    title: movie ? x.title : x.name,
    originalTitle: movie ? x.original_title : x.original_name,
    posterPath: x.poster_path || null,
    releaseYear: Number(((movie ? x.release_date : x.first_air_date) || '').slice(0, 4)) || null,
    synopsis: x.overview || null,
    genres: [...new Set((x.genres || []).map((g) => GENRE_JA[g.name] || g.name))],
    country: [...new Set(countries.map((c) => COUNTRY_JA[c] || c))],
    directors: [...new Set(directors)].slice(0, 4),
    cast: (x.credits?.cast || []).slice(0, 8).map((c) => c.name),
    runtime: movie ? x.runtime || null : (x.episode_run_time || [])[0] || null,
    seasonCount: movie ? null : x.number_of_seasons ?? null,
    episodeCount: movie ? null : x.number_of_episodes ?? null,
    watchProviders: providers,
  };
  n++;
  await new Promise((s) => setTimeout(s, 40));
}
const out = {
  version: 1,
  generatedAt: now,
  source: 'TMDB (This product uses the TMDB API but is not endorsed or certified by TMDB.) / 配信情報: JustWatch',
  items,
  unresolved,
};
writeFileSync('seed/tmdb_metadata.json', JSON.stringify(out, null, 1) + '\n');
const noPoster = Object.entries(items).filter(([, v]) => !v.posterPath).map(([k]) => k);
console.error(`取得 ${n} 件 / 紐付けなし ${Object.keys(unresolved).length} 件 / ポスターなし ${noPoster.length} 件 ${noPoster.join(',')}`);
