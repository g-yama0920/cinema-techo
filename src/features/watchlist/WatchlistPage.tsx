import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useLibrary, useRepo } from '../../data/LibraryProvider';
import { formatDateTime, todayISO } from '../../domain/dates';
import { WORK_TYPE_LABEL } from '../../domain/labels';
import { displayTitle } from '../../domain/library';
import { splitList } from '../../domain/text';
import type { WatchlistEntry, WorkBundle } from '../../domain/types';
import { IconChevronDown, IconChevronUp, IconEdit, IconPlus } from '../../ui/icons';
import { Poster } from '../../ui/Poster';
import { Button, EmptyState, PageHeader, StatusBadge } from '../../ui/primitives';
import { ConfirmSheet, Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { PLATFORM_SUGGESTIONS, WatchedSheet } from '../../ui/WatchedSheet';

export function WatchlistPage() {
  const index = useLibrary();
  const repo = useRepo();
  const toast = useToast();
  const [watching, setWatching] = useState<WorkBundle | null>(null);
  const [editing, setEditing] = useState<{ entry: WatchlistEntry; bundle: WorkBundle } | null>(null);
  const [removing, setRemoving] = useState<{ entry: WatchlistEntry; bundle: WorkBundle } | null>(null);
  const list = index.activeWatchlist;

  const move = async (i: number, dir: -1 | 1 | 'top') => {
    const ids = list.map((x) => x.entry.id);
    const j = dir === 'top' ? 0 : i + dir;
    if (j < 0 || j >= ids.length || j === i) return;
    const [id] = ids.splice(i, 1);
    ids.splice(j, 0, id);
    try {
      await repo.reorderWatchlist(ids);
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <div>
      <PageHeader
        en="WATCHLIST"
        ja="見たいリスト"
        right={
          <Link to="/add" className="flex min-h-11 items-center gap-1.5 border border-red bg-red px-3.5 text-sm font-bold text-paper hover:bg-red-deep">
            <IconPlus size={18} strokeWidth={2.4} />
            追加
          </Link>
        }
        sub={
          <p className="text-sm">
            <span className="num text-base">{list.length}</span> 作品
            <span className="ml-3 text-ink-soft">次の番号 No.{index.snapshot.counters.nextWatchlistNo}・番号は削除しても再利用しません</span>
          </p>
        }
      />

      {list.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="見たい作品はまだありません" action={<Link to="/add" className="flex min-h-11 items-center border border-red bg-red px-4 font-bold text-paper">作品を追加</Link>}>
            作品詳細の「見たいに追加」からも登録できます。
          </EmptyState>
        </div>
      ) : (
        <ol className="mt-5 grid gap-x-8 border-t border-ink lg:grid-cols-2">
          {list.map(({ entry, bundle }, i) => (
            <li key={entry.id} className="border-b border-ink py-3">
              <div className="flex gap-3">
                <div className="flex w-12 shrink-0 flex-col items-center">
                  <span className="kicker text-[9px] text-gray">No.</span>
                  <span className="num text-[26px] leading-none text-red">{entry.fixedNumber}</span>
                  <span className="mt-1 text-[10px] font-bold text-ink-soft">{i + 1}番目</span>
                </div>
                <Link to={`/works/${bundle.work.id}`} className="w-16 shrink-0" aria-label={`${bundle.work.title}の詳細`}>
                  <Poster work={bundle.work} size="w154" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/works/${bundle.work.id}`} className="line-clamp-2 leading-snug font-bold hover:text-red">
                    {displayTitle(bundle.work)}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {WORK_TYPE_LABEL[bundle.work.type]}
                    {bundle.work.releaseYear ? ` ・ ${bundle.work.releaseYear}` : ''}
                  </p>
                  <dl className="mt-1 space-y-0.5 text-xs">
                    {entry.releaseDate && (
                      <div className="flex gap-1.5">
                        <dt className="font-bold">公開予定</dt>
                        <dd>{entry.releaseDate.replaceAll('-', '.')}{entry.releaseDate > todayISO() ? '' : '（公開済み）'}</dd>
                      </div>
                    )}
                    {entry.plannedDate && (
                      <div className="flex gap-1.5">
                        <dt className="font-bold">視聴予定</dt>
                        <dd>{entry.plannedDate.replaceAll('-', '.')}</dd>
                      </div>
                    )}
                    {entry.availableOn.length > 0 && (
                      <div className="flex gap-1.5">
                        <dt className="font-bold">見られる</dt>
                        <dd className="font-bold text-teal">{entry.availableOn.join(' / ')}</dd>
                      </div>
                    )}
                    {entry.note && <dd className="text-ink-soft">{entry.note}</dd>}
                  </dl>
                  {bundle.user.status === 'watching' && <StatusBadge status="watching" className="mt-1" />}
                </div>
                <div className="flex shrink-0 flex-col border border-ink">
                  <button type="button" className="grid h-11 w-11 place-items-center disabled:text-gray-light" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`${bundle.work.title}を1つ上へ`}>
                    <IconChevronUp size={20} />
                  </button>
                  <button type="button" className="grid h-11 w-11 place-items-center border-t border-ink disabled:text-gray-light" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={`${bundle.work.title}を1つ下へ`}>
                    <IconChevronDown size={20} />
                  </button>
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-[1fr_auto_auto] gap-2 pl-[3.75rem]">
                <button type="button" onClick={() => setWatching(bundle)} className="min-h-11 border border-ink bg-ink text-sm font-bold text-paper hover:bg-ink-soft">
                  見た・評価する
                </button>
                <button type="button" onClick={() => setEditing({ entry, bundle })} className="flex min-h-11 items-center gap-1 border border-ink bg-paper-light px-3 text-sm font-bold hover:bg-paper-deep">
                  <IconEdit size={16} />
                  予定
                </button>
                <button type="button" onClick={() => setRemoving({ entry, bundle })} className="min-h-11 border border-ink bg-paper-light px-3 text-sm font-bold hover:bg-paper-deep">
                  外す
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {index.closedWatchlist.length > 0 && (
        <details className="mt-8 border border-ink bg-paper-light">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-bold">
            番号の履歴（見終わった・外した作品）
            <span className="num text-sm text-gray">{index.closedWatchlist.length}</span>
          </summary>
          <ul className="border-t border-ink px-4">
            {index.closedWatchlist.map((e) => {
              const b = e.workId ? index.byId.get(e.workId) : undefined;
              return (
                <li key={e.id} className="flex items-center gap-3 border-b border-dashed border-gray py-2.5 text-sm last:border-0">
                  <span className="num w-12 shrink-0 text-gray">No.{e.fixedNumber}</span>
                  {b ? (
                    <Link to={`/works/${b.work.id}`} className="min-w-0 flex-1 truncate font-bold underline-offset-2 hover:underline">
                      {displayTitle(b.work)}
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-ink-soft">{e.titleSnapshot}（削除済み）</span>
                  )}
                  <span className="shrink-0 text-xs text-ink-soft">
                    {e.status === 'watched' ? '視聴済み' : '外した'} {formatDateTime(e.closedAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {watching && <WatchedSheet bundle={watching} open onClose={() => setWatching(null)} />}
      {editing && <EntrySheet entry={editing.entry} bundle={editing.bundle} onClose={() => setEditing(null)} />}
      <ConfirmSheet
        open={!!removing}
        title="見たいリストから外しますか？"
        confirmLabel="外す"
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          const r = removing;
          setRemoving(null);
          if (r) repo.removeFromWatchlist(r.entry.id).then(() => toast.show(`No.${r.entry.fixedNumber} を外しました`), (e) => toast.error(e));
        }}
      >
        {removing && (
          <p>
            「{removing.bundle.work.title}」を外します。番号 No.{removing.entry.fixedNumber} は欠番として履歴に残り、再利用されません。作品自体は削除されません。
          </p>
        )}
      </ConfirmSheet>
    </div>
  );
}

function EntrySheet({ entry, bundle, onClose }: { entry: WatchlistEntry; bundle: WorkBundle; onClose: () => void }) {
  const repo = useRepo();
  const toast = useToast();
  const [planned, setPlanned] = useState(entry.plannedDate ?? '');
  const [release, setRelease] = useState(entry.releaseDate ?? '');
  const [services, setServices] = useState(entry.availableOn.join(', '));
  const [note, setNote] = useState(entry.note);
  useEffect(() => {
    setPlanned(entry.plannedDate ?? '');
    setRelease(entry.releaseDate ?? '');
    setServices(entry.availableOn.join(', '));
    setNote(entry.note);
  }, [entry]);
  const providerNames = bundle.work.watchProviders.filter((p) => p.kind === 'flatrate' || p.kind === 'free' || p.kind === 'ads').map((p) => p.name);
  const add = (name: string) => setServices(splitList(`${services},${name}`).join(', '));

  const save = async () => {
    try {
      await repo.updateWatchlistEntry(entry.id, {
        plannedDate: planned || null,
        releaseDate: release || null,
        availableOn: splitList(services),
        note: note.trim(),
      });
      toast.show('保存しました');
      onClose();
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      kicker={`見たい No.${entry.fixedNumber}`}
      title={displayTitle(bundle.work)}
      footer={
        <Button variant="ink" size="lg" block onClick={save}>
          保存する
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="wl-plan">
              視聴予定日
            </label>
            <input id="wl-plan" type="date" className="field" value={planned} onChange={(e) => setPlanned(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="wl-rel">
              公開予定日
            </label>
            <input id="wl-rel" type="date" className="field" value={release} onChange={(e) => setRelease(e.target.value)} />
          </div>
        </div>
        <p className="-mt-2 text-xs text-ink-soft">視聴予定日はカレンダーに表示されます。</p>
        <div>
          <label className="label" htmlFor="wl-svc">
            見られるサービス（カンマ区切り）
          </label>
          <input id="wl-svc" className="field" value={services} onChange={(e) => setServices(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...new Set([...providerNames, ...PLATFORM_SUGGESTIONS])].slice(0, 12).map((p) => (
              <button key={p} type="button" onClick={() => add(p)} className="min-h-9 border border-ink bg-paper-light px-2 text-xs font-bold hover:bg-paper-deep">
                + {p}
              </button>
            ))}
          </div>
          {providerNames.length > 0 && <p className="mt-1 text-[11px] text-ink-soft">TMDb（JustWatch）の配信情報: {providerNames.join('、')}</p>}
        </div>
        <div>
          <label className="label" htmlFor="wl-note">
            メモ
          </label>
          <textarea id="wl-note" rows={2} className="field" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {(planned || release) && (
          <Button size="sm" variant="ghost" className="underline underline-offset-4" onClick={() => { setPlanned(''); setRelease(''); }}>
            日付をクリア
          </Button>
        )}
      </div>
    </Sheet>
  );
}
