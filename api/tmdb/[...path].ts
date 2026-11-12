/**
 * Vercel 用のサーバーレス関数（Edge Runtime）。
 * Vercel のプロジェクト設定 > Environment Variables に TMDB_READ_ACCESS_TOKEN（または TMDB_API_KEY）を設定する。
 */
import { handleTmdbRequest } from '../../server/tmdb-core';

export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

export default function handler(request: Request): Promise<Response> {
  return handleTmdbRequest(request, {
    TMDB_READ_ACCESS_TOKEN: process.env.TMDB_READ_ACCESS_TOKEN,
    TMDB_API_KEY: process.env.TMDB_API_KEY,
  });
}
