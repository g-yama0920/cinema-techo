import { useEffect } from 'react';
import { useLibraryState, useRepo } from '../data/LibraryProvider';
import { nowISO } from '../domain/dates';
import { normalizeSeed } from '../domain/seed';
import { planMetadataApply } from '../domain/tmdbMetadata';
import { hasBundledSeed, loadBundledMetadata, loadBundledSeed } from '../services/bundledSeed';
import { planSeedImport } from '../services/seedImport';
import { useToast } from '../ui/Toast';

let started = false;

/**
 * 同梱の初期データ（seed/）を使う自動処理。
 * 1. データが空の端末の初回起動時だけ、全作品を登録する（作品情報も一緒に入れる）
 * 2. 既に登録済みの端末では、同梱の TMDb 作品情報（ポスター・あらすじなど）で空欄だけを補う（版ごとに1回）
 * どちらも、利用者が入力・変更した評価・視聴状況・メモは変えない。削除もしない。
 */
export function AutoSeed() {
  const state = useLibraryState();
  const repo = useRepo();
  const toast = useToast();
  useEffect(() => {
    if (started || state.status !== 'ready' || !hasBundledSeed()) return;
    started = true;
    const { index } = state;
    (async () => {
      const metadata = await loadBundledMetadata();
      const settings = index.snapshot.settings;
      if (!index.bundles.length && !settings.seedImportedAt) {
        const bundled = await loadBundledSeed();
        if (!bundled) return;
        const seed = normalizeSeed(bundled.data);
        if (seed.errors.length) {
          toast.show('同梱の初期データに問題があるため自動登録しませんでした（設定 → 既存の記録 で確認できます）', { tone: 'error', duration: 8000 });
          return;
        }
        const snap = await repo.load();
        if (snap.works.length) return; // 直前に別の画面で登録された場合は何もしない
        const plan = planSeedImport(seed, snap, nowISO(), metadata);
        await repo.applyChanges(plan.changes, 'merge');
        if (metadata) await repo.updateSettings({ tmdbMetadataVersion: metadata.version });
        toast.show(`初期データ ${plan.added} 件を登録しました`, { duration: 6000 });
        return;
      }
      if (!metadata || (settings.tmdbMetadataVersion ?? 0) >= metadata.version) return;
      const snap = await repo.load();
      const now = nowISO();
      const updates = planMetadataApply(snap.works, metadata, now);
      if (updates.length) {
        const byId = new Map(snap.works.map((w) => [w.id, w]));
        await repo.applyChanges({ works: updates.map(({ workId, patch }) => ({ ...byId.get(workId)!, ...patch, updatedAt: now })) }, 'merge');
      }
      await repo.updateSettings({ tmdbMetadataVersion: metadata.version });
      const posters = updates.filter((u) => u.patch.tmdbId != null).length;
      if (posters) toast.show(`作品情報（ポスター・あらすじなど）を ${posters} 件に追加しました`, { duration: 6000 });
    })().catch((e) => toast.error(e, '初期データの処理に失敗しました'));
  }, [state, repo, toast]);
  return null;
}
