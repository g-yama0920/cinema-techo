import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { STATUS_LABEL } from '../domain/labels';
import type { WatchStatus } from '../domain/types';
import { IconAlert, IconChevronRight } from './icons';

// ---------- ボタン ----------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ink';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-red text-paper border-red hover:bg-red-deep active:bg-red-deep',
  ink: 'bg-ink text-paper border-ink hover:bg-ink-soft',
  secondary: 'bg-paper-light text-ink border-ink hover:bg-paper-deep',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-paper-deep',
  danger: 'bg-paper-light text-red border-red hover:bg-red hover:text-paper',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'sm' | 'lg'; block?: boolean }>(
  function Button({ variant = 'secondary', size = 'md', block, className = '', type = 'button', ...rest }, ref) {
    const sz = size === 'lg' ? 'min-h-14 px-5 text-base' : size === 'sm' ? 'min-h-10 px-3 text-sm' : 'min-h-12 px-4 text-[15px]';
    return (
      <button
        ref={ref}
        type={type}
        className={`inline-flex items-center justify-center gap-2 border font-bold tracking-wide transition-colors disabled:cursor-not-allowed disabled:border-gray-light disabled:bg-paper-deep disabled:text-gray ${sz} ${VARIANT[variant]} ${block ? 'w-full' : ''} ${className}`}
        {...rest}
      />
    );
  },
);

// ---------- 長方形の切り替えタブ ----------

export interface TabOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

/** 長方形・明快な切り替え（ラジオボタンとして振る舞う） */
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
      className={`flex border border-ink bg-paper-light ${scroll ? 'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : ''}`}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`${scroll ? 'shrink-0 px-3.5' : 'min-w-0 flex-1 px-1'} ${size === 'sm' ? 'min-h-10 text-[13px]' : 'min-h-11 text-sm'} ${i ? 'border-l border-ink' : ''} flex items-center justify-center gap-1 font-bold whitespace-nowrap transition-colors ${active ? 'bg-ink text-paper' : 'text-ink hover:bg-paper-deep'}`}
          >
            <span>{o.label}</span>
            {o.count != null && <span className={`num text-[10px] ${active ? 'text-mustard' : 'text-gray'}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ---------- 状態バッジ ----------

const STATUS_STYLE: Record<WatchStatus, string> = {
  want: 'bg-mustard text-ink border-mustard',
  watching: 'bg-teal text-paper border-teal',
  watched: 'bg-ink text-paper border-ink',
  pending: 'bg-paper-light text-ink border-ink border-dashed',
  unwatched: 'bg-transparent text-gray border-gray',
  unconfirmed: 'bg-transparent text-ink-soft border-gray border-dotted',
};

export function StatusBadge({ status, className = '' }: { status: WatchStatus; className?: string }) {
  return (
    <span className={`inline-flex h-5 items-center border px-1.5 text-[10.5px] leading-none font-bold whitespace-nowrap ${STATUS_STYLE[status]} ${className}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/** 確認待ち（同名作品・原作との区別などの判断が必要） */
export function ReviewBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex h-5 items-center border border-red bg-paper-light px-1.5 text-[10.5px] leading-none font-bold whitespace-nowrap text-red ${className}`}>確認待ち</span>
  );
}

export function TypeLabel({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-5 items-center border border-ink px-1.5 text-[10.5px] leading-none font-bold">{children}</span>;
}

// ---------- 見出し ----------

/** 各画面の上部（雑誌の柱・表題風） */
export function PageHeader({ en, ja, right, sub }: { en: string; ja: string; right?: ReactNode; sub?: ReactNode }) {
  return (
    <header className="pt-[calc(var(--safe-t)+14px)] md:pt-8">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <p className="kicker text-red">{ja}</p>
        {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
      </div>
      <h1 className="font-display text-[clamp(30px,10vw,38px)] leading-[1.05] tracking-[0.02em] md:text-5xl">{en}</h1>
      <div className="rule-double mt-3" />
      {sub && <div className="mt-3">{sub}</div>}
    </header>
  );
}

export function SectionHeader({ no, title, en, to, linkLabel = 'すべて見る' }: { no?: string; title: string; en?: string; to?: string; linkLabel?: string }) {
  return (
    <div className="mb-3">
      {(no || en) && (
        <p className="kicker flex items-center gap-2 leading-none text-red" aria-hidden="true">
          {no && <span className="num text-[12px] tracking-normal">{no}</span>}
          {en && <span className="truncate">{en}</span>}
        </p>
      )}
      <div className="mt-1 flex items-end gap-3">
        <h2 className="shrink-0 text-lg leading-tight font-bold">{title}</h2>
        <span className="mb-[5px] h-px min-w-4 flex-1 bg-ink" aria-hidden="true" />
        {to && (
          <Link to={to} className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-0.5 text-[13px] font-bold whitespace-nowrap text-ink hover:text-red">
            {linkLabel}
            <IconChevronRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}

// ---------- 状態表示 ----------

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-gray px-5 py-7 text-center">
      <p className="font-bold">{title}</p>
      {children && <div className="mt-1.5 text-sm text-ink-soft">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = '読み込み中…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3" role="status" aria-live="polite">
      <div className="flex gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-3 w-3 animate-pulse bg-red" style={{ animationDelay: `${i * 160}ms` }} />
        ))}
      </div>
      <p className="text-sm font-bold">{label}</p>
    </div>
  );
}

export function ErrorState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-red bg-paper-light px-4 py-4" role="alert">
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
  return (
    <div className={`border px-3.5 py-3 text-sm ${tone === 'warn' ? 'border-red bg-paper-light' : 'border-ink bg-paper-light'}`}>{children}</div>
  );
}
