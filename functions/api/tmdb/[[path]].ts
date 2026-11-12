/**
 * Cloudflare Pages Functions 用。
 * Pages のプロジェクト設定 > Variables and Secrets に TMDB_READ_ACCESS_TOKEN（または TMDB_API_KEY）を設定する。
 */
import { handleTmdbRequest, type TmdbEnv } from '../../../server/tmdb-core';

export const onRequestGet = (ctx: { request: Request; env: TmdbEnv }): Promise<Response> => handleTmdbRequest(ctx.request, ctx.env);
