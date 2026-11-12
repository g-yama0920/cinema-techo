import { useState } from 'react';
import { Link } from 'react-router';
import { useLibrary, useRepo } from '../../data/LibraryProvider';
import { formatShortDate, precisionOf } from '../../domain/dates';
import { WORK_TYPE_LABEL } from '../../domain/labels';
import { activeWatchlistEntry, displayTitle } from '../../domain/library';
import { homeCounts, needsReviewWorks, pendingWorks, recentAdded, recentRated, recentWatched, recommendations, unconfirmedWorks } from '../../domain/selectors';
import { padNo } from '../../domain/text';
import type { Rating, WorkBundle } from '../../domain/types';
import { IconAlert, IconCheck, IconChevronRight, IconGear, IconPlus, IconSearch } from '../../ui/icons';
import { Poster } from '../../ui/Poster';
import { EmptyState, SectionHeader } from '../../ui/primitives';
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

  const watched = recentWatched(index, 15);
  const rated = recentRated(index, 15);
  const recs = recommendations(index, now, 15);
  const pending = pendingWorks(index);
  const review = needsReviewWorks(index);
  const unconfirmed = unconfirmedWorks(index);
  const added = recentAdded(index, 15);
  const top = index.bundles
    .filter((b) => b.user.rating != null)
    .sort((a, b) => b.user.rating! - a.user.rating! || (b.user.ratedAt ?? '').localeCompare(a.user.ratedAt ?? '') || a.work.catalogNo - b.work.catalogNo)
    .slice(0, 10);

  const featured: { bundle: WorkBundle; label: string } | null = recs[0]
    ? { bundle: recs[0], label: `今日のおすすめ・見たいリスト No.${activeWatchlistEntry(recs[0])?.fixedNumber ?? ''}` }
    : watched[0]
      ? { bundle: watched[0].bundle, label: '最近見た作品' }
      : top[0]
        ? { bundle: top[0], label: '評価の高い作品' }
        : added[0]
          ? { bundle: added[0], label: '最近登録した作品' }
          : null;

  return (
    <div>
      <TopBar />

      <nav aria-label="区分" className="-mx-4 mt-1 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
        {[
          ['映画', '/works?type=movie'],
          ['ドラマ', '/works?type=drama'],
          ['アニメ', '/works?type=anime'],
          ['見たいリスト', '/watchlist'],
          ['カレンダー', '/calendar'],
        ].map(([label, to]) => (
          <Link key={to} to={to} className="flex min-h-9 shrink-0 items-center rounded-full border border-gray-light px-4 text-[13px] font-bold hover:border-ink-soft">
            {label}
          </Link>
        ))}
      </nav>

      {featured && <Hero bundle={featured.bundle} label={featured.label} />}

      {/* 数字 */}
      <section aria-label="記録の概要" className="mt-5 grid grid-cols-4 gap-2">
        <Stat label="今年見た" value={counts.thisYear} unit="本" />
        <Stat label="今月見た" value={counts.thisMonth} unit="本" />
        <Stat label="評価済み" value={counts.rated} unit="本" to="/works?status=watched&sort=rating-desc" />
        <Stat label="見たい" value={counts.want} unit="本" to="/watchlist" accent />
      </section>

      <div className="mt-4 space-y-2">
        <BackupReminder />
        {review.length > 0 && <ReviewNotice items={review} />}
        {unconfirmed.length > 0 && (
          <Link to="/works?type=all&status=unconfirmed&view=list" className="flex min-h-12 items-center gap-2 rounded-md bg-paper-light px-3.5 text-sm font-bold hover:bg-paper-deep">
            視聴状況が未確認の作品 <span className="num text-lg leading-none">{unconfirmed.length}</span> 件
            <span className="ml-auto flex items-center text-xs text-ink-soft">
              仕分ける
              <IconChevronRight size={14} />
            </span>
          </Link>
        )}
      </div>

      <div className="mt-7 space-y-8">
        <Row title="最近の視聴" to="/calendar" linkLabel="カレンダー">
          {watched.length ? (
            <div className="shelf -mx-4 px-4 md:mx-0 md:px-0">
              {watched.map(({ bundle, date }) => (
                <WorkCard key={bundle.work.id} bundle={bundle} showStatus={false} caption={formatShortDate(date, precisionOf(date))} />
              ))}
            </div>
          ) : (
            <EmptyState title="視聴日が分かる記録はまだありません">作品を「見た」で記録すると、ここに新しい順で並びます。日付不明の記録は「最近登録した」に表示されます。</EmptyState>
          )}
        </Row>

        <Row title="見たいリスト" to="/watchlist">
          {recs.length ? (
            <div className="shelf -mx-4 px-4 md:mx-0 md:px-0">
              {index.activeWatchlist.slice(0, 15).map(({ bundle, entry }) => (
                <WorkCard key={bundle.work.id} bundle={bundle} showStatus={false} caption={`No.${entry.fixedNumber}${entry.plannedDate ? `・予定 ${entry.plannedDate.slice(5).replace('-', '/')}` : ''}`} />
              ))}
            </div>
          ) : (
            <EmptyState title="見たいリストは空です">作品詳細の「見たいに追加」で登録できます。</EmptyState>
          )}
        </Row>

        {top.length > 0 && (
          <Row title="評価トップ10" to="/works?type=all&status=watched&sort=rating-desc">
            <ol className="shelf -mx-4 px-4 [grid-auto-columns:150px] md:mx-0 md:px-0 md:[grid-auto-columns:200px]">
              {top.map((b, i) => (
                <li key={b.work.id} className="min-w-0">
                  <Link to={`/works/${b.work.id}`} className="group relative flex items-end" aria-label={`${i + 1}位 ${b.work.title} 星${b.user.rating}`}>
                    <span
                      className="num -mr-3 shrink-0 text-[92px] leading-[0.8] text-paper md:text-[120px]"
                      style={{ WebkitTextStroke: '2px #595959' }}
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <span className="lift relative w-[86px] shrink-0 md:w-[112px]">
                      <Poster work={b.work} size="w185" decorative />
                    </span>
                  </Link>
                  <div className="mt-1.5 pl-6">
                    <StarDisplay rating={b.user.rating} size={11} />
                  </div>
                </li>
              ))}
            </ol>
          </Row>
        )}

        <Row title="評価保留" to="/works?status=pending">
          {pending.length ? <PendingList items={pending} /> : <EmptyState title="評価保留の作品はありません" />}
        </Row>

        <Row title="最近評価した" to="/works?sort=rating-desc&status=watched">
          {rated.length ? (
            <div className="shelf -mx-4 px-4 md:mx-0 md:px-0">
              {rated.map((b) => (
                <WorkCard key={b.work.id} bundle={b} showStatus={false} />
              ))}
            </div>
          ) : (
            <EmptyState title="このアプリで評価した作品はまだありません">初期データの評価は評価日時が不明のため、ここには表示しません。</EmptyState>
          )}
        </Row>

        <Row title="最近登録した" to="/works?sort=recent-added">
          <div className="shelf -mx-4 px-4 md:mx-0 md:px-0">
            {added.map((b) => (
              <WorkCard key={b.work.id} bundle={b} />
            ))}
          </div>
        </Row>
      </div>
    </div>
  );
}

function Row({ title, to, linkLabel, children }: { title: string; to?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <SectionHeader title={title} to={to} linkLabel={linkLabel} />
      {children}
    </section>
  );
}

function TopBar() {
  return (
    <header className="flex items-center justify-between pt-[calc(var(--safe-t)+10px)] pb-2 md:hidden">
      <span className="text-[26px] leading-none font-black tracking-tight text-red">シネマ手帖</span>
      <div className="-mr-2 flex items-center">
        <Link to="/add" className="mr-1 flex min-h-9 items-center gap-1 rounded bg-red px-3 text-[13px] font-bold text-white" aria-label="作品を追加">
          <IconPlus size={16} strokeWidth={2.6} />
          追加
        </Link>
        <Link to="/works" aria-label="作品を探す" className="grid h-11 w-11 place-items-center">
          <IconSearch />
        </Link>
        <Link to="/settings" aria-label="設定・バックアップ" className="grid h-11 w-11 place-items-center">
          <IconGear />
        </Link>
      </div>
    </header>
  );
}

/** 大きなおすすめ枠（ぼかしたポスターを背景に、手前にポスター・題名・操作） */
function Hero({ bundle, label }: { bundle: WorkBundle; label: string }) {
  const [open, setOpen] = useState(false);
  const { work } = bundle;
  const meta = [WORK_TYPE_LABEL[work.type], work.releaseYear, ...work.genres.slice(0, 2)].filter(Boolean);
  return (
    <section aria-label="おすすめ" className="relative mt-4 overflow-hidden rounded-lg bg-paper-light shadow-[var(--shadow-print)] md:mt-6">
      <div className="absolute inset-0 scale-125 opacity-60 blur-2xl" aria-hidden="true">
        <Poster work={work} size="w185" decorative className="h-full" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-paper via-paper/60 to-paper/10" aria-hidden="true" />
      <div className="relative flex flex-col items-center px-5 pt-6 pb-5 md:flex-row md:items-end md:gap-8 md:p-8">
        <Link to={`/works/${work.id}`} className="w-[58%] max-w-[230px] md:w-[220px]" aria-label={`${work.title}の詳細`}>
          <Poster work={work} size="w500" shadow />
        </Link>
        <div className="mt-4 w-full text-center md:mt-0 md:text-left">
          <p className="text-[11px] font-bold tracking-wider text-red uppercase">{label}</p>
          <h2 className="mt-1 text-2xl leading-tight font-black text-balance md:text-4xl">{displayTitle(work)}</h2>
          <p className="mt-1.5 text-[13px] text-ink-soft">{meta.join(' ・ ')}</p>
          {work.synopsis && <p className="mx-auto mt-2 line-clamp-2 max-w-xl text-[13px] text-ink-soft md:mx-0">{work.synopsis}</p>}
          <div className="mt-4 grid grid-cols-2 gap-2 md:flex">
            <button type="button" onClick={() => setOpen(true)} className="flex min-h-11 items-center justify-center gap-1.5 rounded bg-ink px-5 text-[15px] font-bold text-paper hover:bg-ink/80">
              <IconCheck size={20} strokeWidth={2.6} />
              見た・評価
            </button>
            <Link to={`/works/${work.id}`} className="flex min-h-11 items-center justify-center gap-1.5 rounded bg-white/20 px-5 text-[15px] font-bold hover:bg-white/30">
              詳細
              <IconChevronRight size={18} />
            </Link>
          </div>
        </div>
      </div>
      {open && <WatchedSheet bundle={bundle} open onClose={() => setOpen(false)} />}
    </section>
  );
}

function Stat({ label, value, unit, to, accent }: { label: string; value: number; unit: string; to?: string; accent?: boolean }) {
  const inner = (
    <>
      <span className={`num block text-[32px] leading-none md:text-5xl ${accent ? 'text-red' : ''}`}>{value}</span>
      <span className="mt-1 block text-[11px] font-bold text-ink-soft">
        {label}
        <span className="sr-only">{unit}</span>
      </span>
    </>
  );
  const cls = 'flex flex-col items-center justify-center rounded-md bg-paper-light px-1 py-3 text-center';
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
    <details className="rounded-md border-l-4 border-red bg-paper-light">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3.5 text-sm font-bold">
        <IconAlert size={18} className="text-red" />
        確認待ちの作品が {items.length} 件あります
        <span className="ml-auto text-xs text-ink-soft">表示</span>
      </summary>
      <ul className="border-t border-line px-3.5 py-1">
        {items.map((b) => (
          <li key={b.work.id} className="border-b border-line last:border-0">
            <Link to={`/works/${b.work.id}`} className="block py-2.5">
              <span className="mr-2 text-xs text-gray">No.{padNo(b.work.catalogNo)}</span>
              <span className="font-bold">{displayTitle(b.work)}</span>
              <span className="mt-0.5 block text-xs text-ink-soft">{b.work.needsReview}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

function PendingList({ items }: { items: WorkBundle[] }) {
  const repo = useRepo();
  const toast = useToast();
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
    <ul className="space-y-2">
      {items.slice(0, 6).map((b) => (
        <li key={b.work.id} className="flex gap-3 rounded-md bg-paper-light p-2">
          <Link to={`/works/${b.work.id}`} className="w-12 shrink-0" aria-label={`${b.work.title}の詳細`}>
            <Poster work={b.work} size="w92" decorative />
          </Link>
          <div className="min-w-0 flex-1">
            <Link to={`/works/${b.work.id}`} className="block truncate pt-0.5 font-bold">
              {displayTitle(b.work)}
            </Link>
            <div className="-ml-2">
              <StarInput value={null} onChange={(r) => rate(b, r)} size={24} showLabel={false} label={`${b.work.title}の評価`} />
            </div>
          </div>
        </li>
      ))}
      {items.length > 6 && (
        <li className="text-right">
          <Link to="/works?status=pending" className="inline-flex min-h-10 items-center text-sm font-bold text-ink-soft">
            ほか {items.length - 6} 件
            <IconChevronRight size={14} />
          </Link>
        </li>
      )}
    </ul>
  );
}
