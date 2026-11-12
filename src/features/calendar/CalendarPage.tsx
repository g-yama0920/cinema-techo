import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useLibrary, useRepo } from '../../data/LibraryProvider';
import { calendarMonth, monthGrid, type CalendarItem } from '../../domain/calendar';
import { todayISO, WEEKDAYS_JA } from '../../domain/dates';
import { isWatchedStatus, WORK_TYPE_LABEL } from '../../domain/labels';
import { displayTitle } from '../../domain/library';
import { titleKey } from '../../domain/text';
import type { WorkBundle, WorkType } from '../../domain/types';
import { IconChevronLeft, IconChevronRight, IconSearch } from '../../ui/icons';
import { Poster } from '../../ui/Poster';
import { Button, EmptyState, PageHeader, SegmentedTabs, StatusBadge } from '../../ui/primitives';
import { Sheet } from '../../ui/Sheet';
import { StarDisplay } from '../../ui/Stars';
import { useToast } from '../../ui/Toast';
import { WatchedSheet } from '../../ui/WatchedSheet';

export function CalendarPage() {
  const index = useLibrary();
  const [sp, setSp] = useSearchParams();
  const now = new Date();
  const ym = /^(\d{4})-(\d{2})$/.exec(sp.get('m') ?? '');
  const year = ym ? Number(ym[1]) : now.getFullYear();
  const month = ym ? Number(ym[2]) : now.getMonth() + 1;
  const type = (['movie', 'drama', 'anime'].includes(sp.get('type') ?? '') ? sp.get('type') : 'all') as 'all' | WorkType;
  const [day, setDay] = useState<string | null>(null);

  const items = useMemo(() => calendarMonth(index, year, month, type), [index, year, month, type]);
  const cells = monthGrid(year, month, 0);
  const today = todayISO();
  const all = [...items.values()].flat();
  const watchedCount = new Set(all.filter((x) => x.kind === 'watched').map((x) => x.bundle.work.id)).size;
  const plannedCount = all.filter((x) => x.kind === 'planned').length;
  const undated = index.bundles.filter((b) => (type === 'all' || b.work.type === type) && isWatchedStatus(b.user.status) && !b.events.some((e) => e.watchedOnPrecision === 'day')).length;

  const go = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    const next = new URLSearchParams(sp);
    next.set('m', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setSp(next, { replace: true });
  };
  const setType = (t: 'all' | WorkType) => {
    const next = new URLSearchParams(sp);
    if (t === 'all') next.delete('type');
    else next.set('type', t);
    setSp(next, { replace: true });
  };
  const isThisMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div>
      <PageHeader en="CALENDAR" ja="カレンダー" />
      <div className="mt-4 flex items-center justify-between gap-2">
        <button type="button" onClick={() => go(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-paper-light hover:bg-paper-deep" aria-label="前の月">
          <IconChevronLeft />
        </button>
        <h2 className="text-center" aria-live="polite">
          <span className="num block text-[11px] tracking-[0.2em] text-red">{year}</span>
          <span className="text-2xl font-bold">{month}月</span>
        </h2>
        <button type="button" onClick={() => go(1)} className="grid h-11 w-11 place-items-center rounded-full bg-paper-light hover:bg-paper-deep" aria-label="次の月">
          <IconChevronRight />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <SegmentedTabs
            size="sm"
            label="区分"
            value={type}
            onChange={setType}
            options={[
              { value: 'all', label: 'すべて' },
              { value: 'movie', label: '映画' },
              { value: 'drama', label: 'ドラマ' },
              { value: 'anime', label: 'アニメ' },
            ]}
          />
        </div>
        {!isThisMonth && (
          <button type="button" onClick={() => go((now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month))} className="min-h-10 shrink-0 border border-line px-3 text-[13px] font-bold">
            今月
          </button>
        )}
      </div>

      <div className="mt-4 border-t border-l border-line bg-paper-light" role="group" aria-label={`${year}年${month}月`}>
        <div className="grid grid-cols-7" aria-hidden="true">
          {WEEKDAYS_JA.map((w, i) => (
            <div key={w} className={`border-r border-b border-line py-1 text-center text-[11px] font-bold ${i === 0 ? 'text-red' : i === 6 ? 'text-teal' : ''}`}>
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) =>
            d ? (
              <DayCell key={d} date={d} items={items.get(d) ?? []} isToday={d === today} weekday={i % 7} onOpen={() => setDay(d)} />
            ) : (
              <div key={`e${i}`} className="border-r border-b border-line bg-paper" aria-hidden="true" />
            ),
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span>
          この月の視聴 <span className="num text-sm">{watchedCount}</span> 本
        </span>
        <span>
          予定 <span className="num text-sm">{plannedCount}</span> 件
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 border border-dashed border-line bg-mustard" aria-hidden="true" />
          視聴予定
        </span>
      </div>
      {undated > 0 && (
        <p className="mt-2 text-xs text-ink-soft">
          日付が日単位で分からない視聴済み作品 {undated} 件はカレンダーに表示していません（
          <Link to="/works?status=watched" className="underline underline-offset-2">
            作品一覧
          </Link>
          で確認できます）。
        </p>
      )}

      {day && <DaySheet date={day} items={items.get(day) ?? []} onClose={() => setDay(null)} />}
    </div>
  );
}

function DayCell({ date, items, isToday, weekday, onOpen }: { date: string; items: CalendarItem[]; isToday: boolean; weekday: number; onOpen: () => void }) {
  const d = Number(date.slice(8));
  const first = items[0];
  const label = `${Number(date.slice(5, 7))}月${d}日${items.length ? `、${items.length}件：${items.map((x) => `${x.bundle.work.title}${x.kind === 'planned' ? '（予定）' : ''}`).join('、')}` : ''}`;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className={`relative flex min-h-[84px] flex-col border-r border-b border-line p-[3px] text-left hover:bg-paper-deep md:min-h-[150px] md:p-1.5 ${isToday ? 'bg-white/[0.06] ring-1 ring-red ring-inset' : ''}`}
    >
      <span
        className={`num text-[11px] leading-none md:text-sm ${isToday ? 'bg-red px-[3px] py-[2px] text-white' : weekday === 0 ? 'text-red' : weekday === 6 ? 'text-teal' : ''}`}
      >
        {d}
      </span>
      {first && (
        <span className="relative mt-[3px] block w-full">
          <span className={`block ${first.kind === 'planned' ? 'opacity-80 outline-2 -outline-offset-2 outline-mustard outline-dashed' : ''}`}>
            <Poster work={first.bundle.work} size="w92" />
          </span>
          {first.kind === 'planned' && <span className="absolute inset-x-0 bottom-0 bg-mustard text-center text-[9px] leading-[14px] font-bold text-black">予定</span>}
          {items.length > 1 && (
            <span className="num absolute -top-[2px] -right-[2px] min-w-[18px] border border-paper bg-ink px-[3px] text-center text-[10px] leading-[16px] text-paper">+{items.length - 1}</span>
          )}
        </span>
      )}
    </button>
  );
}

function DaySheet({ date, items, onClose }: { date: string; items: CalendarItem[]; onClose: () => void }) {
  const [mode, setMode] = useState<null | 'watched' | 'planned'>(null);
  const [picked, setPicked] = useState<WorkBundle | null>(null);
  const repo = useRepo();
  const toast = useToast();
  const [y, m, d] = date.split('-').map(Number);
  const wd = WEEKDAYS_JA[new Date(y, m - 1, d).getDay()];

  const plan = async (b: WorkBundle) => {
    try {
      const existing = b.watchlist.find((e) => e.status === 'active');
      if (existing) await repo.updateWatchlistEntry(existing.id, { plannedDate: date });
      else await repo.addToWatchlist(b.work.id, { plannedDate: date });
      toast.show(`${m}月${d}日に「${b.work.title}」の予定を入れました`);
      setMode(null);
    } catch (e) {
      toast.error(e);
    }
  };

  if (picked) return <WatchedSheet bundle={picked} open initialDate={date} onClose={() => setPicked(null)} onDone={() => setMode(null)} />;

  return (
    <Sheet open onClose={onClose} kicker={`${y}年`} title={`${m}月${d}日（${wd}）の記録`}>
      {mode ? (
        <WorkPicker
          mode={mode}
          onBack={() => setMode(null)}
          onPick={(b) => (mode === 'watched' ? setPicked(b) : plan(b))}
        />
      ) : (
        <div>
          {items.length ? (
            <ul className="border-t border-line">
              {items.map((x) => (
                <li key={x.kind === 'watched' ? x.event.id : x.entry.id}>
                  <Link to={`/works/${x.bundle.work.id}`} className="flex gap-3 border-b border-line py-2.5 hover:bg-paper-light">
                    <div className="w-12 shrink-0">
                      <Poster work={x.bundle.work} size="w92" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[11px] font-bold ${x.kind === 'planned' ? 'text-mustard' : 'text-red'}`}>
                        {x.kind === 'planned' ? `視聴予定（見たい No.${x.entry.fixedNumber}）` : '視聴'}
                      </p>
                      <p className="font-bold">{displayTitle(x.bundle.work)}</p>
                      <p className="text-xs text-ink-soft">
                        {WORK_TYPE_LABEL[x.bundle.work.type]}
                        {x.kind === 'watched' && x.event.platform ? ` ・ ${x.event.platform}` : ''}
                        {x.kind === 'watched' && x.event.episodeNumber != null ? ` ・ 第${x.event.episodeNumber}話` : ''}
                      </p>
                      <div className="mt-1">
                        {x.bundle.user.rating != null ? <StarDisplay rating={x.bundle.user.rating} size={13} /> : <StatusBadge status={x.bundle.user.status} />}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="この日の記録はありません" />
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="ink" onClick={() => setMode('watched')}>
              この日に見た
            </Button>
            <Button onClick={() => setMode('planned')}>視聴予定を入れる</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function WorkPicker({ mode, onPick, onBack }: { mode: 'watched' | 'planned'; onPick: (b: WorkBundle) => void; onBack: () => void }) {
  const index = useLibrary();
  const [q, setQ] = useState('');
  const key = titleKey(q);
  const base =
    mode === 'planned'
      ? [...index.activeWatchlist.map((x) => x.bundle), ...index.bundles.filter((b) => !b.watchlist.some((e) => e.status === 'active') && !isWatchedStatus(b.user.status))]
      : [...index.bundles.filter((b) => b.user.status === 'watching'), ...index.activeWatchlist.map((x) => x.bundle), ...index.bundles];
  const seen = new Set<string>();
  const list = base.filter((b) => {
    if (seen.has(b.work.id)) return false;
    seen.add(b.work.id);
    return !key || [b.work.title, ...b.work.alternateTitles].some((t) => titleKey(t).includes(key));
  });
  return (
    <div>
      <button type="button" onClick={onBack} className="-ml-2 flex min-h-11 items-center gap-0.5 pr-3 text-sm font-bold">
        <IconChevronLeft size={18} />
        戻る
      </button>
      <p className="mb-2 text-sm font-bold">{mode === 'watched' ? 'この日に見た作品を選んでください' : '予定を入れる作品を選んでください'}</p>
      <div className="relative">
        <IconSearch size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray" />
        <label htmlFor="pick-q" className="sr-only">
          作品を絞り込み
        </label>
        <input id="pick-q" type="search" className="field pl-9" placeholder="タイトルで絞り込み" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="mt-2 max-h-[50dvh] overflow-y-auto border-t border-line">
        {list.slice(0, 80).map((b) => (
          <li key={b.work.id}>
            <button type="button" onClick={() => onPick(b)} className="flex min-h-12 w-full items-center gap-3 border-b border-line py-2 text-left hover:bg-paper-light">
              <span className="min-w-0 flex-1 truncate font-bold">{displayTitle(b.work)}</span>
              <StatusBadge status={b.user.status} />
            </button>
          </li>
        ))}
        {!list.length && <li className="py-6 text-center text-sm text-ink-soft">該当する作品がありません</li>}
      </ul>
      <p className="mt-3 text-xs text-ink-soft">
        一覧に無い作品は
        <Link to="/add" className="underline underline-offset-2">
          作品を追加
        </Link>
        してから記録してください。
      </p>
    </div>
  );
}
