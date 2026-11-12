/**
 * TMDb API へのプロキシ（プラットフォーム非依存。Web 標準の Request/Response のみ使用）。
 * - API キーはサーバー側の環境変数からだけ読む（ブラウザに渡さない）
 * - 許可したパスの GET だけを中継（任意 URL の中継に使われないように）
 */
export interface TmdbEnv {
  TMDB_READ_ACCESS_TOKEN?: string;
  TMDB_API_KEY?: string;
}

const ALLOWED = [
  /^\/3\/search\/(movie|tv|multi)$/,
  /^\/3\/(movie|tv)\/\d+$/,
  /^\/3\/(movie|tv)\/\d+\/(watch\/providers|credits|aggregate_credits|alternative_titles)$/,
  /^\/3\/genre\/(movie|tv)\/list$/,
  /^\/3\/configuration$/,
];

const ALLOWED_PARAMS = new Set(['query', 'language', 'page', 'include_adult', 'year', 'first_air_date_year', 'primary_release_year', 'region', 'append_to_response']);

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

/**
 * @param request 受信したリクエスト
 * @param env 環境変数
 * @param prefix プロキシのパス接頭辞（既定 /api/tmdb）
 */
export async function handleTmdbRequest(request: Request, env: TmdbEnv, prefix = '/api/tmdb'): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) || '/' : url.pathname;
  const token = env.TMDB_READ_ACCESS_TOKEN?.trim();
  const key = env.TMDB_API_KEY?.trim();

  if (path === '/_status') return json({ configured: Boolean(token || key) });
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  if (!ALLOWED.some((re) => re.test(path))) return json({ error: 'not_allowed' }, 404);
  if (!token && !key) return json({ error: 'not_configured' }, 503);

  const upstream = new URL(`https://api.themoviedb.org${path}`);
  for (const [k, v] of url.searchParams) if (ALLOWED_PARAMS.has(k)) upstream.searchParams.set(k, v);
  if (!upstream.searchParams.has('language')) upstream.searchParams.set('language', 'ja-JP');
  const headers: Record<string, string> = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  else if (key) upstream.searchParams.set('api_key', key);

  try {
    const res = await fetch(upstream, { headers });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        // 検索結果・作品情報は短時間キャッシュしてよい
        'cache-control': res.ok ? 'public, max-age=600' : 'no-store',
      },
    });
  } catch {
    return json({ error: 'upstream_unreachable' }, 502);
  }
}
