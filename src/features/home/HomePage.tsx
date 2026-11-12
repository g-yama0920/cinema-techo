import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useLibrary, useRepo } from '../../data/LibraryProvider';
import { formatShortDate, precisionOf, WEEKDAYS_JA } from '../../domain/dates';
import { WORK_TYPE_LABEL } from '../../domain/labels';
import { activeWatchlistEntry, displayTitle } from '../../domain/library';
import { homeCounts, needsReviewWorks, pendingWorks, recentAdded, recentRated, recentWatched, recommendations, unconfirmedWorks } from '../../domain/selectors';
import { padNo } from '../../domain/text';
import type { Rating, WorkBundle } from '../../domain/types';
import { IconAlert, IconGear, IconPlus, IconSearch } from '../../ui/icons';
import { Poster } from '../../ui/Poster';
import { EmptyState, SectionHeader, StatusBadge } from '../../ui/primitives';
import { StarDisplay, StarInput } from '../../ui/Stars';
import { useToast } from '../../ui/Toast';
import { WatchedSheet } from '../../ui/WatchedSheet';
import { WorkCard } from '../../ui/WorkCard';
import { BackupReminder } from '../settings/BackupReminder';
import { Welcome } from './Welcome';

export function HomePage() {
  const index = useLibrary();
  const now = new Date();
  const counts = homeCounts(index, now);

  if (!index.bundles.length) return <Welcome />;

  const watched = recentWatched(index, 12);
  const rated = recentRated(index, 12);
  const recs = recommendations(index, now, 5);
  const pending = pendingWorks(index);
  const review = needsReviewWorks(index);
  const unconfirmed = unconfirmedWorks(index);
  const added = recentAdded(index, 12);

  return (
    <div>
      <Masthead now={now} total={index.bundles.length} />

      {/* 数字の帯 */}
      <section aria-label="記録の概要" className="mt-5 grid grid-cols-4 border border-ink bg-paper-light">
        <Stat label="今年見た" value={counts.thisYear} unit="本" />
        <Stat label="今月見た" value={counts.thisMonth} unit="本" />
        <Stat label="評価済み" value={counts.rated} unit="本" to="/works?status=watched&sort=rating-desc" />
        <Stat label="見たい" value={counts.want} unit="本" to="/watchlist" accent />
      </section>

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <Link
          to="/add"
          className="flex min-h-14 items-center justify-center gap-2 border border-red bg-red text-base font-bold text-paper shadow-[var(--shadow-print-sm)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
        >
          <IconPlus size={22} strokeWidth={2.4} />
          作品を追加
        </Link>
        <Link to="/works" aria-label="作品を探す" className="grid min-h-14 w-14 place-items-center border border-ink bg-paper-light hover:bg-paper-deep">
          <IconSearch />
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        <BackupReminder />
        {review.length > 0 && <ReviewNotice items={review} />}
        {unconfirmed.length > 0 && (
          <Link to="/works?type=all&status=unconfirmed&view=list" className="flex min-h-12 items-center gap-2 border border-dotted border-ink bg-paper-light px-3.5 text-sm font-bold hover:bg-paper-deep">
            視聴状況が未確認の作品 <span className="num text-base">{unconfirmed.length}</span> 件
            <span className="ml-auto text-xs underline underline-offset-4">仕分ける</span>
          </Link>
        )}
      </div>

      <div className="mt-8 grid gap-x-10 gap-y-10 lg:grid-cols-2">
        <section className="min-w-0 lg:col-span-2">
          <SectionHeader no="01" title="最近の視聴" en="Recently Watched" to="/calendar" linkLabel="カレンダー" />
          {watched.length ? (
            <div className="shelf -mx-4 px-4 md:mx-0 md:px-0">
              {watched.map(({ bundle, date }) => (
                <WorkCard key={bundle.work.id} bundle={bundle} showStatus={false} caption={formatShortDate(date, precisionOf(date))} />
              ))}
            </div>
          ) : (
            <EmptyState title="視聴日が分かる記録はまだありません">
              作品を「見た」で記録すると、ここに新しい順で並びます。日付不明の記録は「最近登録した」に表示されます。
            </EmptyState>
          )}
        </section>

        <section className="min-w-0">
          <SectionHeader no="02" title="最近評価した" en="Recently Rated" to="/works?sort=rating-desc&status=watched" />
          {rated.length ? (
            <ul className="border-t border-ink">
              {rated.slice(0, 5).map((b) => (
                <li key={b.work.id}>
                  <Link to={`/works/${b.work.id}`} className="flex items-center gap-3 border-b border-ink py-2.5 hover:bg-paper-light">
                    <div className="w-10 shrink-0">
                      <Poster work={b.work} size="w92" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold">{displayTitle(b.work)}</p>
                      <p className="text-xs text-ink-soft">{WORK_TYPE_LABEL[b.work.type]}</p>
                    </div>
                    <StarDisplay rating={b.user.rating} size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="このアプリで評価した作品はまだありません">
              初期データの評価は評価日時が不明のため、ここには表示しません。
            </EmptyState>
          )}
        </section>

        <section className="min-w-0">
          <SectionHeader no="03" title="見たいリストから" en="Next Pick" to="/watchlist" />
          {recs.length ? <Recommendations items={recs} /> : <EmptyState title="見たいリストは空です">作品詳細の「見たいに追加」で登録できます。</EmptyState>}
        </section>

        <section className="min-w-0">
          <SectionHeader no="04" title="評価保留" en="On Hold" to="/works?status=pending" />
          {pending.length ? (
            <PendingList items={pending} />
          ) : (
            <EmptyState title="評価保留の作品はありません" />
          )}
        </section>

        <section className="min-w-0">
          <SectionHeader no="05" title="最近登録した" en="Recently Added" to="/works?sort=recent-added" />
          <div className="shelf -mx-4 px-4 md:mx-0 md:px-0">
            {added.map((b) => (
              <WorkCard key={b.work.id} bundle={b} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Masthead({ now, total }: { now: Date; total: number }) {
  return (
    <header className="pt-[calc(var(--safe-t)+16px)] md:pt-8">
      <div className="flex items-center justify-between">
        <p className="kicker text-red">映画・ドラマ・アニメの記録帖</p>
        <Link to="/settings" aria-label="設定・バックアップ" className="-mr-2 grid h-11 w-11 place-items-center hover:text-red md:hidden">
          <IconGear />
        </Link>
      </div>
      <h1 className="font-display text-[46px] leading-none tracking-[0.03em] md:text-6xl">シネマ手帖</h1>
      <div className="rule-double mt-3" />
      <p className="mt-2.5 flex items-center justify-between text-[12px] font-bold">
        <span>
          {now.getFullYear()}年{now.getMonth() + 1}月{now.getDate()}日（{WEEKDAYS_JA[now.getDay()]}）
        </span>
        <span className="num tracking-[0.12em]">VOL.{padNo(total)}</span>
      </p>
    </header>
  );
}

function Stat({ label, value, unit, to, accent }: { label: string; value: number; unit: string; to?: string; accent?: boolean }) {
  const inner = (
    <>
      <span className={`num block text-[30px] leading-none md:text-4xl ${accent ? 'text-red' : ''}`}>{value}</span>
      <span className="mt-1.5 block text-[11px] font-bold">
        {label}
        <span className="sr-only">{unit}</span>
      </span>
    </>
  );
  const cls = 'flex flex-col items-center justify-center border-l border-ink px-1 py-3.5 text-center first:border-l-0';
  return to ? (
    <Link to={to} className={`${cls} hover:bg-paper-deep`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function ReviewNotice({ items }: { items: WorkBundle[] }) {
  return (
    <details className="border border-red bg-paper-light">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3.5 text-sm font-bold text-red">
        <IconAlert size={18} />
        確認待ちの作品が {items.length} 件あります
        <span className="ml-auto text-xs text-ink underline underline-offset-4">表示</span>
      </summary>
      <ul className="border-t border-red px-3.5 py-1">
        {items.map((b) => (
          <li key={b.work.id} className="border-b border-dashed border-gray last:border-0">
            <Link to={`/works/${b.work.id}`} className="block py-2.5">
              <span className="num mr-2 text-xs text-gray">No.{padNo(b.work.catalogNo)}</span>
              <span className="font-bold">{displayTitle(b.work)}</span>
              <span className="mt-0.5 block text-xs text-ink-soft">{b.work.needsReview}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Recommendations({ items }: { items: WorkBundle[] }) {
  const [watching, setWatching] = useState<WorkBundle | null>(null);
  const [first, ...rest] = items;
  const entry = activeWatchlistEntry(first);
  return (
    <div>
      <article className="grid grid-cols-[104px_1fr] gap-4 border border-ink bg-paper-light p-3 shadow-[var(--shadow-print)]">
        <Link to={`/works/${first.work.id}`} aria-label={`${first.work.title}の詳細`}>
          <Poster work={first.work} size="w185" />
        </Link>
        <div className="flex min-w-0 flex-col">
          <p className="kicker text-red">今日のおすすめ</p>
          <p className="num mt-1 text-xs">見たい No.{entry?.fixedNumber}</p>
          <Link to={`/works/${first.work.id}`} className="mt-0.5 line-clamp-2 text-lg leading-snug font-bold hover:text-red">
            {displayTitle(first.work)}
          </Link>
          <p className="mt-0.5 text-xs text-ink-soft">
            {WORK_TYPE_LABEL[first.work.type]}
            {first.work.releaseYear ? ` ・ ${first.work.releaseYear}` : ''}
            {entry?.plannedDate ? ` ・ 予定 ${entry.plannedDate.replaceAll('-', '.')}` : ''}
          </p>
          {entry && entry.availableOn.length > 0 && <p className="mt-1 text-xs font-bold text-teal">{entry.availableOn.join(' / ')}</p>}
          <div className="mt-auto pt-3">
            <button
              type="button"
              onClick={() => setWatching(first)}
              className="min-h-11 w-full border border-ink bg-ink px-3 text-sm font-bold text-paper hover:bg-ink-soft"
            >
              見た・評価する
            </button>
          </div>
        </div>
      </article>
      {rest.length > 0 && (
        <ol className="mt-4 border-t border-ink">
          {rest.map((b) => {
            const e = activeWatchlistEntry(b);
            return (
              <li key={b.work.id}>
                <Link to={`/works/${b.work.id}`} className="flex min-h-12 items-center gap-3 border-b border-ink py-2 hover:bg-paper-light">
                  <span className="num w-10 shrink-0 text-xs text-red">No.{e?.fixedNumber}</span>
                  <span className="min-w-0 flex-1 truncate font-bold">{displayTitle(b.work)}</span>
                  <StatusBadge status={b.user.status} />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      {watching && <WatchedSheet bundle={watching} open={!!watching} onClose={() => setWatching(null)} />}
    </div>
  );
}

function PendingList({ items }: { items: WorkBundle[] }) {
  const repo = useRepo();
  const toast = useToast();
  const navigate = useNavigate();
  const rate = async (b: WorkBundle, r: Rating) => {
    try {
      await repo.setRating(b.work.id, r);
      toast.show(`「${b.work.title}」を ★${r} にしました`, {
        actionLabel: '元に戻す',
        onAction: () => repo.setPending(b.work.id).catch((e) => toast.error(e)),
      });
    } catch (e) {
      toast.error(e);
    }
  };
  return (
    <ul className="border-t border-ink">
      {items.slice(0, 6).map((b) => (
        <li key={b.work.id} className="flex gap-3 border-b border-ink py-2.5">
          <button type="button" className="w-12 shrink-0" onClick={() => navigate(`/works/${b.work.id}`)} aria-label={`${b.work.title}の詳細`}>
            <Poster work={b.work} size="w92" />
          </button>
          <div className="min-w-0 flex-1">
            <Link to={`/works/${b.work.id}`} className="block truncate font-bold hover:text-red">
              {displayTitle(b.work)}
            </Link>
            <div className="-ml-2">
              <StarInput value={null} onChange={(r) => rate(b, r)} size={24} showLabel={false} label={`${b.work.title}の評価`} />
            </div>
          </div>
        </li>
      ))}
      {items.length > 6 && (
        <li className="py-2 text-right">
          <Link to="/works?status=pending" className="text-sm font-bold underline underline-offset-4">
            ほか {items.length - 6} 件
          </Link>
        </li>
      )}
    </ul>
  );
}
