/**
 * ドメインモデル。UI・保存方式（IndexedDB / 将来のクラウド）から独立した純粋な型。
 */

/** アプリ内の区分。漫画など映像作品でないもの・種別不明は "other"（要確認）として分ける */
export type WorkType = 'movie' | 'drama' | 'anime' | 'other';

/** TMDb 側のメディア種別（アニメは TMDb では tv / movie のどちらにもなる） */
export type TmdbMediaType = 'movie' | 'tv';

/**
 * 視聴状態
 * - want: 見たい
 * - watching: 視聴中
 * - watched: 視聴済み（評価あり / 評価なし）
 * - pending: 評価保留（見たが評価を後回しにした）
 * - unwatched: 未視聴（登録はあるが見ていない）
 * - unconfirmed: 未確認（視聴したかどうか分からない。視聴済みには数えない）
 *
 * ※「確認待ち」は状態ではなく Work.needsReview（同名作品・原作との区別などが曖昧）で表す
 */
export type WatchStatus = 'want' | 'watching' | 'watched' | 'pending' | 'unwatched' | 'unconfirmed';

/** 整数5段階評価 */
export type Rating = 1 | 2 | 3 | 4 | 5;

/** 視聴日の精度。日付不明は watchedOn / precision とも null */
export type DatePrecision = 'year' | 'month' | 'day';

export interface WatchProvider {
  name: string;
  logoPath: string | null;
  kind: 'flatrate' | 'rent' | 'buy' | 'free' | 'ads';
}

export interface Work {
  id: string;
  /** 固定管理番号。削除しても再利用しない。初期データは元の No. と同じ */
  catalogNo: number;
  /** 既存記録の元番号（No.1〜）。新規登録作品は null */
  legacyId: number | null;
  title: string;
  alternateTitles: string[];
  /** 同名作品を区別する補足（例: 中国ドラマ版） */
  edition: string | null;
  type: WorkType;
  releaseYear: number | null;
  genres: string[];
  synopsis: string | null;
  /** TMDb の poster_path（例: /abc.jpg）。手動登録で URL を直接指定した場合は https:// から始まる */
  posterPath: string | null;
  tmdbId: number | null;
  tmdbMediaType: TmdbMediaType | null;
  /** 制作国（複数可） */
  country: string[];
  directors: string[];
  cast: string[];
  /** 映画は上映時間、ドラマ・アニメは1話あたりの時間（分）。不明は null */
  runtime: number | null;
  seasonCount: number | null;
  episodeCount: number | null;
  watchProviders: WatchProvider[];
  watchProvidersFetchedAt: string | null;
  /** 要確認の理由（例: 作品の版が未特定）。null なら確認不要 */
  needsReview: string | null;
  source: 'seed' | 'manual' | 'tmdb';
  createdAt: string;
  updatedAt: string;
}

export interface UserWork {
  workId: string;
  status: WatchStatus;
  rating: Rating | null;
  /** 最後に評価した日時。初期データのように不明なら null */
  ratedAt: string | null;
  review: string;
  tags: string[];
  addedAt: string;
  updatedAt: string;
  /** 既存の見たいリストでの元番号 */
  legacyWatchlistNumber: number | null;
}

export interface WatchEvent {
  id: string;
  workId: string;
  /** 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD'。不明なら null（架空の日付は入れない） */
  watchedOn: string | null;
  watchedOnPrecision: DatePrecision | null;
  location: string | null;
  platform: string | null;
  /** 実際の視聴時間（分）。不明なら null（ドラマ・アニメは推定しない） */
  watchedMinutes: number | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  notes: string;
  createdAt: string;
}

export type WatchlistStatus = 'active' | 'watched' | 'removed';

export interface WatchlistEntry {
  id: string;
  /** 作品が削除された場合も番号の履歴を残すため null を許可 */
  workId: string | null;
  /** No.1 から順に付与。削除しても再利用しない */
  fixedNumber: number;
  /** 手動の並び順（小さいほど上） */
  priority: number;
  /** 視聴予定日 YYYY-MM-DD */
  plannedDate: string | null;
  /** 公開予定日 YYYY-MM-DD */
  releaseDate: string | null;
  /** 見られるサービス */
  availableOn: string[];
  note: string;
  addedAt: string;
  status: WatchlistStatus;
  closedAt: string | null;
  /** 削除後も履歴で表示できるよう作品名を控えておく */
  titleSnapshot: string;
}

export interface RatingChange {
  id: string;
  workId: string;
  from: Rating | null;
  to: Rating | null;
  changedAt: string;
  source: 'seed' | 'user' | 'import';
}

export interface Settings {
  /** TMDb 接続方式。proxy=サーバーレスAPI経由 / personal=この端末に保存した個人トークン / off */
  tmdbMode: 'proxy' | 'personal' | 'off';
  tmdbPersonalToken: string;
  lastBackupAt: string | null;
  seedImportedAt: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  tmdbMode: 'proxy',
  tmdbPersonalToken: '',
  lastBackupAt: null,
  seedImportedAt: null,
};

export interface Counters {
  /** 次に割り当てる固定管理番号 */
  nextCatalogNo: number;
  /** 次に割り当てる見たいリスト番号 */
  nextWatchlistNo: number;
}

/** No.1〜50 は既存記録のために予約し、新規作品は 51 番以降から採番する */
export const RESERVED_LEGACY_MAX = 50;

export const DEFAULT_COUNTERS: Counters = {
  nextCatalogNo: RESERVED_LEGACY_MAX + 1,
  nextWatchlistNo: 1,
};

/** 作品1件に関連する情報をまとめたもの（画面表示用） */
export interface WorkBundle {
  work: Work;
  user: UserWork;
  events: WatchEvent[];
  watchlist: WatchlistEntry[];
  ratingHistory: RatingChange[];
}

/** 保存済みデータ全体のスナップショット */
export interface LibrarySnapshot {
  works: Work[];
  userWorks: UserWork[];
  watchEvents: WatchEvent[];
  watchlist: WatchlistEntry[];
  ratingHistory: RatingChange[];
  settings: Settings;
  counters: Counters;
}
