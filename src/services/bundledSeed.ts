/**
 * アプリに同梱した初期データ（seed/ フォルダ）を読み込む。
 *   seed/movie_tracker_full_catalog.json（正式データ。旧 movie_tracker_seed.json も可）
 *   seed/movie_tracker_full_catalog.csv（JSON があれば照合用、無ければ CSV を正式データとして使う）
 * データが空の端末で初めて開いたときに、AutoSeed が自動で登録する。
 * 公開サーバーに置くと、同梱したファイルの中身は誰でも取得できる（利用者の了承済みで同梱している）。
 * テストなどで同梱データを使わないビルドにする場合は SEED_BUNDLE=off でビルドする。
 */
import { csvToObjects } from '../domain/reconcile';
import type { TmdbMetadataFile } from '../domain/tmdbMetadata';

// 作品一覧のデータ（tmdb_*.json は作品情報なので除く）
const jsonFiles = import.meta.glob<unknown>(['/seed/*.json', '!/seed/tmdb_*.json'], { import: 'default' });
// TMDb の作品情報（ポスター・あらすじなど。元番号で対応づける）
const metadataFiles = import.meta.glob<TmdbMetadataFile>('/seed/tmdb_metadata.json', { import: 'default' });
const csvFiles = import.meta.glob<string>('/seed/*.csv', { query: '?raw', import: 'default' });

const PREFERRED = ['movie_tracker_full_catalog', 'movie_tracker_seed'];

function choose(keys: string[]): string | undefined {
  for (const p of PREFERRED) {
    const k = keys.find((x) => x.split('/').pop()!.startsWith(p));
    if (k) return k;
  }
  return keys[0];
}

export function hasBundledSeed(): boolean {
  return __BUNDLE_SEED__ && (Object.keys(jsonFiles).length > 0 || Object.keys(csvFiles).length > 0);
}

export interface BundledSeed {
  name: string;
  /** 正式データ（JSON はそのまま、CSV は行オブジェクトの配列） */
  data: unknown;
  kind: 'json' | 'csv';
  /** JSON と一緒に同梱された照合用 CSV */
  csv: { name: string; text: string } | null;
}

export async function loadBundledSeed(): Promise<BundledSeed | null> {
  if (!hasBundledSeed()) return null;
  const jsonKey = choose(Object.keys(jsonFiles));
  const csvKey = choose(Object.keys(csvFiles));
  const csv = csvKey ? { name: csvKey.split('/').pop()!, text: await csvFiles[csvKey]() } : null;
  if (jsonKey) return { name: jsonKey.split('/').pop()!, data: await jsonFiles[jsonKey](), kind: 'json', csv };
  if (csv) return { name: csv.name, data: csvToObjects(csv.text), kind: 'csv', csv: null };
  return null;
}

/** 同梱の TMDb 作品情報。無ければ null */
export async function loadBundledMetadata(): Promise<TmdbMetadataFile | null> {
  if (!__BUNDLE_SEED__) return null;
  const key = Object.keys(metadataFiles)[0];
  return key ? metadataFiles[key]() : null;
}
