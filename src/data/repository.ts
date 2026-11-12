import type {
  Counters,
  DatePrecision,
  LibrarySnapshot,
  Rating,
  RatingChange,
  Settings,
  UserWork,
  WatchEvent,
  WatchlistEntry,
  WatchStatus,
  Work,
  WorkType,
} from '../domain/types';

/**
 * データアクセスの抽象。UI はこのインターフェースだけに依存する。
 * 初期版は IndexedDB（Dexie）実装。将来 Supabase などのクラウド実装を差し替え可能。
 */
export interface LibraryRepository {
  /** スナップショットを購読（変更のたびに通知）。戻り値で購読解除 */
  subscribe(listener: (snap: LibrarySnapshot) => void, onError: (e: unknown) => void): () => void;
  load(): Promise<LibrarySnapshot>;

  createWork(input: NewWorkInput): Promise<string>;
  updateWork(workId: string, patch: WorkPatch): Promise<void>;
  deleteWork(workId: string): Promise<void>;
  updateUserWork(workId: string, patch: Partial<Pick<UserWork, 'review' | 'tags'>>): Promise<void>;

  /** 評価を変更（履歴を保存）。評価を付けると状態は「視聴済み」になる */
  setRating(workId: string, rating: Rating | null): Promise<void>;
  /** 評価保留にする（現在の評価は履歴に残して外す） */
  setPending(workId: string): Promise<void>;
  setStatus(workId: string, status: WatchStatus): Promise<void>;
  /** 「見た」：視聴イベントを追加し、評価または評価保留にする。見たいリストから外す */
  markWatched(workId: string, watch: WatchInput, rating: Rating | null): Promise<void>;
  startWatching(workId: string): Promise<void>;

  addToWatchlist(workId: string, opts?: Partial<Pick<WatchlistEntry, 'plannedDate' | 'releaseDate' | 'availableOn' | 'note'>>): Promise<number>;
  removeFromWatchlist(entryId: string): Promise<void>;
  updateWatchlistEntry(entryId: string, patch: Partial<Pick<WatchlistEntry, 'plannedDate' | 'releaseDate' | 'availableOn' | 'note'>>): Promise<void>;
  /** 有効な見たいリストの並び順を、渡した ID 順にする */
  reorderWatchlist(orderedEntryIds: string[]): Promise<void>;

  addWatchEvent(workId: string, watch: WatchInput): Promise<string>;
  updateWatchEvent(eventId: string, patch: Partial<WatchInput>): Promise<void>;
  deleteWatchEvent(eventId: string): Promise<void>;

  updateSettings(patch: Partial<Settings>): Promise<void>;

  /** まとめて書き込む（インポート用）。replace のときは全データを置き換える */
  applyChanges(changes: ChangeSet, mode: 'merge' | 'replace'): Promise<void>;
}

export type WorkPatch = Partial<Omit<Work, 'id' | 'catalogNo' | 'createdAt' | 'source'>>;

export interface NewWorkInput {
  work: Partial<Omit<Work, 'id' | 'catalogNo' | 'createdAt' | 'updatedAt'>> & { title: string; type: WorkType };
  status: WatchStatus;
  rating?: Rating | null;
  /** status が watched / pending のときの視聴記録 */
  watch?: WatchInput | null;
  review?: string;
  tags?: string[];
}

export interface WatchInput {
  watchedOn: string | null;
  watchedOnPrecision: DatePrecision | null;
  platform?: string | null;
  location?: string | null;
  watchedMinutes?: number | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  notes?: string;
}

export interface ChangeSet {
  works?: Work[];
  userWorks?: UserWork[];
  watchEvents?: WatchEvent[];
  watchlist?: WatchlistEntry[];
  ratingHistory?: RatingChange[];
  counters?: Counters;
  settings?: Partial<Settings>;
}
