import { useEffect } from 'react';
import { useLibraryState, useRepo } from '../data/LibraryProvider';
import { normalizeSeed } from '../domain/seed';
import { hasBundledSeed, loadBundledSeed } from '../services/bundledSeed';
import { planSeedImport } from '../services/seedImport';
import { useToast } from '../ui/Toast';

let started = false;

/**
 * 同梱の初期データ（seed/）がある場合、データが空の初回起動時だけ自動で登録する。
 * 既にデータがある端末では何もしない（上書き・削除はしない）。取り込み画面から手動でも実行できる。
 */
export function AutoSeed() {
  const state = useLibraryState();
  const repo = useRepo();
  const toast = useToast();
  useEffect(() => {
    if (started || state.status !== 'ready' || !hasBundledSeed()) return;
    const { index } = state;
    if (index.bundles.length || index.snapshot.settings.seedImportedAt) return;
    started = true;
    (async () => {
      const bundled = await loadBundledSeed();
      if (!bundled) return;
      const seed = normalizeSeed(bundled.data);
      if (seed.errors.length) {
        toast.show('同梱の初期データに問題があるため自動登録しませんでした（設定 → 既存の記録 で確認できます）', { tone: 'error', duration: 8000 });
        return;
      }
      const snap = await repo.load();
      if (snap.works.length) return; // 直前に別の画面で登録された場合は何もしない
      const plan = planSeedImport(seed, snap);
      await repo.applyChanges(plan.changes, 'merge');
      toast.show(`初期データ ${plan.added} 件を登録しました`, { duration: 6000 });
    })().catch((e) => toast.error(e, '初期データの登録に失敗しました'));
  }, [state, repo, toast]);
  return null;
}
