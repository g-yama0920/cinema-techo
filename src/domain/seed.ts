/**
 * 既存データ（movie_tracker_full_catalog.json / movie_tracker_seed.json）の正規化。
 *
 * 元ファイルの形式が確定していないため、よくあるキー名（英語・日本語・表記ゆれ）を吸収する。
 * 方針:
 *  - 元データに明示された状態（評価済み・評価保留・未視聴・見たい・未確認）を最優先する
 *  - 状態も評価も無い作品は「未確認」（視聴済みに数えない）
 *  - 既存の評価値は変更しない（整数1〜5以外は取り込まず要確認にする）
 *  - 視聴日は「視聴日」を表すキーからだけ読む。登録日・更新日は視聴日として扱わない
 *  - 日付が無い・読めない場合は null（架空の日付を補わない）
 *  - 同名でも番号が違う作品は統合しない（明示ルールの No.31 のみ別題として扱う）
 */
import { parsePartialDate } from './dates';
import { isRating } from './labels';
import { titleKey, uniqueStrings } from './text';
import type { DatePrecision, Rating, WatchStatus, WorkType } from './types';

export interface SeedRecord {
  legacyId: number;
  title: string;
  alternateTitles: string[];
  edition: string | null;
  type: WorkType;
  releaseYear: number | null;
  rating: Rating | null;
  status: WatchStatus;
  watchedOn: string | null;
  watchedOnPrecision: DatePrecision | null;
  platform: string | null;
  review: string;
  tags: string[];
  genres: string[];
  country: string[];
  directors: string[];
  cast: string[];
  runtime: number | null;
  seasonCount: number | null;
  episodeCount: number | null;
  synopsis: string | null;
  needsReview: string | null;
  /** 元データの分類（利用者の原文） */
  sourceCategory: string | null;
  /** 元データのメモ（利用者の感想とは別に保存） */
  importNote: string | null;
  tmdbId: number | null;
  tmdbMediaType: 'movie' | 'tv' | null;
  posterPath: string | null;
  /** 状態が元データに明示されていたか（個別ルールは明示が無いときだけ補う） */
  explicitStatus: boolean;
  /** 見たい作品の固定番号（作品番号とは別）。status が want のとき必ず入る */
  watchlistNumber: number | null;
  plannedDate: string | null;
  releaseDate: string | null;
  availableOn: string[];
  /** 取り込み時に適用したルール・注意（プレビュー表示用） */
  notes: string[];
}

export interface SeedWatchItem {
  number: number;
  title: string;
  alternateTitles: string[];
  type: WorkType;
  releaseYear: number | null;
  plannedDate: string | null;
  releaseDate: string | null;
  availableOn: string[];
  note: string;
  /** 既存記録と同じ作品であることが明示されている場合の No. */
  linkedLegacyId: number | null;
  needsReview: string | null;
  notes: string[];
}

export interface NormalizedSeed {
  records: SeedRecord[];
  watchlist: SeedWatchItem[];
  warnings: string[];
  /** 致命的な問題。1件でもあれば取り込みを中止する */
  errors: string[];
  declared: { averageRating: number | null; counts: Record<string, number> };
}

type Obj = Record<string, unknown>;

// ---------- キーの別名 ----------

const K = {
  no: ['no', 'workno', 'worknumber', 'catalogno', 'catalognumber', 'number', 'num', 'legacyid', 'legacyno', 'seq', 'index', '番号', '作品番号', '作品no', '管理番号', 'id'],
  wlNo: ['watchlistfixednumber', 'watchlistfixedno', 'watchlistno', 'watchlistnumber', 'wantno', 'wantnumber', 'wishlistno', 'wlno', 'fixednumber', 'fixedno', '見たい番号', '見たいno', '見たいリスト番号', '見たい固定番号', 'リスト番号'],
  reviewFlag: ['metadatareviewrequired', 'reviewrequired', 'needsreview', 'needsconfirmation', 'reviewnote', 'confirmation', 'ambiguity', 'ambiguous', 'pendingconfirmation', '確認待ち', '確認事項', '要確認', '要確認理由'],
  sourceCategory: ['sourcecategory', 'sourcecategories', 'originalcategory', 'usercategory', '元の分類', '分類（原文）'],
  importNote: ['notes', 'note', 'datanote', 'remarks', '備考', 'データメモ'],
  tmdbId: ['tmdbid', 'tmdb'],
  tmdbMediaType: ['tmdbmediatype', 'tmdbtype'],
  poster: ['posterpath', 'poster', 'posterurl', 'ポスター'],
  title: ['title', 'titleja', 'japanesetitle', 'name', 'work', '作品名', 'タイトル', '作品', '題名'],
  alt: ['alternatetitles', 'alternatetitle', 'aliases', 'alias', 'alttitles', 'alttitle', 'othertitles', 'englishtitle', 'titleen', 'originaltitle', 'aka', '別名', '別題', '原題', '英題'],
  type: ['type', 'category', 'kind', 'mediatype', 'media', 'format', 'worktype', '種別', '区分', 'カテゴリ', 'カテゴリー', '分類'],
  year: ['year', 'releaseyear', 'released', 'releasedate', '公開年', '年', '放送年', '公開'],
  rating: ['rating', 'score', 'stars', 'star', 'evaluation', 'myrating', 'rate', '評価', '星', '点数', 'スコア'],
  status: ['status', 'state', 'watchstatus', 'ratingstatus', '状態', 'ステータス', '視聴状態', '評価状態'],
  watched: ['watchedon', 'watcheddate', 'watchedat', 'viewedon', 'vieweddate', 'seenon', 'seendate', 'datewatched', 'watchdate', '視聴日', '鑑賞日', '見た日'],
  review: ['review', 'comment', 'comments', 'memo', 'impression', 'thoughts', '感想', 'メモ', 'コメント', 'レビュー'],
  tags: ['tags', 'tag', 'labels', 'タグ'],
  genres: ['genres', 'genre', 'ジャンル'],
  country: ['country', 'countries', 'productioncountry', 'origin', '制作国', '国', '製作国'],
  directors: ['director', 'directors', '監督'],
  cast: ['cast', 'actors', 'actor', 'starring', '出演', '出演者', 'キャスト'],
  runtime: ['runtime', 'duration', 'minutes', 'length', '上映時間', '時間'],
  episodes: ['episodes', 'episodecount', '話数', 'エピソード数'],
  seasons: ['seasons', 'seasoncount', 'シーズン数'],
  synopsis: ['synopsis', 'overview', 'summary', 'plot', 'あらすじ', '概要'],
  platform: ['platform', 'service', 'streaming', 'provider', 'watchedon_service', '配信', '配信サービス', '視聴方法', 'サービス'],
  edition: ['edition', 'version', 'variant', '版', 'バージョン'],
  planned: ['planneddate', 'plannedon', 'plan', '視聴予定日', '予定日'],
  releaseDate: ['upcomingrelease', 'releasedateplanned', '公開予定日', '配信予定日'],
  services: ['availableon', 'services', 'providers', 'whereToWatch'.toLowerCase(), '見られるサービス', '配信先'],
  linked: ['linkedno', 'refno', 'workno', 'sameas', '対応番号', '作品番号'],
};

const RECORD_ARRAY_KEYS = ['records', 'works', 'items', 'entries', 'movies', 'titles', 'list', 'ratings', 'history', 'watched', 'data', 'library', '作品', '記録', '作品一覧'];
const WATCHLIST_ARRAY_KEYS = ['watchlist', 'wanttowatch', 'wishlist', 'towatch', 'watchlater', 'want', 'backlog', '見たい', '見たいリスト', '見たい作品'];

function norm(key: string): string {
  return key.normalize('NFKC').toLowerCase().replace(/[\s_\-.]/g, '');
}

/** 別名リストの先頭ほど優先して値を取り出す */
function pick(obj: Obj, aliases: string[]): unknown {
  const byKey = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '' && !byKey.has(norm(k))) byKey.set(norm(k), v);
  }
  for (const a of aliases) {
    const v = byKey.get(norm(a));
    if (v !== undefined) return v;
  }
  return undefined;
}

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isObjArray(v: unknown): v is Obj[] {
  return Array.isArray(v) && v.length > 0 && v.every(isObj);
}

function findArray(root: Obj, keys: string[], depth = 0): Obj[] | null {
  const wanted = new Set(keys.map(norm));
  for (const [k, v] of Object.entries(root)) {
    if (wanted.has(norm(k)) && (isObjArray(v) || (Array.isArray(v) && v.length === 0))) return v as Obj[];
  }
  if (depth < 2) {
    for (const v of Object.values(root)) {
      if (isObj(v)) {
        const found = findArray(v, keys, depth + 1);
        if (found) return found;
      }
    }
  }
  return null;
}

// ---------- 値の解釈 ----------

function toStr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function toInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  const s = toStr(v).normalize('NFKC').replace(/^no\.?\s*/i, '').replace(/^#/, '');
  if (/^\d+$/.test(s)) return Number(s);
  return null;
}

function toList(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return uniqueStrings(v.map((x) => (isObj(x) ? toStr(x.name ?? x.title) : toStr(x))));
  return uniqueStrings(toStr(v).split(/[,、，/／|]/));
}

function toYear(v: unknown): number | null {
  const s = toStr(v).normalize('NFKC');
  const m = /(\d{4})/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1880 && y <= 2100 ? y : null;
}

function toMinutes(v: unknown): number | null {
  if (typeof v === 'number' && v > 0) return Math.round(v);
  const s = toStr(v).normalize('NFKC');
  const hm = /(\d+)\s*時間\s*(\d+)?\s*分?/.exec(s);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2] ?? 0);
  const m = /^(\d+)\s*(分|min|m)?$/i.exec(s);
  return m ? Number(m[1]) : null;
}

export function parseWorkType(v: unknown): WorkType | null {
  const s = toStr(v).normalize('NFKC').toLowerCase();
  if (!s) return null;
  if (/アニメ|anime|animation|animated|cartoon/.test(s)) return 'anime';
  if (/漫画|マンガ|まんが|manga|comic|原作|小説|novel|book/.test(s)) return 'other';
  if (/映画|movie|film|cinema|劇場/.test(s)) return 'movie';
  if (/ドラマ|drama|tv|series|シリーズ|連続|配信ドラマ|show/.test(s)) return 'drama';
  return null;
}

type RatingParse = { kind: 'rating'; value: Rating } | { kind: 'status'; value: WatchStatus } | { kind: 'invalid'; raw: string } | { kind: 'none' };

export function parseRating(v: unknown): RatingParse {
  if (v == null || v === '') return { kind: 'none' };
  if (typeof v === 'number') {
    return isRating(v) ? { kind: 'rating', value: v } : { kind: 'invalid', raw: String(v) };
  }
  const s = toStr(v).normalize('NFKC');
  if (!s) return { kind: 'none' };
  const status = parseStatus(s);
  if (status) return { kind: 'status', value: status };
  const stars = (s.match(/★/g) ?? []).length;
  if (stars > 0 && /^[★☆\s]+$/.test(s)) {
    return isRating(stars) ? { kind: 'rating', value: stars } : { kind: 'invalid', raw: s };
  }
  const m = /^(?:★\s*)?(\d+(?:\.\d+)?)\s*(?:点|\/\s*5|stars?)?$/i.exec(s);
  if (m) {
    const n = Number(m[1]);
    return isRating(n) ? { kind: 'rating', value: n } : { kind: 'invalid', raw: s };
  }
  return { kind: 'invalid', raw: s };
}

export function parseStatus(v: unknown): WatchStatus | null {
  const s = toStr(v).normalize('NFKC').toLowerCase().replace(/[\s_\-]/g, '');
  if (!s) return null;
  if (/視聴状況未確認|未確認|確認待ち|未回答|要確認|不明|unconfirmed|unanswered|needsconfirmation|awaiting|tbd|unknown/.test(s)) return 'unconfirmed';
  if (/評価保留|評価待ち|保留|未評価|pending|hold|deferred|later|norating|unrated/.test(s)) return 'pending';
  if (/未視聴|未鑑賞|まだ見ていない|notwatched|unwatched|unseen|notseen/.test(s)) return 'unwatched';
  if (/視聴中|watching|inprogress/.test(s)) return 'watching';
  if (/見たい|want|wishlist|watchlist|towatch|planned/.test(s)) return 'want';
  if (/視聴済|鑑賞済|評価済|見た|watched|rated|seen|done|complete|finished/.test(s)) return 'watched';
  return null;
}

// ---------- 個別ルール（依頼書の注意事項） ----------

const YODAKA = '宇宙を駆けるよだか';
const SWITCHED = 'SWITCHED';
const isYodaka = (t: string) => [YODAKA, SWITCHED].some((x) => titleKey(t).includes(titleKey(x)));

function applySpecialRules(r: SeedRecord, warnings: string[]): void {
  const allTitles = [r.title, ...r.alternateTitles];
  // No.31「宇宙を駆けるよだか」と「SWITCHED」は同じ作品（別題として保持）
  if (allTitles.some(isYodaka)) {
    r.alternateTitles = uniqueStrings([...r.alternateTitles, YODAKA, SWITCHED].filter((t) => t !== r.title));
    r.notes.push('「宇宙を駆けるよだか」と「SWITCHED」を同一作品（別題）として登録');
  }
  // No.38「ルパン三世 PART III」は未視聴（元データに状態が明示されていればそれを優先）
  if (r.legacyId === 38 && titleKey(r.title).includes(titleKey('ルパン三世'))) {
    if (!r.explicitStatus) {
      if (r.rating !== null) {
        warnings.push(`No.38「${r.title}」に評価 ★${r.rating} がありますが、未視聴のため評価としては数えません（値はメモに残します）`);
        r.review = [r.review, `（元データの評価値: ★${r.rating}）`].filter(Boolean).join('\n');
        r.rating = null;
      }
      r.status = 'unwatched';
      r.notes.push('未視聴として登録');
    } else if (r.status !== 'unwatched') {
      warnings.push(`No.38「${r.title}」は以前の指示では未視聴でしたが、元データの状態「${r.status}」を優先します`);
    }
  }
  // No.47「モンスター」は作品の版が未特定（元データで版・TMDb ID が特定済みなら不要）
  if (r.legacyId === 47 && /モンスター|monster/i.test(r.title.normalize('NFKC')) && !r.edition && r.tmdbId == null) {
    r.needsReview = [r.needsReview, '作品の版が未特定です（映画・ドラマ・アニメなどのどれか確認してください）。TMDb とは自動で紐付けません。'].filter(Boolean).join(' / ');
    r.notes.push('版が未特定のため「確認待ち」');
  }
  // 「全領域異常解決室」は評価未回答 → 状態の明示が無い場合のみ「未確認」
  if (titleKey(r.title) === titleKey('全領域異常解決室') && !r.explicitStatus && r.rating === null) {
    r.status = 'unconfirmed';
    r.notes.push('評価未回答のため「未確認」');
  }
  // 「三体」中国ドラマ版（評価は元データのまま。★1 のはず）
  if (titleKey(r.title) === titleKey('三体')) {
    const chinese = r.country.some((c) => /中国|china|中華/i.test(c)) || /中国|china|tencent|テンセント/i.test(`${r.edition ?? ''} ${r.review}`);
    const netflix = /netflix|3\s*body|アメリカ|米国|\busa?\b/i.test(`${r.edition ?? ''} ${r.country.join(' ')} ${r.alternateTitles.join(' ')}`);
    if (!netflix || chinese) {
      r.edition = r.edition ?? '中国ドラマ版';
      if (!r.country.length) r.country = ['中国'];
      if (r.type === 'other') r.type = 'drama';
      r.notes.push('「三体」中国ドラマ版として登録（Netflix版などとは別作品）');
      if (r.rating !== 1) warnings.push(`「三体」中国ドラマ版の評価が ★1 ではありません（元データ: ${r.rating ?? 'なし'}）。元データの値のまま取り込みます`);
    }
  }
}

// ---------- メイン ----------

export function normalizeSeed(input: unknown): NormalizedSeed {
  const warnings: string[] = [];
  const errors: string[] = [];
  let recordsRaw: Obj[] = [];
  let watchRaw: Obj[] = [];
  const declared: NormalizedSeed['declared'] = { averageRating: null, counts: {} };

  if (Array.isArray(input)) {
    recordsRaw = input.filter(isObj);
  } else if (isObj(input)) {
    watchRaw = findArray(input, WATCHLIST_ARRAY_KEYS) ?? [];
    const recs = findArray(input, RECORD_ARRAY_KEYS);
    recordsRaw = recs && recs !== watchRaw ? recs : [];
    if (!recs) {
      // キー名が不明でもオブジェクト配列が1つだけならそれを使う
      const arrays = Object.values(input).filter((v) => isObjArray(v) && v !== watchRaw) as Obj[][];
      if (arrays.length === 1) recordsRaw = arrays[0];
    }
    readDeclared(input, declared);
  } else {
    errors.push('JSON の形式を解釈できません（配列またはオブジェクトが必要です）');
  }
  if (!recordsRaw.length && !watchRaw.length && !errors.length) errors.push('作品の一覧が見つかりません');

  // 番号の無い「見たい」行は見たいリストとして扱う（番号のある行は作品として登録し、見たい番号を別に持つ）
  const records: SeedRecord[] = [];
  const extraWatch: Obj[] = [];
  const hasAnyNo = recordsRaw.some((o) => toInt(pick(o, K.no)) !== null);
  recordsRaw.forEach((o, i) => {
    const st = parseStatus(pick(o, K.status));
    let no = toInt(pick(o, K.no));
    if (st === 'want' && no === null && hasAnyNo) {
      extraWatch.push(o);
      return;
    }
    if (no === null) {
      if (hasAnyNo) {
        errors.push(`${i + 1}件目「${toStr(pick(o, K.title)) || '(無題)'}」に番号がありません`);
        return;
      }
      no = i + 1; // 番号が全く無い形式は並び順を元の No. とみなす
    }
    const rec = toRecord(o, no, warnings, errors);
    if (rec) records.push(rec);
  });
  if (!hasAnyNo && recordsRaw.length) warnings.push('番号の項目が無いため、並び順を元の No. として扱いました');

  for (const r of records) applySpecialRules(r, warnings);

  // 番号の重複チェック（No.31 の別題重複のみ統合）
  const byNo = new Map<number, SeedRecord>();
  const deduped: SeedRecord[] = [];
  for (const r of records) {
    const prev = byNo.get(r.legacyId);
    if (prev) {
      errors.push(`No.${r.legacyId} が重複しています（「${prev.title}」と「${r.title}」）`);
      continue;
    }
    byNo.set(r.legacyId, r);
    deduped.push(r);
  }
  // 「宇宙を駆けるよだか」と「SWITCHED」が別番号で2件ある場合は1件に統合
  const yodakas = deduped.filter((r) => [r.title, ...r.alternateTitles].some(isYodaka));
  let finalRecords = deduped;
  if (yodakas.length > 1) {
    const keep = yodakas.find((r) => r.legacyId === 31) ?? yodakas[0];
    const drop = yodakas.filter((r) => r !== keep);
    const conflict = drop.find((d) => d.rating !== null && keep.rating !== null && d.rating !== keep.rating);
    if (conflict) {
      errors.push(`「宇宙を駆けるよだか / SWITCHED」が No.${keep.legacyId} と No.${conflict.legacyId} にあり、評価が異なります（★${keep.rating} / ★${conflict.rating}）。元データを確認してください`);
    } else {
      for (const d of drop) {
        if (keep.rating === null && d.rating !== null) {
          keep.rating = d.rating;
          keep.status = d.status;
        }
        warnings.push(`No.${d.legacyId}「${d.title}」は No.${keep.legacyId} と同じ作品のため統合しました`);
      }
      finalRecords = deduped.filter((r) => !drop.includes(r));
    }
  }

  // 見たいリスト（別配列）：見たい状態の記録と同じものは記録側に統合し、それ以外は新しい作品にする
  const watchlist: SeedWatchItem[] = [];
  const usedNos = new Set<number>(finalRecords.map((r) => r.watchlistNumber).filter((n): n is number => n != null));
  const wantRecords = finalRecords.filter((r) => r.status === 'want');
  [...watchRaw, ...extraWatch].forEach((o, i) => {
    const title = toStr(pick(o, K.title));
    if (!title) {
      errors.push(`見たいリスト ${i + 1}件目にタイトルがありません`);
      return;
    }
    const explicitNo = toInt(pick(o, K.wlNo) ?? pick(o, ['no', 'number', '番号']));
    const linkedNo = toInt(pick(o, K.linked));
    const alt = toList(pick(o, K.alt));
    const planned = parsePartialDate(pick(o, K.planned));
    const release = parsePartialDate(pick(o, K.releaseDate));
    const extra = {
      plannedDate: planned?.precision === 'day' ? planned.value : null,
      releaseDate: release?.precision === 'day' ? release.value : null,
      availableOn: toList(pick(o, K.services) ?? pick(o, K.platform)),
      note: toStr(pick(o, K.importNote) ?? pick(o, K.review)),
    };
    // 1) 作品番号で明示的に対応 → 2) 同じ見たい番号 → 3) 同じタイトルの「見たい」記録
    const match =
      (linkedNo != null ? wantRecords.find((r) => r.legacyId === linkedNo) : undefined) ??
      (explicitNo != null ? wantRecords.find((r) => r.watchlistNumber === explicitNo) : undefined) ??
      wantRecords.find((r) => [r.title, ...r.alternateTitles].map(titleKey).includes(titleKey(title)));
    if (match) {
      if (match.watchlistNumber == null && explicitNo != null && !usedNos.has(explicitNo)) {
        match.watchlistNumber = explicitNo;
        usedNos.add(explicitNo);
      }
      match.plannedDate = match.plannedDate ?? extra.plannedDate;
      match.releaseDate = match.releaseDate ?? extra.releaseDate;
      match.availableOn = uniqueStrings([...match.availableOn, ...extra.availableOn]);
      match.notes.push('見たいリストの項目と同じ作品として統合');
      return;
    }
    let number = explicitNo;
    if (number === null || usedNos.has(number)) number = nextFree(usedNos, i + 1);
    usedNos.add(number);
    const typeRaw = pick(o, K.type);
    const type = parseWorkType(typeRaw);
    const item: SeedWatchItem = {
      number,
      title,
      alternateTitles: alt,
      type: type ?? 'other',
      releaseYear: toYear(pick(o, K.year)),
      ...extra,
      linkedLegacyId: linkedNo,
      needsReview: type ? null : '種別（映画・ドラマ・アニメ）が不明です',
      notes: [],
    };
    // SWITCHED / 宇宙を駆けるよだか は No.31 と同じ作品
    if (!item.linkedLegacyId && [title, ...alt].some(isYodaka)) {
      const y = finalRecords.find((r) => [r.title, ...r.alternateTitles].some(isYodaka));
      if (y) {
        item.linkedLegacyId = y.legacyId;
        item.notes.push(`No.${y.legacyId} と同じ作品として紐付け`);
      }
    }
    if (!item.linkedLegacyId) {
      const same = finalRecords.filter((r) => [r.title, ...r.alternateTitles].map(titleKey).includes(titleKey(title)));
      if (same.length) {
        warnings.push(`見たいリスト「${title}」と同名の記録（No.${same.map((x) => x.legacyId).join(', ')}）があります。別作品の可能性があるため統合していません`);
      }
    }
    watchlist.push(item);
  });

  // 見たい番号が無い「見たい」記録には、作品番号順に空いている番号を割り当てる
  for (const r of wantRecords.sort((a, b) => a.legacyId - b.legacyId)) {
    if (r.watchlistNumber == null) {
      r.watchlistNumber = nextFree(usedNos, 1);
      usedNos.add(r.watchlistNumber);
    }
  }
  for (const r of finalRecords) if (r.status !== 'want') r.watchlistNumber = r.watchlistNumber ?? null;

  return { records: finalRecords.sort((a, b) => a.legacyId - b.legacyId), watchlist, warnings, errors, declared };
}

function nextFree(used: Set<number>, start: number): number {
  let n = Math.max(1, start);
  while (used.has(n)) n++;
  return n;
}

function readDeclared(root: Obj, declared: NormalizedSeed['declared']) {
  const meta = [root, root.summary, root.meta, root.stats, root.statistics, root.集計].filter(isObj) as Obj[];
  for (const m of meta) {
    const avg = pick(m, ['averagerating', 'average', 'avgrating', 'avg', 'meanrating', '平均評価', '平均']);
    if (typeof avg === 'number' && declared.averageRating === null) declared.averageRating = avg;
    if (typeof avg === 'string' && declared.averageRating === null && /^\d+(\.\d+)?$/.test(avg)) declared.averageRating = Number(avg);
    for (const [k, v] of Object.entries(m)) {
      if (typeof v === 'number' && /count|total|件数|数$/i.test(k)) declared.counts[k] = v;
    }
  }
}

const REVIEW_FLAG_TEXT = '作品の特定（版・原作との区別など）が未確認です。確認するまで作品情報と自動で紐付けません。';
const UNKNOWN_TYPE = /^(unknown|不明|未確認|種類未確認|種別不明|other|その他)$/i;

function reviewFlagText(v: unknown): string | null {
  if (v == null || v === false) return null;
  if (v === true) return REVIEW_FLAG_TEXT;
  const s = toStr(v);
  if (!s || /^(false|no|none|なし|不要|0)$/i.test(s)) return null;
  if (/^(true|yes|あり|要|1)$/i.test(s)) return REVIEW_FLAG_TEXT;
  return s;
}

function toRecord(o: Obj, legacyId: number, warnings: string[], errors: string[]): SeedRecord | null {
  const title = toStr(pick(o, K.title));
  if (!title) {
    errors.push(`No.${legacyId} にタイトルがありません`);
    return null;
  }
  const notes: string[] = [];
  const typeRaw = pick(o, K.type);
  const typeUnknown = UNKNOWN_TYPE.test(toStr(typeRaw).normalize('NFKC'));
  let type = typeUnknown ? 'other' : parseWorkType(typeRaw);
  let needsReview: string | null = reviewFlagText(pick(o, K.reviewFlag));
  if (typeUnknown) needsReview = needsReview ?? '種類（映画・ドラマ・アニメ）が未確認です';
  else if (type === 'other') needsReview = needsReview ?? `映像作品ではない可能性があります（種別: ${toStr(typeRaw)}）`;
  if (!type) {
    type = 'other';
    needsReview = needsReview ?? (typeRaw ? `種別「${toStr(typeRaw)}」を判別できません` : '種別（映画・ドラマ・アニメ）が未設定です');
  }

  const ratingParse = parseRating(pick(o, K.rating));
  const explicit = parseStatus(pick(o, K.status));
  let rating: Rating | null = null;
  let status: WatchStatus | null = null;
  let explicitStatus = false;
  let review = toStr(pick(o, K.review));

  if (ratingParse.kind === 'rating') rating = ratingParse.value;
  if (ratingParse.kind === 'invalid') {
    warnings.push(`No.${legacyId}「${title}」の評価「${ratingParse.raw}」は整数の1〜5ではないため取り込まず、評価保留・確認待ちにしました`);
    needsReview = `元データの評価「${ratingParse.raw}」を確認してください`;
    review = [review, `（元データの評価値: ${ratingParse.raw}）`].filter(Boolean).join('\n');
  }

  if (ratingParse.kind === 'status' && (!explicit || explicit === 'watched')) {
    // 評価欄に「保留」「未視聴」などと書かれている場合はそちらを優先
    status = ratingParse.value;
    explicitStatus = true;
  } else if (explicit) {
    status = explicit;
    explicitStatus = true;
  }

  if (status === 'pending' && rating !== null) {
    // 「保留」と書かれていても評価値があるなら評価を優先（値を変えない）
    warnings.push(`No.${legacyId}「${title}」は状態が保留ですが評価 ★${rating} があるため評価済みとして扱います`);
    status = 'watched';
  }
  if ((status === 'unwatched' || status === 'want' || status === 'unconfirmed') && rating !== null) {
    // 見ていない（または未確認の）作品に評価がある：矛盾しているので評価として数えず確認待ちにする
    warnings.push(`No.${legacyId}「${title}」は状態が「${status}」ですが評価 ★${rating} があります。評価としては数えず確認待ちにします（値はメモに残します）`);
    review = [review, `（元データの評価値: ★${rating}）`].filter(Boolean).join('\n');
    needsReview = needsReview ?? `状態と評価が矛盾しています（元データの評価 ★${rating}）`;
    rating = null;
  }
  if (!status) {
    if (rating !== null) status = 'watched';
    else if (ratingParse.kind === 'invalid') status = 'pending';
    else {
      status = 'unconfirmed';
      warnings.push(`No.${legacyId}「${title}」は評価も状態も無いため「未確認」として扱います`);
    }
  }
  if (ratingParse.kind === 'invalid' && status === 'watched') status = 'pending';
  if (status === 'watched' && rating === null && ratingParse.kind !== 'invalid') notes.push('視聴済み・評価なし');

  const watchedParsed = parsePartialDate(pick(o, K.watched));
  const rawWatched = pick(o, K.watched);
  if (rawWatched != null && !watchedParsed) warnings.push(`No.${legacyId}「${title}」の視聴日「${toStr(rawWatched)}」を解釈できないため日付不明として扱います`);
  if (watchedParsed && status !== 'watched' && status !== 'pending' && status !== 'watching') {
    warnings.push(`No.${legacyId}「${title}」は視聴済みではないため視聴日「${toStr(rawWatched)}」を使いません`);
  }

  const tmdbMedia = toStr(pick(o, K.tmdbMediaType)).toLowerCase();
  const planned = parsePartialDate(pick(o, K.planned));
  const release = parsePartialDate(pick(o, K.releaseDate));
  const poster = toStr(pick(o, K.poster));
  return {
    legacyId,
    title,
    alternateTitles: toList(pick(o, K.alt)).filter((t) => t !== title),
    edition: toStr(pick(o, K.edition)) || null,
    type,
    releaseYear: toYear(pick(o, K.year)),
    rating,
    status,
    watchedOn: status === 'watched' || status === 'pending' || status === 'watching' ? (watchedParsed?.value ?? null) : null,
    watchedOnPrecision: status === 'watched' || status === 'pending' || status === 'watching' ? (watchedParsed?.precision ?? null) : null,
    platform: toStr(pick(o, K.platform)) || null,
    review,
    tags: toList(pick(o, K.tags)),
    genres: toList(pick(o, K.genres)),
    country: toList(pick(o, K.country)),
    directors: toList(pick(o, K.directors)),
    cast: toList(pick(o, K.cast)),
    runtime: toMinutes(pick(o, K.runtime)),
    seasonCount: toInt(pick(o, K.seasons)),
    episodeCount: toInt(pick(o, K.episodes)),
    synopsis: toStr(pick(o, K.synopsis)) || null,
    needsReview,
    sourceCategory: toStr(pick(o, K.sourceCategory)) || null,
    importNote: toStr(pick(o, K.importNote)) || null,
    tmdbId: toInt(pick(o, K.tmdbId)),
    tmdbMediaType: tmdbMedia === 'movie' || tmdbMedia === 'tv' ? tmdbMedia : null,
    posterPath: /^(\/|https:\/\/)/.test(poster) ? poster : null,
    explicitStatus,
    watchlistNumber: status === 'want' ? toInt(pick(o, K.wlNo)) : null,
    plannedDate: planned?.precision === 'day' ? planned.value : null,
    releaseDate: release?.precision === 'day' ? release.value : null,
    availableOn: toList(pick(o, K.services)),
    notes,
  };
}

/** 取り込み前プレビュー用の集計 */
export function summarizeSeed(seed: NormalizedSeed) {
  const rated = seed.records.filter((r) => r.rating !== null);
  const avg = rated.length ? rated.reduce((s, r) => s + r.rating!, 0) / rated.length : null;
  const count = (s: WatchStatus) => seed.records.filter((r) => r.status === s).length;
  return {
    total: seed.records.length,
    totalWorks: seed.records.length + seed.watchlist.filter((w) => w.linkedLegacyId == null).length,
    rated: rated.length,
    watchedUnrated: seed.records.filter((r) => r.status === 'watched' && r.rating === null).length,
    pending: count('pending'),
    unwatched: count('unwatched'),
    unconfirmed: count('unconfirmed'),
    watching: count('watching'),
    want: count('want') + seed.watchlist.filter((w) => w.linkedLegacyId == null).length,
    watchlist: seed.watchlist.length,
    averageRating: avg,
    distribution: [1, 2, 3, 4, 5].map((n) => rated.filter((r) => r.rating === n).length),
    withDate: seed.records.filter((r) => r.watchedOn).length,
    needsReview: seed.records.filter((r) => r.needsReview).length + seed.watchlist.filter((w) => w.needsReview).length,
    withTmdb: seed.records.filter((r) => r.tmdbId != null).length,
    byType: {
      movie: seed.records.filter((r) => r.type === 'movie').length,
      drama: seed.records.filter((r) => r.type === 'drama').length,
      anime: seed.records.filter((r) => r.type === 'anime').length,
      other: seed.records.filter((r) => r.type === 'other').length,
    },
  };
}
