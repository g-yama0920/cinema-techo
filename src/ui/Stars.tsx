import { useRef, type KeyboardEvent } from 'react';
import { RATING_LABEL, RATINGS } from '../domain/labels';
import type { Rating } from '../domain/types';

const STAR_PATH = 'M12 2.6l2.82 6.06 6.64.78-4.9 4.55 1.3 6.56L12 17.27l-5.86 3.28 1.3-6.56-4.9-4.55 6.64-.78z';

function Star({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="shrink-0">
      <path
        d={STAR_PATH}
        fill={filled ? 'var(--color-red)' : 'none'}
        stroke={filled ? 'var(--color-red)' : 'var(--color-gray)'}
        strokeWidth={filled ? 1 : 1.5}
        strokeLinejoin="miter"
      />
    </svg>
  );
}

/** 表示専用の星。評価なしは「—」、評価保留は「保留」 */
export function StarDisplay({
  rating,
  size = 14,
  pending = false,
  className = '',
}: {
  rating: Rating | null;
  size?: number;
  pending?: boolean;
  className?: string;
}) {
  if (rating == null) {
    return (
      <span className={`inline-flex items-center text-[11px] font-bold text-gray ${className}`} aria-label={pending ? '評価保留' : '評価なし'}>
        {pending ? '評価保留' : '—'}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-[1px] ${className}`} role="img" aria-label={`星${rating}つ：${RATING_LABEL[rating]}`}>
      {RATINGS.map((n) => (
        <Star key={n} filled={n <= rating} size={size} />
      ))}
    </span>
  );
}

/**
 * 星の入力。ラジオグループとして実装（矢印キー・スクリーンリーダー対応）。
 * タップ領域は 1 つ 44px 以上。
 */
export function StarInput({
  value,
  onChange,
  size = 34,
  label = '評価',
  showLabel = true,
}: {
  value: Rating | null;
  onChange: (r: Rating) => void;
  size?: number;
  label?: string;
  showLabel?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, n: Rating) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(5, n + 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(1, n - 1);
    if (e.key === 'Home') next = 1;
    if (e.key === 'End') next = 5;
    if (next != null) {
      e.preventDefault();
      onChange(next as Rating);
      refs.current[next - 1]?.focus();
    }
  };
  const focusable = value ?? 1;
  return (
    <div>
      <div role="radiogroup" aria-label={label} className="flex items-center">
        {RATINGS.map((n) => (
          <button
            key={n}
            ref={(el) => {
              refs.current[n - 1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`星${n}つ：${RATING_LABEL[n]}`}
            tabIndex={n === focusable ? 0 : -1}
            onClick={() => onChange(n)}
            onKeyDown={(e) => onKey(e, n)}
            className="grid min-h-11 min-w-11 place-items-center transition-transform active:scale-90"
          >
            <Star filled={value != null && n <= value} size={size} />
          </button>
        ))}
      </div>
      {showLabel && (
        <p className="mt-1 min-h-6 text-sm font-bold" aria-live="polite">
          {value ? (
            <>
              <span className="num mr-2 text-red">★{value}</span>
              {RATING_LABEL[value]}
            </>
          ) : (
            <span className="text-gray">星をタップして評価</span>
          )}
        </p>
      )}
    </div>
  );
}
