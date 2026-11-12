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
  const base = `relative aspect-[2/3] w-full overflow-hidden rounded bg-paper-deep ${shadow ? 'shadow-[var(--shadow-print)]' : ''} ${className}`;
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

/** 画像が無いときの地色（深い色だけを使い、白い文字が読めるようにする） */
const SCHEMES = ['#5c0b12', '#0f2b46', '#2c1842', '#0c3430', '#3d2a10', '#262626', '#41121f', '#122a2a'];

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
  if (len <= 2) return '26cqw';
  if (len <= 4) return '19cqw';
  if (len <= 6) return '15cqw';
  if (len <= 9) return '12.5cqw';
  if (len <= 14) return '10.5cqw';
  return '9cqw';
}

function PosterPlaceholder({ work, className, decorative }: { work: PosterWork; className: string; decorative: boolean }) {
  const h = hash(`${work.title}${work.catalogNo}`);
  const bg = SCHEMES[h % SCHEMES.length];
  return (
    <div
      className={`${className} @container text-white`}
      style={{ background: bg }}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': `${work.title}（ポスター画像なし）` })}
    >
      {/* 斜めの光と下の暗がり（配信サービスのサムネイル風） */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 70% at 85% 0%, rgb(255 255 255 / 0.14), transparent 60%)' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgb(0 0 0 / 0.85) 0%, rgb(0 0 0 / 0.25) 45%, transparent 70%)' }} />
      <div className="absolute top-[7%] left-[8%] flex items-center gap-[3cqw] font-display leading-none" style={{ fontSize: '8cqw', letterSpacing: '0.08em' }}>
        <span className="block h-[9cqw] w-[2.2cqw] bg-red" aria-hidden="true" />
        <span>{WORK_TYPE_EN[work.type]}</span>
      </div>
      {work.catalogNo > 0 && (
        <span className="absolute top-[7%] right-[8%] font-display leading-none text-white/60" style={{ fontSize: '8cqw' }}>
          {padNo(work.catalogNo)}
        </span>
      )}
      <div
        className="absolute inset-x-[8%] bottom-[15%] text-left leading-[1.15] font-black break-words [overflow-wrap:anywhere]"
        style={{ fontSize: titleSize(work.title), textShadow: '0 2px 8px rgb(0 0 0 / 0.6)' }}
      >
        <span className="line-clamp-4">{work.title}</span>
      </div>
      <span className="absolute bottom-[6%] left-[8%] font-display leading-none text-white/70" style={{ fontSize: '8cqw', letterSpacing: '0.06em' }}>
        {work.releaseYear ?? ''}
      </span>
    </div>
  );
}
