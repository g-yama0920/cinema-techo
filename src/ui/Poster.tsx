import { useState } from 'react';
import { WORK_TYPE_EN } from '../domain/labels';
import { padNo } from '../domain/text';
import type { Work } from '../domain/types';

export function tmdbImageUrl(path: string | null, size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' = 'w342'): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

type PosterWork = Pick<Work, 'title' | 'type' | 'releaseYear' | 'posterPath' | 'catalogNo'> & { edition?: string | null };

/**
 * 縦長ポスター。画像が無い・読み込めない場合は、雑誌の扉のような文字組みのポスターを自動生成する。
 */
export function Poster({
  work,
  size = 'w342',
  className = '',
  shadow = false,
  decorative = false,
}: {
  work: PosterWork;
  size?: 'w92' | 'w154' | 'w185' | 'w342' | 'w500';
  className?: string;
  shadow?: boolean;
  /** 親のボタン・リンクが作品名を読み上げる場合は装飾扱いにする */
  decorative?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const url = tmdbImageUrl(work.posterPath, size);
  const base = `relative aspect-[2/3] w-full overflow-hidden border border-ink bg-paper-deep ${shadow ? 'shadow-[var(--shadow-print)]' : ''} ${className}`;
  if (url && !failed) {
    return (
      <div className={base}>
        <img
          src={url}
          alt={decorative ? '' : `${work.title}のポスター`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }
  return <PosterPlaceholder work={work} className={base} decorative={decorative} />;
}

const SCHEMES = [
  { bg: 'var(--color-red)', fg: 'var(--color-paper)', ac: 'var(--color-mustard)', onAc: 'var(--color-ink)' },
  { bg: 'var(--color-teal)', fg: 'var(--color-paper)', ac: 'var(--color-mustard)', onAc: 'var(--color-ink)' },
  { bg: 'var(--color-ink)', fg: 'var(--color-paper)', ac: 'var(--color-red)', onAc: 'var(--color-paper)' },
  { bg: 'var(--color-mustard)', fg: 'var(--color-ink)', ac: 'var(--color-red)', onAc: 'var(--color-paper)' },
  { bg: 'var(--color-paper-deep)', fg: 'var(--color-ink)', ac: 'var(--color-teal)', onAc: 'var(--color-paper)' },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function titleSize(title: string): string {
  const len = [...title].length;
  if (len <= 2) return '30cqw';
  if (len <= 4) return '21cqw';
  if (len <= 6) return '16cqw';
  if (len <= 9) return '13cqw';
  if (len <= 14) return '11cqw';
  return '9cqw';
}

function PosterPlaceholder({ work, className, decorative }: { work: PosterWork; className: string; decorative: boolean }) {
  const h = hash(`${work.title}${work.catalogNo}`);
  const s = SCHEMES[h % SCHEMES.length];
  // 長いタイトルは円の外にはみ出すため「円」の図案を使わない
  const variant = [...work.title].length > 6 ? 1 + ((h >>> 4) % 2) : (h >>> 4) % 3;
  return (
    <div className={`${className} @container`} style={{ background: s.bg, color: s.fg }} {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': `${work.title}（ポスター画像なし）` })}>
      {variant === 0 && (
        <div className="absolute left-1/2 top-[46%] aspect-square w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: s.ac, opacity: 0.9 }} />
      )}
      {variant === 1 && <div className="absolute inset-x-0 bottom-[17%] h-[13%]" style={{ background: s.ac }} />}
      {variant === 2 && (
        <>
          <div className="absolute inset-x-[5%] top-[19%] h-px" style={{ background: s.fg, opacity: 0.7 }} />
          <div className="absolute inset-x-[5%] bottom-[19%] h-px" style={{ background: s.fg, opacity: 0.7 }} />
        </>
      )}
      <div className="absolute inset-[4.5%] border" style={{ borderColor: s.fg, opacity: 0.55 }} />
      <div className="absolute inset-x-[10%] top-[8%] flex items-start justify-between font-display leading-none" style={{ fontSize: '6.4cqw', letterSpacing: '0.12em' }}>
        <span>{WORK_TYPE_EN[work.type]}</span>
        {work.catalogNo > 0 && <span>{padNo(work.catalogNo)}</span>}
      </div>
      <div
        className="absolute inset-x-[9%] top-[22%] bottom-[25%] flex items-center justify-center text-center font-display leading-[1.18] break-words [overflow-wrap:anywhere]"
        style={{ fontSize: titleSize(work.title), color: variant === 0 ? s.onAc : s.fg }}
      >
        <span className="line-clamp-4">{work.title}</span>
      </div>
      <div className="absolute inset-x-[10%] bottom-[7.5%] flex items-end justify-between font-display leading-none" style={{ fontSize: '6.4cqw', letterSpacing: '0.08em' }}>
        <span>{work.releaseYear ?? '—'}</span>
        <span aria-hidden="true">★</span>
      </div>
    </div>
  );
}
