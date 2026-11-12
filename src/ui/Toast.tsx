import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

interface ToastItem {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone: 'info' | 'error';
}

interface ToastApi {
  show: (message: string, opts?: { actionLabel?: string; onAction?: () => void; tone?: 'info' | 'error'; duration?: number }) => void;
  error: (e: unknown, fallback?: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const show = useCallback<ToastApi['show']>(
    (message, opts = {}) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-2), { id, message, actionLabel: opts.actionLabel, onAction: opts.onAction, tone: opts.tone ?? 'info' }]);
      setTimeout(() => dismiss(id), opts.duration ?? (opts.onAction ? 6000 : 3200));
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      error: (e, fallback = '保存に失敗しました') => {
        console.error(e);
        const msg = e instanceof Error && e.message ? `${fallback}：${e.message}` : fallback;
        show(msg, { tone: 'error', duration: 6000 });
      },
    }),
    [show],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--nav-h)+var(--safe-b)+12px)] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
        aria-live="polite"
        role="status"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-md px-4 py-3 text-sm font-bold shadow-[var(--shadow-print-sm)] ${t.tone === 'error' ? 'bg-red text-white' : 'bg-[#2f2f2f] text-ink'}`}
          >
            <span className="flex-1">{t.message}</span>
            {t.actionLabel && (
              <button
                type="button"
                className="-my-2 min-h-11 px-2 font-bold text-ink underline underline-offset-4"
                onClick={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('ToastProvider がありません');
  return c;
}
