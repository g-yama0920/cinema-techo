/**
 * ビルド時に seed/ フォルダへ置いた初期データを読み込む。
 *   seed/movie_tracker_full_catalog.json（正式データ。旧 movie_tracker_seed.json も可）
 *   seed/movie_tracker_full_catalog.csv（照合用・任意）
 * seed/*.json・*.csv は .gitignore 済みで、置いた場合だけアプリに同梱される。
 * 公開サーバーに置く場合、同梱したファイルの中身は誰でも取得できる点に注意。
 */
const jsonFiles = import.meta.glob<unknown>('/seed/*.json', { import: 'default' });
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
  return Object.keys(jsonFiles).length > 0;
}

export async function loadBundledSeed(): Promise<{ name: string; data: unknown; csv: { name: string; text: string } | null } | null> {
  const key = choose(Object.keys(jsonFiles));
  if (!key) return null;
  const data = await jsonFiles[key]();
  const csvKey = choose(Object.keys(csvFiles));
  const csv = csvKey ? { name: csvKey.split('/').pop()!, text: await csvFiles[csvKey]() } : null;
  return { name: key.split('/').pop()!, data, csv };
}
