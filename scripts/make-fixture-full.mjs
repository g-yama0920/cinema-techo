// テスト用の架空データ（実在の評価データではありません）
// 依頼の構成を再現：全107作品＝評価済み44（平均3.00）・評価保留7・未視聴1・見たい3・未確認52
import { writeFileSync } from 'node:fs';

const A = ['青い', '白い', '真夜中の', '七月の', '遠い', '最後の', '小さな', 'さよならの', '秘密の', '雨の', '霧の', '北の'];
const B = ['灯台', '映写室', '列車', '港', '図書館', '郵便局', '温室', '観覧車', '劇場', '手紙', '坂道'];
const titles = [];
for (const a of A) for (const b of B) titles.push(a + b);
const TYPES = ['映画', 'ドラマ', 'アニメ'];

// 評価 44件：★1×6, ★2×8, ★3×16, ★4×8, ★5×6 → 合計132 → 平均3.00
const ratings = [...Array(6).fill(1), ...Array(8).fill(2), ...Array(16).fill(3), ...Array(8).fill(4), ...Array(6).fill(5)];
const special = {
  22: { title: '三体', category: 'ドラマ', release_year: 2023, country: '中国', my_rating: 1, status: '評価済み' },
  31: { title: '宇宙を駆けるよだか', category: 'ドラマ', release_year: 2018, my_rating: 3, status: '評価済み' },
  38: { title: 'ルパン三世 PART III', category: 'アニメ', release_year: 1984, status: '未視聴' },
  47: { title: 'モンスター', category: '', status: '未確認', needs_review: '映画・ドラマ・アニメ・原作漫画のどれか未特定' },
  50: { title: '全領域異常解決室', category: 'ドラマ', release_year: 2024, status: '評価保留' },
  14: { title: '灯台守', category: '映画', release_year: 2019 },
  36: { title: '灯台守', category: 'ドラマ', release_year: 2023 },
  60: { title: '風の谷の住人', category: '原作漫画', status: '未確認', needs_review: '漫画とアニメ化作品のどちらか不明' },
};
const pendingNos = new Set([5, 12, 19, 26, 33, 40, 50]);
const wantNos = { 105: 1, 106: 2, 107: 3 };
const ratedNos = [];
for (let no = 1; no <= 107 && ratedNos.length < 44; no++) {
  if (pendingNos.has(no) || no === 38 || no === 47 || no === 60 || wantNos[no]) continue;
  if (no > 70) break;
  ratedNos.push(no);
}
if (!ratedNos.includes(22)) throw new Error('三体 must be rated');

const records = [];
let ti = 0;
let ri = 0;
const ratingFor = {};
// ★1 の1件目は三体
const rest = ratings.slice();
rest.splice(rest.indexOf(1), 1);
for (const no of ratedNos) ratingFor[no] = no === 22 ? 1 : no === 31 ? (rest.splice(rest.indexOf(3), 1), 3) : null;
for (const no of ratedNos) if (ratingFor[no] == null) ratingFor[no] = rest[ri++];

for (let no = 1; no <= 107; no++) {
  const sp = special[no] ?? {};
  const rec = {
    work_no: no,
    title: sp.title ?? titles[ti++],
    category: sp.category ?? TYPES[no % 3],
    release_year: sp.release_year ?? 2000 + (no % 26),
  };
  if (sp.country) rec.country = sp.country;
  if (ratingFor[no] != null) {
    rec.my_rating = ratingFor[no];
    rec.status = '評価済み';
  } else if (pendingNos.has(no)) rec.status = '評価保留';
  else if (no === 38) rec.status = '未視聴';
  else if (wantNos[no]) {
    rec.status = '見たい';
    rec.watchlist_no = wantNos[no];
  } else rec.status = sp.status ?? '未確認';
  if (sp.needs_review) rec.needs_review = sp.needs_review;
  if (no === 2) rec.watched_on = '2026-11-03';
  if (no === 3) rec.watched_on = '2026-10';
  rec.registered_at = '2025-04-01';
  records.push(rec);
}

const count = (s) => records.filter((r) => r.status === s).length;
const rated = records.filter((r) => typeof r.my_rating === 'number');
const avg = rated.reduce((a, r) => a + r.my_rating, 0) / rated.length;
const summary = {
  total_works: records.length,
  rated_count: rated.length,
  average_rating: Number(avg.toFixed(2)),
  pending_count: count('評価保留'),
  unwatched_count: count('未視聴'),
  want_count: count('見たい'),
  unconfirmed_count: count('未確認'),
};
writeFileSync('tests/fixtures/sample_full_catalog.json', JSON.stringify({ note: 'テスト用の架空データです。実際の評価データではありません。', summary, works: records }, null, 2));

const header = ['作品番号', 'タイトル', '種別', '公開年', '評価', '状態', '見たい番号'];
const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const csv = [header.join(','), ...records.map((r) => [r.work_no, r.title, r.category, r.release_year, r.my_rating ?? '', r.status, r.watchlist_no ?? ''].map(esc).join(','))].join('\r\n');
writeFileSync('tests/fixtures/sample_full_catalog.csv', '﻿' + csv + '\r\n');
console.log(summary);
