import { DexieRepository } from './dexie/DexieRepository';
import type { LibraryRepository } from './repository';

/**
 * アプリ全体で使うリポジトリ。
 * クラウド同期を追加する場合は、ここで別実装（例: SupabaseRepository）に差し替える。
 */
export const repository: LibraryRepository = new DexieRepository();

export type { LibraryRepository } from './repository';

/** ブラウザに「消さないでほしい」永続保存を依頼（Safari でも一部有効） */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
