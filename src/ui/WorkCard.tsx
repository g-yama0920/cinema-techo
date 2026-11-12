import { Link } from 'react-router';
import { formatShortDate, precisionOf } from '../domain/dates';
import { WORK_TYPE_LABEL } from '../domain/labels';
import { activeWatchlistEntry, latestWatchDate } from '../domain/library';
import { padNo } from '../domain/text';
import type { WorkBundle } from '../domain/types';
import { Poster } from './Poster';
import { StarDisplay } from './Stars';
import { ReviewBadge, StatusBadge } from './primitives';

/** ポスターグリッド用カード */
export function WorkCard({ bundle, showStatus = true, caption }: { bundle: WorkBundle; showStatus?: boolean; caption?: string }) {
  const { work, user } = bundle;
  return (
    <Link to={`/works/${work.id}`} className="group block min-w-0" aria-label={cardLabel(bundle)}>
      <div className="transition-transform group-active:translate-x-[1px] group-active:translate-y-[1px]">
        <Poster work={work} size="w342" />
      </div>
      <div className="mt-2 min-w-0">
        <p className="line-clamp-2 text-[13px] leading-snug font-bold group-hover:text-red">
          {work.title}
          {work.edition && <span className="text-[11px] font-normal text-ink-soft">（{work.edition}）</span>}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {user.rating != null ? <StarDisplay rating={user.rating} size={12} /> : showStatus ? <StatusBadge status={user.status} /> : null}
          {showStatus && user.rating != null && user.status !== 'watched' && <StatusBadge status={user.status} />}
          {showStatus && work.needsReview && <ReviewBadge />}
        </div>
        {caption && <p className="mt-0.5 text-[11px] text-ink-soft">{caption}</p>}
      </div>
    </Link>
  );
}

/** タイトル付きリスト用の行 */
export function WorkRow({ bundle }: { bundle: WorkBundle }) {
  const { work, user } = bundle;
  const last = latestWatchDate(bundle);
  const wl = activeWatchlistEntry(bundle);
  return (
    <Link to={`/works/${work.id}`} className="group flex gap-3 border-b border-ink py-3 hover:bg-paper-light" aria-label={cardLabel(bundle)}>
      <div className="w-[64px] shrink-0">
        <Poster work={work} size="w154" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="num shrink-0 text-[11px] text-gray">No.{padNo(work.catalogNo)}</span>
          {work.needsReview && <span className="text-[11px] font-bold text-red">確認待ち</span>}
        </div>
        <p className="line-clamp-2 leading-snug font-bold group-hover:text-red">
          {work.title}
          {work.edition && <span className="text-xs font-normal text-ink-soft">（{work.edition}）</span>}
        </p>
        <p className="mt-0.5 text-xs text-ink-soft">
          {WORK_TYPE_LABEL[work.type]}
          {work.releaseYear ? ` ・ ${work.releaseYear}` : ''}
          {last ? ` ・ 視聴 ${formatShortDate(last, precisionOf(last))}` : ''}
          {wl ? ` ・ 見たい No.${wl.fixedNumber}` : ''}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <StatusBadge status={user.status} />
          {user.rating != null && <StarDisplay rating={user.rating} size={13} />}
        </div>
      </div>
    </Link>
  );
}

function cardLabel(b: WorkBundle): string {
  const r = b.user.rating != null ? `星${b.user.rating}` : b.user.status === 'pending' ? '評価保留' : '評価なし';
  return `${b.work.title}${b.work.edition ? `（${b.work.edition}）` : ''}、${WORK_TYPE_LABEL[b.work.type]}、${r}`;
}
