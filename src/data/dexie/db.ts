import Dexie, { type Table } from 'dexie';
import type { RatingChange, UserWork, WatchEvent, WatchlistEntry, Work } from '../../domain/types';

export interface MetaRecord {
  key: string;
  value: unknown;
}

export class CinemaDB extends Dexie {
  works!: Table<Work, string>;
  userWorks!: Table<UserWork, string>;
  watchEvents!: Table<WatchEvent, string>;
  watchlist!: Table<WatchlistEntry, string>;
  ratingHistory!: Table<RatingChange, string>;
  meta!: Table<MetaRecord, string>;

  constructor(name = 'cinema-techo') {
    super(name);
    this.version(1).stores({
      works: 'id, &catalogNo, legacyId, tmdbId, type, createdAt',
      userWorks: 'workId, status, rating, addedAt, updatedAt',
      watchEvents: 'id, workId, watchedOn',
      watchlist: 'id, workId, &fixedNumber, status, priority',
      ratingHistory: 'id, workId, changedAt',
      meta: 'key',
    });
  }
}
