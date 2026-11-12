import { formatPartialDate } from '../domain/dates';
import { STATUS_LABEL, WORK_TYPE_LABEL } from '../domain/labels';
import { activeWatchlistEntry, latestWatchDate, type LibraryIndex } from '../domain/library';
import { precisionOf } from '../domain/dates';

function cell(v: unknown): string {
  let s = v == null ? '' : String(v);
  // 表計算ソフトで数式として実行されないよう、= + - @ で始まる文字列は ' を付ける（数値はそのまま）
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(values: unknown[]): string {
  return values.map(cell).join(',');
}

/** 作品一覧の CSV（Excel で文字化けしないよう BOM 付き） */
export function worksToCsv(index: LibraryIndex): string {
  const header = [
    '管理番号', '元番号', 'タイトル', '別題', '版・補足', '種別', '公開年', '状態', '評価',
    '最終視聴日', '視聴回数', 'ジャンル', '制作国', '監督', '出演', '上映時間(分)', 'シーズン数', '話数',
    'タグ', '感想メモ', '見たい番号', '元の見たい番号', 'TMDb ID', 'TMDb種別', '要確認', '登録日時',
  ];
  const lines = [row(header)];
  for (const b of index.bundles) {
    const w = b.work;
    const u = b.user;
    const last = latestWatchDate(b);
    const wl = activeWatchlistEntry(b) ?? b.watchlist[b.watchlist.length - 1];
    lines.push(
      row([
        w.catalogNo, w.legacyId ?? '', w.title, w.alternateTitles.join(' / '), w.edition ?? '', WORK_TYPE_LABEL[w.type],
        w.releaseYear ?? '', STATUS_LABEL[u.status], u.rating ?? '',
        last ? formatPartialDate(last, precisionOf(last)) : '', b.events.length,
        w.genres.join(' / '), w.country.join(' / '), w.directors.join(' / '), w.cast.join(' / '),
        w.runtime ?? '', w.seasonCount ?? '', w.episodeCount ?? '',
        u.tags.join(' / '), u.review, wl?.fixedNumber ?? '', u.legacyWatchlistNumber ?? '',
        w.tmdbId ?? '', w.tmdbMediaType ?? '', w.needsReview ?? '', u.addedAt,
      ]),
    );
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** 視聴イベントの CSV */
export function eventsToCsv(index: LibraryIndex): string {
  const header = ['管理番号', 'タイトル', '視聴日', '日付の精度', '配信サービス', '場所', '視聴時間(分)', 'シーズン', '話', 'メモ'];
  const lines = [row(header)];
  for (const b of index.bundles) {
    for (const e of b.events) {
      lines.push(
        row([
          b.work.catalogNo, b.work.title, e.watchedOn ?? '', e.watchedOnPrecision ?? '不明', e.platform ?? '', e.location ?? '',
          e.watchedMinutes ?? '', e.seasonNumber ?? '', e.episodeNumber ?? '', e.notes,
        ]),
      );
    }
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}
