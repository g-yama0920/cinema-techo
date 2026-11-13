// 全作品 CSV の各作品について TMDb の候補を調べ、紐付け案を作る（データは変更しない）。
//   node scripts/tmdb-match.mjs seed/movie_tracker_full_catalog.csv > 出力.json
// 認証はネットワークの中継（プロキシ）が付けるため、このスクリプトはキーを扱わない。
//
// 判定
//   auto    : 元データで「作品の特定が必要」でなく、タイトル・区分が一致する候補がちょうど1件
//   confirm : 特定が必要とされた作品、または候補が複数／区分が不明 → 利用者に確認する
//   none    : 候補なし
//   skip    : 作品の同定をしない指定（No.47 など）
import { readFileSync } from 'node:fs';

const API = 'https://api.themoviedb.org/3';
const ANIMATION = 16;
const SKIP = new Set([47]); // 指示書：「モンスター」は作品同定禁止

function parseCsv(text) {
  const src = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
      continue;
    }
    if (c === '"' && cell === '') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(cell); if (row.some((x) => x !== '')) rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== '')) rows.push(row);
  const [h, ...b] = rows;
  return b.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}

const key = (s) => (s ?? '').normalize('NFKC').toLowerCase().replace(/[\s　]+/g, '').replace(/[・･:：\-‐―—~〜!！?？。、,.「」『』（）()[\]【】'"“”‘’／/×]/g, '');

async function get(path, params = {}) {
  const u = new URL(API + path);
  for (const [k, v] of Object.entries({ language: 'ja-JP', ...params })) u.searchParams.set(k, String(v));
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(u, { headers: { accept: 'application/json' } });
    if (r.status === 429) { await new Promise((s) => setTimeout(s, 1500)); continue; }
    if (!r.ok) throw new Error(`${r.status} ${path}`);
    return r.json();
  }
  throw new Error(`rate limited ${path}`);
}

/** タイトルの括弧書き（年・映画・シーズンなど）を検索語から外し、ヒントとして取り出す */
function queryParts(title) {
  let t = title.trim();
  let year = null, hint = null;
  const m = /（(\d{4})年(映画|ドラマ|アニメ)?）$/.exec(t);
  if (m) { year = Number(m[1]); hint = m[2] === '映画' ? 'movie' : null; t = t.slice(0, m.index).trim(); }
  t = t.replace(/（[^）]*）$/, '').trim();
  if (/^映画\s+/.test(t)) { hint = 'movie'; t = t.replace(/^映画\s+/, ''); }
  t = t.replace(/^東野圭吾「(.+)」$/, '$1');
  return { q: t, year, hint };
}

const genreNames = {};
async function loadGenres() {
  for (const k of ['movie', 'tv']) for (const g of (await get(`/genre/${k}/list`)).genres) genreNames[g.id] = g.name;
}

function norm(r, media) {
  const mt = media ?? r.media_type;
  return {
    tmdbId: r.id,
    mediaType: mt,
    title: mt === 'movie' ? r.title : r.name,
    originalTitle: mt === 'movie' ? r.original_title : r.original_name,
    year: Number(((mt === 'movie' ? r.release_date : r.first_air_date) || '').slice(0, 4)) || null,
    animation: (r.genre_ids || []).includes(ANIMATION),
    genres: (r.genre_ids || []).map((g) => genreNames[g]).filter(Boolean),
    country: r.origin_country || [],
    posterPath: r.poster_path || null,
    overview: (r.overview || '').slice(0, 80),
    popularity: r.popularity ?? 0,
  };
}

function typeOk(type, c) {
  if (type === 'anime') return c.animation;
  if (type === 'series') return c.mediaType === 'tv' && !c.animation;
  if (type === 'movie') return c.mediaType === 'movie' && !c.animation;
  return true; // unknown
}

const rows = parseCsv(readFileSync(process.argv[2], 'utf8'));
await loadGenres();
const out = [];
for (const r of rows) {
  const no = Number(r.legacy_id);
  if (SKIP.has(no)) { out.push({ no, title: r.title, decision: 'skip', reason: '作品同定禁止の指定' }); continue; }
  const { q, year, hint } = queryParts(r.title);
  const type = hint ?? r.media_type;
  const queries = [...new Set([q, queryParts(r.original_title).q].filter(Boolean))];
  const seen = new Map();
  for (const qq of queries) {
    const kinds = type === 'movie' ? ['movie'] : type === 'series' ? ['tv'] : ['multi'];
    for (const k of kinds) {
      const d = await get(`/search/${k}`, { query: qq, include_adult: 'false' });
      for (const x of d.results || []) {
        if (k === 'multi' && x.media_type !== 'movie' && x.media_type !== 'tv') continue;
        const c = norm(x, k === 'multi' ? undefined : k);
        if (!seen.has(`${c.mediaType}:${c.tmdbId}`)) seen.set(`${c.mediaType}:${c.tmdbId}`, c);
      }
    }
  }
  const all = [...seen.values()];
  const keys = new Set(queries.map(key));
  let exact = all.filter((c) => keys.has(key(c.title)) || keys.has(key(c.originalTitle)));
  if (year) exact = exact.filter((c) => c.year === year);
  const typed = exact.filter((c) => typeOk(type, c)).sort((a, b) => b.popularity - a.popularity);
  const flagged = r.metadata_review_required === 'True' || r.media_type === 'unknown';
  let decision, reason;
  if (!typed.length) {
    decision = exact.length ? 'confirm' : all.length ? 'confirm' : 'none';
    reason = exact.length ? '同じタイトルの候補はあるが区分が一致しない' : all.length ? 'タイトルが完全一致する候補がない' : 'TMDb に候補なし';
  } else if (typed.length === 1 && !flagged) {
    decision = 'auto';
    reason = 'タイトル・区分が一致する候補が1件';
  } else {
    decision = 'confirm';
    reason = flagged ? (typed.length === 1 ? '元データで特定が必要（候補1件）' : `元データで特定が必要（候補${typed.length}件）`) : `候補が${typed.length}件`;
  }
  const candidates = (typed.length ? typed : exact.length ? exact : all.sort((a, b) => b.popularity - a.popularity)).slice(0, 4);
  out.push({ no, title: r.title, type: r.media_type, status: r.status, decision, reason, candidates });
  await new Promise((s) => setTimeout(s, 60));
}
process.stdout.write(JSON.stringify(out, null, 1));
const c = (d) => out.filter((x) => x.decision === d).length;
console.error(`auto ${c('auto')} / confirm ${c('confirm')} / none ${c('none')} / skip ${c('skip')}`);
