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
        <div className="flex max-h-[92dvh] flex-col border-t-[3px] border-ink bg-paper md:max-h-[88vh] md:border-[1.5px] md:shadow-[6px_6px_0_0_var(--color-ink)]">
          <div className="flex items-start justify-between gap-3 border-b border-ink px-4 pt-4 pb-3">
            <div className="min-w-0">
              {kicker && <p className="kicker text-red">{kicker}</p>}
              <h2 id={titleId} className="text-lg leading-snug font-bold">
                {title}
              </h2>
            </div>
            <button type="button" onClick={onClose} className="-m-2 grid h-11 w-11 shrink-0 place-items-center hover:text-red" aria-label="閉じる">
              <IconClose />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
          {footer && <div className="border-t border-ink bg-paper-light px-4 pt-3 pb-[calc(12px+var(--safe-b))] md:pb-3">{footer}</div>}
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
          <button type="button" onClick={onClose} className="min-h-12 border border-ink bg-paper-light font-bold">
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-12 border font-bold ${danger ? 'border-red bg-red text-paper' : 'border-ink bg-ink text-paper'}`}
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
