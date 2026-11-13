/**
 * 同梱する TMDb の作品情報（seed/tmdb_metadata.json）を作品に反映する。
 *
 * - 元番号（legacyId）で対応づける。タイトルの一致では判断しない
 * - 空欄だけを埋める（利用者が入力・変更した値、評価・視聴状況は変えない）
 * - 種類が不明（other）の作品だけ、TMDb の区分（映画・ドラマ・アニメ）を使う
 * - 「作品の特定が必要」の印は、紐付けが確定したものだけ外す（利用者が書き換えた印は残す）
 */
import { REVIEW_FLAG_TEXT, UNKNOWN_TYPE_TEXT } from './seed';
import type { TmdbMediaType, WatchProvider, Work, WorkType } from './types';

export interface TmdbMetadataItem {
  tmdbId: number;
  mediaType: TmdbMediaType;
  /** auto=自動 / confirmed=利用者が承認 / estimated=利用者が一任し推定で選択 */
  match: 'auto' | 'confirmed' | 'estimated';
  suggestedType: Exclude<WorkType, 'other'>;
  title: string;
  originalTitle: string;
  posterPath: string | null;
  releaseYear: number | null;
  synopsis: string | null;
  genres: string[];
  country: string[];
  directors: string[];
  cast: string[];
  runtime: number | null;
  seasonCount: number | null;
  episodeCount: number | null;
  watchProviders: WatchProvider[];
}

export interface TmdbMetadataFile {
  version: number;
  generatedAt: string;
  source: string;
  items: Record<string, TmdbMetadataItem>;
  /** 紐付けなかった作品（元番号 → 候補のメモ） */
  unresolved: Record<string, string>;
}

const ESTIMATED_NOTE = 'TMDb の作品情報は推定で紐付けています（違う場合は「編集」から変更できます）';
const LINK_HINT = '正しい作品は「編集 → TMDb で探して紐付ける」から選べます。';

/** 取り込み時・既存データの補完時に共通で使う、自動で付けた（＝書き換えてよい）確認待ちの文言か */
function isGenericReview(text: string | null): boolean {
  if (!text) return true;
  return text
    .split(' / ')
    .every((t) => t === REVIEW_FLAG_TEXT || t === UNKNOWN_TYPE_TEXT);
}

/** 1作品分の更新内容。対象外・変更なしなら null */
export function metadataPatch(work: Work, file: TmdbMetadataFile, fetchedAt: string): Partial<Work> | null {
  if (work.legacyId == null) return null;
  const key = String(work.legacyId);
  const m = file.items[key];
  if (m) {
    if (work.tmdbId != null) return null; // 既に紐付け済み（利用者の選択を優先）
    const patch: Partial<Work> = {
      tmdbId: m.tmdbId,
      tmdbMediaType: m.mediaType,
      posterPath: work.posterPath ?? m.posterPath,
      releaseYear: work.releaseYear ?? m.releaseYear,
      synopsis: work.synopsis || m.synopsis,
      genres: work.genres.length ? work.genres : m.genres,
      country: work.country.length ? work.country : m.country,
      directors: work.directors.length ? work.directors : m.directors,
      cast: work.cast.length ? work.cast : m.cast,
      runtime: work.runtime ?? m.runtime,
      seasonCount: work.seasonCount ?? m.seasonCount,
      episodeCount: work.episodeCount ?? m.episodeCount,
      watchProviders: work.watchProviders.length ? work.watchProviders : m.watchProviders,
      watchProvidersFetchedAt: work.watchProviders.length ? work.watchProvidersFetchedAt : fetchedAt,
      alternateTitles:
        m.originalTitle && m.originalTitle !== work.title && !work.alternateTitles.includes(m.originalTitle)
          ? [...work.alternateTitles, m.originalTitle]
          : work.alternateTitles,
    };
    if (work.type === 'other') patch.type = m.suggestedType;
    if (isGenericReview(work.needsReview)) patch.needsReview = null;
    if (m.match === 'estimated' && !(work.importNote ?? '').includes(ESTIMATED_NOTE)) {
      patch.importNote = [work.importNote, ESTIMATED_NOTE].filter(Boolean).join(' / ');
    }
    return patch;
  }
  const note = file.unresolved[key];
  if (note && isGenericReview(work.needsReview)) {
    const text = `${note}。${LINK_HINT}`;
    return work.needsReview === text ? null : { needsReview: text };
  }
  return null;
}

/** 既存の作品のうち、補完が必要なものと更新内容 */
export function planMetadataApply(works: Work[], file: TmdbMetadataFile, fetchedAt: string): { workId: string; patch: Partial<Work> }[] {
  const out: { workId: string; patch: Partial<Work> }[] = [];
  for (const w of works) {
    const patch = metadataPatch(w, file, fetchedAt);
    if (patch) out.push({ workId: w.id, patch });
  }
  return out;
}
