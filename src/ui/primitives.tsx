import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { STATUS_LABEL } from '../domain/labels';
import type { WatchStatus } from '../domain/types';
import { IconAlert, IconChevronRight } from './icons';

// ---------- ボタン ----------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ink';
const VARIANT: Record<Variant, string> = {
  /** 赤：登録・記録など主な操作 */
  primary: 'bg-red text-white border-red hover:bg-red-deep active:bg-red-deep',
  /** 白地に黒文字：再生ボタンのような目立つ操作 */
  ink: 'bg-ink text-paper border-ink hover:bg-ink/80',
  /** 半透明のグレー */
  secondary: 'bg-white/15 text-ink border-transparent hover:bg-white/25',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-white/10',
  danger: 'bg-transparent text-red border-red hover:bg-red hover:text-white',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'sm' | 'lg'; block?: boolean }>(
  function Button({ variant = 'secondary', size = 'md', block, className = '', type = 'button', ...rest }, ref) {
    const sz = size === 'lg' ? 'min-h-14 px-5 text-base' : size === 'sm' ? 'min-h-10 px-3.5 text-sm' : 'min-h-12 px-4 text-[15px]';
    return (
      <button
        ref={ref}
        type={type}
        className={`inline-flex items-center justify-center gap-2 rounded border font-bold transition-colors disabled:cursor-not-allowed disabled:border-transparent disabled:bg-white/10 disabled:text-gray ${sz} ${VARIANT[variant]} ${block ? 'w-full' : ''} ${className}`}
        {...rest}
      />
    );
  },
);

// ---------- 切り替え（チップ） ----------

export interface TabOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

/** 丸いチップの切り替え（ラジオボタンとして振る舞う）。選択中は白地に黒文字 */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  scroll = false,
}: {
  options: TabOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: 'md' | 'sm';
  scroll?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex gap-2 ${scroll ? '-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden' : 'flex-wrap'}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex shrink-0 items-center justify-center gap-1.5 rounded-full border px-4 font-bold whitespace-nowrap transition-colors ${size === 'sm' ? 'min-h-9 text-[13px]' : 'min-h-10 text-sm'} ${active ? 'border-ink bg-ink text-paper' : 'border-gray-light text-ink hover:border-ink-soft'}`}
          >
            <span>{o.label}</span>
            {o.count != null && <span className={`text-[11px] font-bold ${active ? 'text-paper/60' : 'text-gray'}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ---------- 状態バッジ ----------

const STATUS_STYLE: Record<WatchStatus, string> = {
  want: 'bg-mustard text-black border-mustard',
  watching: 'bg-teal text-black border-teal',
  watched: 'bg-white/90 text-black border-transparent',
  pending: 'bg-transparent text-ink border-ink-soft',
  unwatched: 'bg-transparent text-gray border-gray-light',
  unconfirmed: 'bg-transparent text-ink-soft border-gray-light border-dashed',
};

export function StatusBadge({ status, className = '' }: { status: WatchStatus; className?: string }) {
  return (
    <span className={`inline-flex h-5 items-center rounded-sm border px-1.5 text-[10.5px] leading-none font-bold whitespace-nowrap ${STATUS_STYLE[status]} ${className}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/** 確認待ち（同名作品・原作との区別などの判断が必要） */
export function ReviewBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex h-5 items-center rounded-sm border border-red px-1.5 text-[10.5px] leading-none font-bold whitespace-nowrap text-red ${className}`}>確認待ち</span>
  );
}

export function TypeLabel({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-5 items-center rounded-sm border border-gray-light px-1.5 text-[10.5px] leading-none font-bold">{children}</span>;
}

// ---------- 見出し ----------

/** 各画面の上部：細長い英字の大見出し＋日本語の小見出し */
export function PageHeader({ en, ja, right, sub }: { en: string; ja: string; right?: ReactNode; sub?: ReactNode }) {
  return (
    <header className="pt-[calc(var(--safe-t)+14px)] md:pt-8">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="num text-[clamp(38px,12vw,48px)] leading-[0.95] md:text-6xl">{en}</h1>
          <p className="mt-0.5 text-[13px] font-bold text-ink-soft">{ja}</p>
        </div>
        {right && <div className="flex shrink-0 items-center gap-2 pb-1">{right}</div>}
      </div>
      {sub && <div className="mt-4">{sub}</div>}
    </header>
  );
}

/** 横スクロール列などの見出し（白い太字＋右に「すべて見る」） */
export function SectionHeader({ title, to, linkLabel = 'すべて見る' }: { no?: string; title: string; en?: string; to?: string; linkLabel?: string }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <h2 className="min-w-0 truncate text-[17px] leading-tight font-bold md:text-xl">{title}</h2>
      {to && (
        <Link to={to} className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-0.5 text-[13px] font-bold whitespace-nowrap text-ink-soft hover:text-ink">
          {linkLabel}
          <IconChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

// ---------- 状態表示 ----------

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-md bg-paper-light px-5 py-7 text-center">
      <p className="font-bold">{title}</p>
      {children && <div className="mt-1.5 text-sm text-ink-soft">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = '読み込み中…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/15 border-t-red" aria-hidden="true" />
      <p className="text-sm font-bold text-ink-soft">{label}</p>
    </div>
  );
}

export function ErrorState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-md border-l-4 border-red bg-paper-light px-4 py-4" role="alert">
      <p className="flex items-center gap-2 font-bold text-red">
        <IconAlert size={18} />
        {title}
      </p>
      {children && <div className="mt-1.5 text-sm">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return <div className={`rounded-md px-3.5 py-3 text-sm ${tone === 'warn' ? 'border-l-4 border-red bg-paper-light' : 'bg-paper-light'}`}>{children}</div>;
}
