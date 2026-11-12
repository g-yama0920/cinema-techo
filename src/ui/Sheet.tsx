import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconClose } from './icons';

/**
 * ボトムシート（スマホ）／中央ダイアログ（PC）。
 * ネイティブ <dialog> の showModal を使うため、フォーカス管理・Esc で閉じる動作はブラウザ標準。
 */
export function Sheet({
  open,
  onClose,
  title,
  kicker,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  kicker?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      document.documentElement.style.overflow = 'hidden';
    }
    if (!open && d.open) d.close();
    return () => {
      if (!open) document.documentElement.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    const onCloseEv = () => {
      document.documentElement.style.overflow = '';
    };
    d.addEventListener('cancel', onCancel);
    d.addEventListener('close', onCloseEv);
    return () => {
      d.removeEventListener('cancel', onCancel);
      d.removeEventListener('close', onCloseEv);
      document.documentElement.style.overflow = '';
    };
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`fixed m-0 mt-auto max-h-[92dvh] w-full max-w-none border-0 bg-transparent p-0 text-ink md:m-auto md:max-h-[88vh] ${wide ? 'md:max-w-2xl' : 'md:max-w-lg'}`}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl bg-[#181818] md:max-h-[88vh] md:rounded-lg md:shadow-[var(--shadow-print)]">
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/25 md:hidden" aria-hidden="true" />
          <div className="flex items-start justify-between gap-3 border-b border-line px-4 pt-3 pb-3">
            <div className="min-w-0">
              {kicker && <p className="text-xs font-bold text-red">{kicker}</p>}
              <h2 id={titleId} className="text-lg leading-snug font-bold">
                {title}
              </h2>
            </div>
            <button type="button" onClick={onClose} className="-m-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="閉じる">
              <IconClose />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
          {footer && <div className="border-t border-line bg-[#181818] px-4 pt-3 pb-[calc(12px+var(--safe-b))] md:pb-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** 確認ダイアログ */
export function ConfirmSheet({
  open,
  title,
  children,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      kicker="確認"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="min-h-12 rounded bg-white/15 font-bold hover:bg-white/25">
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-12 rounded font-bold ${danger ? 'bg-red text-white' : 'bg-ink text-paper'}`}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="text-[15px]">{children}</div>
    </Sheet>
  );
}
