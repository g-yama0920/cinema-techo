/**
 * 登録済み作品の情報（ポスター・公開年・ジャンル・あらすじ等）を TMDb から一括取得する。
 *
 * 誤った作品への紐付けを避けるため、次の条件を満たす候補が「ちょうど1件」のときだけ自動で紐付ける。
 *  - タイトル（または別題・原題）が正規化して完全一致
 *  - 区分が一致（映画=movie / ドラマ=tv かつアニメーション以外 / アニメ=アニメーション）
 *  - 公開年が登録済みなら一致（前後1年のずれは、他に候補が無い場合だけ許容）
 * 候補が複数・区分違いしか無い場合は「確認待ち」にし、利用者が選ぶ。見つからない場合は何も変えない。
 * 「確認待ち」「その他（漫画など）」の作品と、TMDb ID が既にある作品は対象外。
 */
import type { LibraryRepository, WorkPatch } from '../../data/repository';
import { nowISO } from '../../domain/dates';
import { titleKey } from '../../domain/text';
import type { Work } from '../../domain/types';
import type { TmdbClient, TmdbDetails, TmdbSearchResult } from './client';

export type MatchResult = { kind: 'unique'; result: TmdbSearchResult } | { kind: 'ambiguous'; candidates: TmdbSearchResult[]; reason: string } | { kind: 'none' };

export interface EnrichOutcome {
  workId: string;
  title: string;
  catalogNo: number;
  result: 'linked' | 'ambiguous' | 'notFound' | 'error';
  detail: string;
}

export function isEnrichTarget(w: Work): boolean {
  return w.tmdbId == null && !w.needsReview && w.type !== 'other';
}

function typeMatches(w: Work, r: TmdbSearchResult): boolean {
  if (w.type === 'movie') return r.mediaType === 'movie' && !r.isAnimation;
  if (w.type === 'drama') return r.mediaType === 'tv' && !r.isAnimation;
  if (w.type === 'anime') return r.isAnimation;
  return false;
}

export function pickCandidate(w: Work, results: TmdbSearchResult[]): MatchResult {
  const keys = new Set([w.title, ...w.alternateTitles].map(titleKey).filter(Boolean));
  const sameTitle = results.filter((r) => [r.title, r.originalTitle].map(titleKey).some((k) => keys.has(k)));
  if (!sameTitle.length) return { kind: 'none' };
  const typed = sameTitle.filter((r) => typeMatches(w, r));
  if (!typed.length) return { kind: 'ambiguous', candidates: sameTitle, reason: '同じタイトルの候補はありますが、区分（映画・ドラマ・アニメ）が一致しません' };
  if (w.releaseYear != null) {
    const exact = typed.filter((r) => r.year === w.releaseYear);
    if (exact.length === 1) return { kind: 'unique', result: exact[0] };
    if (exact.length > 1) return { kind: 'ambiguous', candidates: exact, reason: `同じタイトル・同じ年の候補が${exact.length}件あります` };
    const near = typed.filter((r) => r.year != null && Math.abs(r.year - w.releaseYear!) <= 1);
    if (near.length === 1 && typed.length === 1) return { kind: 'unique', result: near[0] };
    return { kind: 'ambiguous', candidates: typed, reason: `公開年 ${w.releaseYear} と一致する候補がありません` };
  }
  if (typed.length === 1) return { kind: 'unique', result: typed[0] };
  return { kind: 'ambiguous', candidates: typed, reason: `同じタイトルの候補が${typed.length}件あります（公開年が未登録のため特定できません）` };
}

/** 空欄だけを TMDb の情報で埋める（タイトル・区分・評価・利用者が入れた値は変えない） */
export function patchFromDetails(w: Work, r: TmdbSearchResult, d: TmdbDetails | null): WorkPatch {
  return {
    tmdbId: r.tmdbId,
    tmdbMediaType: r.mediaType,
    posterPath: w.posterPath ?? d?.posterPath ?? r.posterPath,
    releaseYear: w.releaseYear ?? d?.year ?? r.year,
    synopsis: w.synopsis || d?.overview || r.overview || null,
    genres: w.genres.length ? w.genres : (d?.genres ?? []),
    country: w.country.length ? w.country : (d?.countries ?? []),
    directors: w.directors.length ? w.directors : (d?.directors ?? []),
    cast: w.cast.length ? w.cast : (d?.cast ?? []),
    runtime: w.runtime ?? d?.runtime ?? null,
    seasonCount: w.seasonCount ?? d?.seasonCount ?? null,
    episodeCount: w.episodeCount ?? d?.episodeCount ?? null,
    alternateTitles: d && d.originalTitle && titleKey(d.originalTitle) !== titleKey(w.title) && !w.alternateTitles.includes(d.originalTitle) ? [...w.alternateTitles, d.originalTitle] : w.alternateTitles,
    watchProviders: d?.providers ?? w.watchProviders,
    watchProvidersFetchedAt: d ? nowISO() : w.watchProvidersFetchedAt,
  };
}

const describe = (r: TmdbSearchResult) => `${r.title}（${r.year ?? '年不明'}・${r.mediaType === 'movie' ? '映画' : 'TV'}${r.isAnimation ? '・アニメ' : ''}）`;

export async function enrichWorks(
  works: Work[],
  client: TmdbClient,
  repo: LibraryRepository,
  opts: { signal?: AbortSignal; onProgress?: (done: number, outcome: EnrichOutcome) => void; delayMs?: number } = {},
): Promise<EnrichOutcome[]> {
  const out: EnrichOutcome[] = [];
  const targets = works.filter(isEnrichTarget);
  for (const w of targets) {
    if (opts.signal?.aborted) break;
    let outcome: EnrichOutcome;
    try {
      const kind = w.type === 'movie' ? 'movie' : w.type === 'drama' ? 'tv' : 'multi';
      let match: MatchResult = { kind: 'none' };
      for (const q of [w.title, ...w.alternateTitles.slice(0, 2)]) {
        const { results } = await client.search(q, kind);
        match = pickCandidate(w, results);
        if (match.kind !== 'none') break;
      }
      if (match.kind === 'unique') {
        const d = await client.details(match.result.mediaType, match.result.tmdbId).catch(() => null);
        await repo.updateWork(w.id, patchFromDetails(w, match.result, d));
        outcome = { workId: w.id, title: w.title, catalogNo: w.catalogNo, result: 'linked', detail: describe(match.result) };
      } else if (match.kind === 'ambiguous') {
        const list = match.candidates.slice(0, 4).map(describe).join(' / ');
        await repo.updateWork(w.id, { needsReview: `TMDb の候補を特定できません：${match.reason}。候補：${list}。「編集 → TMDb で探して紐付ける」から正しい作品を選んでください。` });
        outcome = { workId: w.id, title: w.title, catalogNo: w.catalogNo, result: 'ambiguous', detail: match.reason };
      } else {
        outcome = { workId: w.id, title: w.title, catalogNo: w.catalogNo, result: 'notFound', detail: 'TMDb に同じタイトルの作品が見つかりません' };
      }
    } catch (e) {
      outcome = { workId: w.id, title: w.title, catalogNo: w.catalogNo, result: 'error', detail: e instanceof Error ? e.message : '取得に失敗しました' };
      // 接続できない・キー未設定の場合は続けても失敗するので止める
      if (e && typeof e === 'object' && 'kind' in e && ['not_configured', 'network', 'auth'].includes(String((e as { kind: string }).kind))) {
        out.push(outcome);
        opts.onProgress?.(out.length, outcome);
        break;
      }
    }
    out.push(outcome);
    opts.onProgress?.(out.length, outcome);
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
  }
  return out;
}
