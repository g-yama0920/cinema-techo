import type { Rating, WatchStatus, WorkType } from './types';

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  movie: '映画',
  drama: 'ドラマ',
  anime: 'アニメ',
  other: 'その他・要確認',
};

export const WORK_TYPE_EN: Record<WorkType, string> = {
  movie: 'MOVIE',
  drama: 'DRAMA',
  anime: 'ANIME',
  other: 'OTHER',
};

export const STATUS_LABEL: Record<WatchStatus, string> = {
  want: '見たい',
  watching: '視聴中',
  watched: '視聴済み',
  pending: '評価保留',
  unwatched: '未視聴',
  unconfirmed: '未確認',
};

export const RATING_LABEL: Record<Rating, string> = {
  5: '最高傑作',
  4: 'かなり面白い',
  3: '面白い',
  2: 'いまいち',
  1: '合わなかった',
};

export const RATINGS: Rating[] = [1, 2, 3, 4, 5];

export const WORK_TYPES: WorkType[] = ['movie', 'drama', 'anime', 'other'];

/** 視聴済みとして数える状態（評価保留は「見たが未評価」なので含む） */
export function isWatchedStatus(s: WatchStatus): boolean {
  return s === 'watched' || s === 'pending';
}

export function isRating(v: unknown): v is Rating {
  return v === 1 || v === 2 || v === 3 || v === 4 || v === 5;
}
