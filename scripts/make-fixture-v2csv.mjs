// 実データと同じ列構成（schema_version 2）の CSV を、架空の作品名で作る（テスト用）
// 見たい固定番号は作品番号の順と一致しない（No.105→3, No.106→1, No.107→2）ことを再現する
import { readFileSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync('tests/fixtures/sample_full_catalog.json', 'utf8')).works;
const status = { 評価済み: 'watched_rated', 評価保留: 'watched_unrated', 未視聴: 'unwatched', 見たい: 'want_to_watch', 未確認: 'unconfirmed' };
const media = { 映画: 'movie', ドラマ: 'series', アニメ: 'anime' };
const wl = { 105: 3, 106: 1, 107: 2 };
const header = ['legacy_id', 'title', 'original_title', 'source_category', 'media_type', 'status', 'rating', 'watchlist_fixed_number', 'watched_on', 'metadata_review_required', 'notes'];
const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const rows = src.map((r) => {
  const st = status[r.status];
  const unconfirmed = st === 'unconfirmed';
  return [
    r.work_no,
    r.title,
    r.work_no === 31 ? '宇宙を駆ける。SWITCHED' : r.title,
    r.work_no >= 105 ? '見たいリスト' : 'テスト用の分類',
    unconfirmed || !media[r.category] ? 'unknown' : media[r.category],
    st,
    r.my_rating ?? '',
    wl[r.work_no] ?? '',
    '',
    unconfirmed || r.needs_review || r.work_no >= 105 ? 'True' : 'False',
    unconfirmed ? '一覧に掲載されたが、視聴済みか未視聴かは未確認' : r.work_no === 12 ? 'シーズン1・2をまとめて評価' : '',
  ].map(esc).join(',');
});
writeFileSync('tests/fixtures/sample_catalog_v2.csv', '﻿' + [header.join(','), ...rows].join('\n') + '\n');
console.log('rows', rows.length);
