import type { Plugin } from 'vite';
import { handleTmdbRequest, type TmdbEnv } from './tmdb-core';

/** 開発サーバー・プレビューサーバーで /api/tmdb を中継する（.env.local の TMDB_* を使用） */
export function tmdbDevProxy(env: TmdbEnv): Plugin {
  const middleware = async (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: () => void) => {
    const reqUrl = req.url ?? '';
    const i = reqUrl.indexOf('/api/tmdb');
    if (i < 0) return next();
    const url = new URL(reqUrl.slice(i), 'http://localhost');
    const response = await handleTmdbRequest(new Request(url, { method: req.method }), env);
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(await response.text());
  };
  return {
    name: 'tmdb-dev-proxy',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
