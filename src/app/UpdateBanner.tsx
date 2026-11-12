import { useRegisterSW } from 'virtual:pwa-register/react';

/** 新しいバージョンがあるときだけ表示（入力中に勝手に再読み込みしないよう、更新は手動） */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="fixed inset-x-0 top-[calc(var(--safe-t)+8px)] z-50 flex justify-center px-4" role="status">
      <div className="flex w-full max-w-md items-center gap-3 border border-ink bg-mustard px-4 py-2.5 text-sm font-bold shadow-[var(--shadow-print-sm)]">
        <span className="flex-1">新しいバージョンがあります</span>
        <button type="button" className="min-h-10 px-2 underline underline-offset-4" onClick={() => setNeedRefresh(false)}>
          あとで
        </button>
        <button type="button" className="min-h-10 border border-ink bg-ink px-3 text-paper" onClick={() => updateServiceWorker(true)}>
          更新
        </button>
      </div>
    </div>
  );
}
