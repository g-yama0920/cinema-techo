import { useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useLibrary } from '../../data/LibraryProvider';
import { RATING_LABEL, WORK_TYPE_LABEL } from '../../domain/labels';
import { computeStats, formatAverage, formatMinutes, type NamedCount, type StatsPeriod, type TypeFilter } from '../../domain/stats';
import type { Rating, WorkType } from '../../domain/types';
import { IconChevronLeft, IconChevronRight } from '../../ui/icons';
import { EmptyState, PageHeader, SegmentedTabs } from '../../ui/primitives';

const TYPE_COLOR: Record<WorkType, string> = {
  movie: 'var(--color-chart-movie)',
  drama: 'var(--color-chart-drama)',
  anime: 'var(--color-chart-anime)',
  other: 'var(--color-chart-other)',
};
/** 区分の枠の中に置く文字色（塗りの明るさで決める） */
const TYPE_ON: Record<WorkType, string> = { movie: '#fff', drama: '#fff', anime: '#1d1d1b', other: '#1d1d1b' };

export function StatsPage() {
  const index = useLibrary();
  const [sp, setSp] = useSearchParams();
  const now = new Date();
  const kind = (['month', 'year', 'all'].includes(sp.get('p') ?? '') ? sp.get('p') : 'month') as StatsPeriod['kind'];
  const year = Number(sp.get('y')) || now.getFullYear();
  const month = Math.min(12, Math.max(1, Number(sp.get('mo')) || now.getMonth() + 1));
  const type = (['movie', 'drama', 'anime'].includes(sp.get('type') ?? '') ? sp.get('type') : 'all') as TypeFilter;
  const period: StatsPeriod = kind === 'all' ? { kind } : kind === 'year' ? { kind, year } : { kind, year, month };
  const stats = useMemo(() => computeStats(index, period, type), [index, kind, year, month, type]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) v == null ? next.delete(k) : next.set(k, v);
    setSp(next, { replace: true });
  };
  const shift = (delta: number) => {
    if (kind === 'year') return set({ y: String(year + delta) });
    const d = new Date(year, month - 1 + delta, 1);
    set({ y: String(d.getFullYear()), mo: String(d.getMonth() + 1) });
  };
  const periodLabel = kind === 'all' ? '全期間' : kind === 'year' ? `${year}年` : `${year}年${month}月`;

  return (
    <div>
      <PageHeader en="STATS" ja="統計" />

      {/* 絞り込みは1か所にまとめる */}
      <div className="mt-4 space-y-2.5">
        <SegmentedTabs
          label="期間"
          value={kind}
          onChange={(v) => set({ p: v === 'month' ? null : v })}
          options={[
            { value: 'month', label: '月別' },
            { value: 'year', label: '年別' },
            { value: 'all', label: '全期間' },
          ]}
        />
        <SegmentedTabs
          size="sm"
          label="区分"
          value={type}
          onChange={(v) => set({ type: v === 'all' ? null : v })}
          options={[
            { value: 'all', label: 'すべて' },
            { value: 'movie', label: '映画' },
            { value: 'drama', label: 'ドラマ' },
            { value: 'anime', label: 'アニメ' },
          ]}
        />
        {kind !== 'all' && (
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-paper-light" aria-label={kind === 'year' ? '前の年' : '前の月'}>
              <IconChevronLeft />
            </button>
            <p className="text-xl font-bold" aria-live="polite">
              {periodLabel}
            </p>
            <button type="button" onClick={() => shift(1)} className="grid h-11 w-11 place-items-center rounded-full bg-paper-light" aria-label={kind === 'year' ? '次の年' : '次の月'}>
              <IconChevronRight />
            </button>
          </div>
        )}
      </div>

      {/* 数字 */}
      <section aria-label={`${periodLabel}の概要`} className="mt-5 grid grid-cols-3 gap-2">
        <Tile label="視聴本数" value={`${stats.watchedWorks}`} unit="本" note={stats.watchEvents > stats.watchedWorks ? `視聴 ${stats.watchEvents} 回` : undefined} />
        <Tile label="総視聴時間" value={stats.totalMinutes ? formatMinutes(stats.totalMinutes) : '—'} small note={stats.minutesUnknown ? `時間不明 ${stats.minutesUnknown} 回は除外` : undefined} />
        <Tile label="平均評価" value={formatAverage(stats.averageRating)} note={`評価 ${stats.ratedCount} 本`} />
      </section>
      {kind === 'all' && (
        <p className="mt-2 text-xs text-ink-soft">
          全期間は視聴日が不明な作品も含みます（評価保留 {stats.pendingCount} 本を含む／未視聴 {stats.unwatchedCount} 本・見たい {stats.wantCount} 本・視聴状況が未確認の {stats.unconfirmedCount} 本は含みません）。
        </p>
      )}
      {kind !== 'all' && stats.undatedWorks > 0 && (
        <p className="mt-2 text-xs text-ink-soft">視聴日が不明な {stats.undatedWorks} 本は月別・年別に含めていません（全期間には含みます）。</p>
      )}

      {stats.watchedWorks === 0 && kind !== 'all' ? (
        <div className="mt-6">
          <EmptyState title={`${periodLabel}の視聴記録はありません`}>日付付きで「見た」を記録すると集計されます。</EmptyState>
        </div>
      ) : (
        <div className="mt-8 grid gap-x-10 gap-y-9 lg:grid-cols-2">
          <Block title="評価の分布" en="Ratings">
            <RatingBars distribution={stats.distribution} />
          </Block>

          <Block title={stats.timelineUnit === 'month' ? `${kind === 'all' ? '' : year + '年 '}月別の視聴本数` : '年別の視聴本数'} en="Timeline">
            {stats.timeline.length ? (
              <Columns data={stats.timeline} highlight={kind === 'month' ? `${year}-${String(month).padStart(2, '0')}` : undefined} />
            ) : (
              <p className="text-sm text-ink-soft">日付付きの視聴記録がありません。</p>
            )}
          </Block>

          {type === 'all' && (
            <Block title="区分の構成比" en="Share">
              <Composition data={stats.typeShare} />
            </Block>
          )}

          <Block title="ジャンル" en="Genres">
            {stats.genres.length ? (
              <GenreTable genres={stats.genres} />
            ) : (
              <p className="text-sm text-ink-soft">ジャンルが登録された作品がありません。TMDb と紐付けると自動で入ります。</p>
            )}
            {stats.genreUnknown > 0 && <p className="mt-2 text-xs text-ink-soft">ジャンル未登録：{stats.genreUnknown} 本</p>}
          </Block>

          <Block title="よく見た制作国" en="Countries">
            <Ranked data={stats.countries} empty="制作国が登録された作品がありません。" />
            {stats.countryUnknown > 0 && <p className="mt-2 text-xs text-ink-soft">制作国未登録：{stats.countryUnknown} 本</p>}
          </Block>

          <Block title="よく利用する配信サービス" en="Platforms">
            <Ranked data={stats.platforms} unit="回" empty="視聴記録に配信サービスが入っていません。" />
          </Block>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, unit, note, small }: { label: string; value: string; unit?: string; note?: string; small?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-start rounded-md bg-paper-light px-1 py-3.5 text-center">
      <span className="text-[11px] font-bold">{label}</span>
      <span className={`num mt-1 leading-tight font-black ${small ? 'text-[19px]' : 'text-[34px]'}`}>
        {value}
        {unit && <span className="ml-0.5 font-sans text-xs font-bold">{unit}</span>}
      </span>
      {note && <span className="mt-1 text-[10px] leading-tight text-ink-soft">{note}</span>}
    </div>
  );
}

function Block({ title, en, children }: { title: string; en: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <p className="kicker text-red">{en}</p>
      <h2 className="mt-1 flex items-end gap-3">
        <span className="shrink-0 text-lg font-bold">{title}</span>
        <span className="mb-[5px] h-px flex-1 bg-line" />
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** 星1〜5 の横棒（1系列＝1色。値は棒の先に表示） */
function RatingBars({ distribution }: { distribution: number[] }) {
  const max = Math.max(1, ...distribution);
  const total = distribution.reduce((a, b) => a + b, 0);
  return (
    <div>
      <ul className="space-y-2" aria-label="評価の分布">
        {([5, 4, 3, 2, 1] as Rating[]).map((r) => {
          const n = distribution[r - 1];
          return (
            <li key={r} className="grid grid-cols-[5.5rem_1fr] items-center gap-2" aria-label={`星${r}（${RATING_LABEL[r]}）${n}本`}>
              <span className="text-[12px] leading-tight font-bold" aria-hidden="true">
                <span className="text-red">{'★'.repeat(r)}</span>
                <span className="block text-[10px] font-normal text-ink-soft">{RATING_LABEL[r]}</span>
              </span>
              <span className="flex items-center gap-2" aria-hidden="true">
                <span className="h-[18px] rounded-r-[4px] bg-[var(--color-chart-movie)]" style={{ width: `${(n / max) * 82}%`, minWidth: n ? 3 : 0 }} />
                <span className="text-[13px] font-bold tabular-nums">{n}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-right text-[11px] text-ink-soft">評価あり {total} 本（評価なし・評価保留は含みません）</p>
    </div>
  );
}

/** 縦棒（月別・年別）。値はタップ／フォーカスで表示、最大値だけ常時表示。表でも確認できる */
function Columns({ data, highlight }: { data: { label: string; key: string; count: number }[]; highlight?: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const top = niceMax(max);
  const ticks = [0, top / 2, top];
  const maxKey = data.reduce((a, b) => (b.count > a.count ? b : a), data[0]).key;
  return (
    <div>
      <div className="relative grid grid-cols-[1.5rem_1fr] gap-1.5">
        <div className="relative h-36" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2 text-[10px] tabular-nums text-ink-soft" style={{ bottom: `${(t / top) * 100}%` }}>
              {t}
            </span>
          ))}
        </div>
        <div className="relative h-36">
          {ticks.map((t) => (
            <span key={t} className="absolute inset-x-0 h-px bg-gray-light" style={{ bottom: `${(t / top) * 100}%` }} aria-hidden="true" />
          ))}
          <ul className="absolute inset-0 flex items-end justify-around gap-[2px]">
            {data.map((d) => (
              <li key={d.key} className="group relative flex h-full flex-1 items-end justify-center">
                <button type="button" className="flex h-full w-full items-end justify-center focus-visible:outline-offset-0" aria-label={`${d.label}：${d.count}本`}>
                  <span
                    className={`block w-full max-w-[24px] rounded-t-[4px] ${highlight && d.key !== highlight ? 'bg-[var(--color-chart-movie)]/45' : 'bg-[var(--color-chart-movie)]'}`}
                    style={{ height: `${(d.count / top) * 100}%`, minHeight: d.count ? 3 : 0 }}
                  />
                </button>
                {d.key === maxKey && d.count > 0 && (
                  <span className="pointer-events-none absolute text-[11px] font-bold tabular-nums group-focus-within:hidden group-hover:hidden" style={{ bottom: `calc(${(d.count / top) * 100}% + 2px)` }}>
                    {d.count}
                  </span>
                )}
                <span
                  className="pointer-events-none absolute z-10 hidden border border-line bg-ink px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-paper group-focus-within:block group-hover:block"
                  style={{ bottom: `calc(${(d.count / top) * 100}% + 4px)` }}
                >
                  {d.label} {d.count}本
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="ml-[1.875rem] flex justify-around gap-[2px] border-t border-line pt-1" aria-hidden="true">
        {data.map((d) => (
          <span key={d.key} className={`flex-1 text-center text-[10px] ${d.key === highlight ? 'font-bold text-red' : 'text-ink-soft'}`}>
            {d.label.replace('月', '')}
          </span>
        ))}
      </div>
      <details className="mt-2 text-xs">
        <summary className="inline-flex min-h-10 cursor-pointer items-center font-bold underline underline-offset-4">表で見る</summary>
        <table className="mt-1 w-full max-w-xs text-left">
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-b border-line">
                <th scope="row" className="py-1 font-normal">
                  {d.label}
                </th>
                <td className="py-1 text-right font-bold tabular-nums">{d.count} 本</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function niceMax(n: number): number {
  if (n <= 2) return 2;
  if (n <= 4) return 4;
  if (n <= 10) return Math.ceil(n / 2) * 2;
  const p = 10 ** Math.floor(Math.log10(n));
  return Math.ceil(n / p) * p;
}

/** 構成比：高さ28pxの区切り棒＋凡例 */
function Composition({ data }: { data: { type: WorkType; count: number }[] }) {
  const total = data.reduce((a, b) => a + b.count, 0);
  if (!total) return <p className="text-sm text-ink-soft">対象の作品がありません。</p>;
  const parts = data.filter((d) => d.count > 0);
  return (
    <div>
      <div className="flex h-7 gap-[2px]" role="img" aria-label={parts.map((p) => `${WORK_TYPE_LABEL[p.type]} ${p.count}本（${Math.round((p.count / total) * 100)}%）`).join('、')}>
        {parts.map((p) => {
          const share = p.count / total;
          return (
            <div key={p.type} className="flex items-center overflow-visible rounded-[4px] px-1.5" style={{ width: `${share * 100}%`, background: TYPE_COLOR[p.type] }}>
              {share >= 0.14 && (
                <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: TYPE_ON[p.type] }}>
                  {Math.round(share * 100)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-4">
        {data.map((d) => (
          <li key={d.type} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-[2px]" style={{ background: TYPE_COLOR[d.type] }} aria-hidden="true" />
            <span className="font-bold">{WORK_TYPE_LABEL[d.type]}</span>
            <span className="tabular-nums text-ink-soft">
              {d.count}本・{Math.round((d.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GenreTable({ genres }: { genres: { name: string; count: number; average: number | null; ratedCount: number }[] }) {
  const max = Math.max(1, ...genres.map((g) => g.count));
  const shown = genres.slice(0, 10);
  return (
    <div>
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-[11px] text-ink-soft">
            <th scope="col" className="py-1 font-bold">
              ジャンル
            </th>
            <th scope="col" className="py-1 font-bold">
              作品数
            </th>
            <th scope="col" className="py-1 text-right font-bold">
              平均評価
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((g) => (
            <tr key={g.name} className="border-b border-line">
              <th scope="row" className="max-w-[7rem] truncate py-1.5 pr-2 font-bold">
                {g.name}
              </th>
              <td className="w-full py-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 rounded-r-[4px] bg-[var(--color-chart-movie)]" style={{ width: `${(g.count / max) * 70}%`, minWidth: 3 }} aria-hidden="true" />
                  <span className="tabular-nums">{g.count}</span>
                </span>
              </td>
              <td className="py-1.5 pl-2 text-right whitespace-nowrap tabular-nums">
                {g.average != null ? (
                  <>
                    <span className="text-red">★</span>
                    {g.average.toFixed(2)}
                  </>
                ) : (
                  <span className="text-gray">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {genres.length > shown.length && <p className="mt-1 text-xs text-ink-soft">ほか {genres.length - shown.length} ジャンル</p>}
    </div>
  );
}

function Ranked({ data, unit = '本', empty }: { data: NamedCount[]; unit?: string; empty: string }) {
  if (!data.length) return <p className="text-sm text-ink-soft">{empty}</p>;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ol className="space-y-1.5">
      {data.slice(0, 6).map((d, i) => (
        <li key={d.name} className="grid grid-cols-[1.25rem_6.5rem_1fr] items-center gap-2 text-[13px]">
          <span className="num text-base text-red">{i + 1}</span>
          <span className="truncate font-bold">{d.name}</span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 rounded-r-[4px] bg-[var(--color-chart-movie)]" style={{ width: `${(d.count / max) * 75}%`, minWidth: 3 }} aria-hidden="true" />
            <span className="tabular-nums">
              {d.count}
              {unit}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
