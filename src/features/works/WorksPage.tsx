import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useLibrary } from '../../data/LibraryProvider';
import { STATUS_LABEL } from '../../domain/labels';
import { queryWorks, SORT_LABEL, statusCounts, type SortKey, type StatusFilter, type WorksQuery } from '../../domain/selectors';
import { IconClose, IconGrid, IconPlus, IconRows, IconSearch } from '../../ui/icons';
import { EmptyState, PageHeader, SegmentedTabs } from '../../ui/primitives';
import { WorkCard, WorkRow } from '../../ui/WorkCard';

const STORAGE_KEY = 'works-query';
const STATUS_ORDER: StatusFilter[] = ['want', 'watching', 'watched', 'pending', 'unwatched'];
const SORTS = Object.keys(SORT_LABEL) as SortKey[];

function readQuery(sp: URLSearchParams): WorksQuery & { view: 'grid' | 'list'; review: boolean } {
  const type = sp.get('type');
  const status = sp.get('status');
  const sort = sp.get('sort');
  return {
    type: (['movie', 'drama', 'anime', 'other'].includes(type ?? '') ? type : 'all') as WorksQuery['type'],
    status: ([...STATUS_ORDER, 'unconfirmed'].includes(status ?? '') ? status : 'all') as StatusFilter,
    sort: (SORTS.includes(sort as SortKey) ? sort : 'recent-added') as SortKey,
    q: sp.get('q') ?? '',
    review: sp.get('review') === '1',
    view: sp.get('view') === 'list' ? 'list' : 'grid',
  };
}

export function WorksPage() {
  const index = useLibrary();
  const [sp, setSp] = useSearchParams();
  const query = readQuery(sp);

  // 下部ナビから戻ったとき、前回の条件を復元
  useEffect(() => {
    if ([...sp.keys()].length) {
      try {
        sessionStorage.setItem(STORAGE_KEY, sp.toString());
      } catch {
        /* 保存できなくても動作に影響なし */
      }
      return;
    }
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setSp(new URLSearchParams(saved), { replace: true });
    } catch {
      /* noop */
    }
  }, [sp, setSp]);

  const update = (patch: Partial<Record<'type' | 'status' | 'sort' | 'q' | 'view' | 'review', string>>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (!v || (k === 'type' && v === 'all') || (k === 'status' && v === 'all')) next.delete(k);
      else next.set(k, v);
    }
    if (![...next.keys()].length) next.set('type', 'all');
    setSp(next, { replace: true });
  };

  const results = useMemo(() => queryWorks(index, query), [index, query.type, query.status, query.sort, query.q, query.review]); // eslint-disable-line react-hooks/exhaustive-deps
  const reviewCount = index.bundles.filter((b) => b.work.needsReview && (query.type === 'all' || b.work.type === query.type)).length;
  const counts = statusCounts(index, query.type);
  const hasOther = index.bundles.some((b) => b.work.type === 'other');
  // 依頼書の順（見たい・視聴中・視聴済み・評価保留・未視聴・すべて）。未確認がある場合だけ「すべて」の前に出す
  const statusOptions: StatusFilter[] = [...STATUS_ORDER, ...(counts.unconfirmed ? (['unconfirmed'] as StatusFilter[]) : []), 'all'];

  return (
    <div>
      <PageHeader
        en="WORKS"
        ja="作品一覧"
        right={
          <Link to="/add" className="flex min-h-11 items-center gap-1.5 border border-red bg-red px-3.5 text-sm font-bold text-paper hover:bg-red-deep">
            <IconPlus size={18} strokeWidth={2.4} />
            追加
          </Link>
        }
      />

      <div className="mt-4 space-y-3">
        <div className="relative">
          <label htmlFor="works-q" className="sr-only">
            作品を検索
          </label>
          <IconSearch size={20} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray" />
          <input
            id="works-q"
            type="search"
            enterKeyHint="search"
            className="field pr-11 pl-10"
            placeholder="タイトル・出演者・タグで絞り込み"
            value={query.q}
            onChange={(e) => update({ q: e.target.value })}
          />
          {query.q && (
            <button type="button" className="absolute top-0 right-0 grid h-12 w-11 place-items-center" aria-label="検索語を消す" onClick={() => update({ q: '' })}>
              <IconClose size={18} />
            </button>
          )}
        </div>

        <SegmentedTabs
          label="区分"
          value={query.type}
          onChange={(v) => update({ type: v })}
          options={[
            { value: 'all', label: 'すべて' },
            { value: 'movie', label: '映画' },
            { value: 'drama', label: 'ドラマ' },
            { value: 'anime', label: 'アニメ' },
            ...(hasOther ? [{ value: 'other' as const, label: 'その他' }] : []),
          ]}
        />

        <div
          role="radiogroup"
          aria-label="視聴状態"
          className={`grid border-t border-l border-ink bg-paper-light ${statusOptions.length > 6 ? 'grid-cols-4' : 'grid-cols-3'} md:grid-cols-7`}
        >
          {statusOptions.map((s) => {
            const active = query.status === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => update({ status: s })}
                className={`flex min-h-11 items-center justify-center gap-1 border-r border-b border-ink px-1 text-[13px] font-bold ${s === 'all' && statusOptions.length === 7 ? 'col-span-2 md:col-span-1' : ''} ${active ? 'bg-red text-paper' : 'hover:bg-paper-deep'}`}
              >
                {s === 'all' ? 'すべて' : STATUS_LABEL[s]}
                <span className={`num text-[10px] ${active ? 'text-paper/80' : 'text-gray'}`}>{counts[s]}</span>
              </button>
            );
          })}
        </div>

        {reviewCount > 0 && (
          <button
            type="button"
            role="switch"
            aria-checked={query.review}
            onClick={() => update({ review: query.review ? '' : '1' })}
            className={`flex min-h-11 w-full items-center justify-between border px-3 text-sm font-bold ${query.review ? 'border-red bg-red text-paper' : 'border-red bg-paper-light text-red'}`}
          >
            <span>確認待ちだけ表示（同名作品・原作との区別など）</span>
            <span className="num">{reviewCount}</span>
          </button>
        )}

        <div className="flex items-center gap-2 border-y border-ink py-1.5">
          <p className="mr-auto text-sm font-bold" aria-live="polite">
            <span className="num text-base">{results.length}</span> 件
          </p>
          <label htmlFor="works-sort" className="sr-only">
            並び替え
          </label>
          <select
            id="works-sort"
            value={query.sort}
            onChange={(e) => update({ sort: e.target.value })}
            className="min-h-11 max-w-[11.5rem] border border-ink bg-paper-light px-2 font-bold"
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABEL[s]}
              </option>
            ))}
          </select>
          <div role="radiogroup" aria-label="表示方法" className="flex border border-ink">
            <button
              type="button"
              role="radio"
              aria-checked={query.view === 'grid'}
              aria-label="ポスター表示"
              onClick={() => update({ view: 'grid' })}
              className={`grid h-11 w-11 place-items-center ${query.view === 'grid' ? 'bg-ink text-paper' : 'bg-paper-light'}`}
            >
              <IconGrid size={20} />
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={query.view === 'list'}
              aria-label="リスト表示"
              onClick={() => update({ view: 'list' })}
              className={`grid h-11 w-11 place-items-center border-l border-ink ${query.view === 'list' ? 'bg-ink text-paper' : 'bg-paper-light'}`}
            >
              <IconRows size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5">
        {results.length === 0 ? (
          <EmptyState
            title={index.bundles.length ? '条件に合う作品はありません' : 'まだ作品がありません'}
            action={
              index.bundles.length ? (
                <button type="button" className="min-h-11 border border-ink bg-paper-light px-4 font-bold" onClick={() => setSp(new URLSearchParams('type=all'), { replace: true })}>
                  条件をリセット
                </button>
              ) : (
                <Link to="/add" className="flex min-h-11 items-center border border-red bg-red px-4 font-bold text-paper">
                  作品を追加
                </Link>
              )
            }
          />
        ) : query.view === 'grid' ? (
          <ul className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5 md:gap-x-5 lg:grid-cols-6">
            {results.map((b) => (
              <li key={b.work.id} className="min-w-0">
                <WorkCard bundle={b} />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="border-t border-ink md:grid md:grid-cols-2 md:gap-x-8">
            {results.map((b) => (
              <li key={b.work.id} className="min-w-0">
                <WorkRow bundle={b} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

