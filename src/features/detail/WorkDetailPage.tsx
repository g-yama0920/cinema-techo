import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLibrary, useRepo } from '../../data/LibraryProvider';
import { formatDateTime, formatPartialDate } from '../../domain/dates';
import { RATING_LABEL, STATUS_LABEL, WORK_TYPE_EN, WORK_TYPE_LABEL } from '../../domain/labels';
import { activeWatchlistEntry, displayTitle } from '../../domain/library';
import { padNo } from '../../domain/text';
import type { Rating, WatchEvent, WorkBundle } from '../../domain/types';
import {
  IconAlert,
  IconBookmarkPlus,
  IconCheck,
  IconChevronLeft,
  IconEdit,
  IconHourglass,
  IconPause,
  IconPlay,
  IconPlus,
  IconTrash,
} from '../../ui/icons';
import { Poster } from '../../ui/Poster';
import { Button, EmptyState, ErrorState, ReviewBadge, StatusBadge } from '../../ui/primitives';
import { ConfirmSheet } from '../../ui/Sheet';
import { StarInput } from '../../ui/Stars';
import { useToast } from '../../ui/Toast';
import { WatchedSheet } from '../../ui/WatchedSheet';
import { TmdbAttribution, TmdbRefresh } from '../add/TmdbParts';
import { EventSheet } from './EventSheet';
import { ReviewEditor, TagEditor } from './ReviewEditor';

export function WorkDetailPage() {
  const { id } = useParams();
  const index = useLibrary();
  const bundle = id ? index.byId.get(id) : undefined;
  const navigate = useNavigate();

  if (!bundle) {
    return (
      <div className="pt-10">
        <ErrorState title="作品が見つかりません" action={<Button onClick={() => navigate('/works')}>作品一覧へ</Button>}>
          削除されたか、別の端末のデータの可能性があります。
        </ErrorState>
      </div>
    );
  }
  return <Detail bundle={bundle} />;
}

function Detail({ bundle }: { bundle: WorkBundle }) {
  const { work, user } = bundle;
  const repo = useRepo();
  const toast = useToast();
  const navigate = useNavigate();
  const [watchedOpen, setWatchedOpen] = useState(false);
  const [eventEdit, setEventEdit] = useState<{ event: WatchEvent | null } | null>(null);
  const [confirm, setConfirm] = useState<null | 'delete' | 'pending' | { deleteEvent: WatchEvent }>(null);
  const wl = activeWatchlistEntry(bundle);
  const watchedLike = user.status === 'watched' || user.status === 'pending';
  const isSeries = work.type === 'drama' || work.type === 'anime';

  const run = async (fn: () => Promise<unknown>, msg?: string, undo?: () => Promise<unknown>) => {
    try {
      await fn();
      if (msg) toast.show(msg, undo ? { actionLabel: '元に戻す', onAction: () => undo().catch((e) => toast.error(e)) } : undefined);
    } catch (e) {
      toast.error(e);
    }
  };

  const rate = (r: Rating) => {
    const prev = user.rating;
    const prevStatus = user.status;
    if (r === prev) return;
    run(
      () => repo.setRating(work.id, r),
      `★${r}「${RATING_LABEL[r]}」に変更しました`,
      () => (prev == null ? (prevStatus === 'pending' ? repo.setPending(work.id) : repo.setRating(work.id, null)) : repo.setRating(work.id, prev)),
    );
  };

  const back = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/works');
  };

  return (
    <article className="pt-[calc(var(--safe-t)+8px)] md:pt-6">
      {/* 上部バー */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={back} className="-ml-2 flex min-h-11 items-center gap-0.5 pr-3 text-sm font-bold text-ink-soft hover:text-ink">
          <IconChevronLeft size={20} />
          戻る
        </button>
        <span className="num text-xs tracking-[0.14em] text-ink-soft">CATALOG No.{padNo(work.catalogNo)}</span>
        <Link to={`/works/${work.id}/edit`} className="-mr-2 flex min-h-11 items-center gap-1 pl-3 text-sm font-bold text-ink-soft hover:text-ink">
          <IconEdit size={18} />
          編集
        </Link>
      </div>
      

      <div className="mt-5 md:grid md:grid-cols-[260px_1fr] md:gap-10">
        {/* 左：ポスター（PC では固定） */}
        <div className="md:sticky md:top-24 md:self-start">
          <div className="grid grid-cols-[132px_1fr] gap-4 md:block">
            <Poster work={work} size="w500" shadow />
            <div className="min-w-0 md:hidden">
              <TitleBlock bundle={bundle} />
            </div>
          </div>
          <div className="hidden md:mt-5 md:block">
            <ActionGrid bundle={bundle} onWatched={() => setWatchedOpen(true)} onPending={() => setConfirm('pending')} run={run} />
          </div>
        </div>

        {/* 右：本文 */}
        <div className="min-w-0">
          <div className="hidden md:block">
            <TitleBlock bundle={bundle} />
          </div>

          {work.needsReview && (
            <div className="mt-5 rounded-md border-l-4 border-red bg-paper-light px-3.5 py-3 text-sm" role="note">
              <p className="flex items-center gap-2 font-bold text-red">
                <IconAlert size={18} />
                確認待ち
              </p>
              <p className="mt-1">{work.needsReview}</p>
              <p className="mt-1 text-xs text-ink-soft">作品の特定ができたら「編集」から内容を直し、「確認済みにする」を選んでください。</p>
            </div>
          )}

          {user.status === 'unconfirmed' && (
            <div className="mt-5 rounded-md bg-paper-light px-3.5 py-3 text-sm" role="note">
              <p className="font-bold">視聴状況が未確認です</p>
              <p className="mt-0.5 text-xs text-ink-soft">見たかどうかが分かったら選んでください。未確認のあいだは視聴済みに数えません。</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button size="sm" variant="ink" className="px-1 whitespace-nowrap" onClick={() => setWatchedOpen(true)}>
                  見た
                </Button>
                <Button size="sm" className="px-1 whitespace-nowrap" onClick={() => run(() => repo.setStatus(work.id, 'unwatched'), '未視聴にしました', () => repo.setStatus(work.id, 'unconfirmed'))}>
                  見ていない
                </Button>
                <Button size="sm" className="px-1 whitespace-nowrap" onClick={() => run(async () => repo.addToWatchlist(work.id), '見たいリストに追加しました')}>
                  見たい
                </Button>
              </div>
            </div>
          )}

          {/* 自分の評価 */}
          <section aria-labelledby="my-rating" className="mt-5 rounded-md bg-paper-light px-4 pt-3 pb-2">
            <div className="flex items-baseline justify-between">
              <h2 id="my-rating" className="kicker text-red">
                My Rating ・ 自分の評価
              </h2>
              <span className="text-xs font-bold">{STATUS_LABEL[user.status]}</span>
            </div>
            {watchedLike ? (
              <div className="mt-1">
                <StarInput value={user.rating} onChange={rate} size={36} label={`${work.title}の評価`} />
                {user.status === 'pending' && <p className="pb-1 text-xs text-ink-soft">評価保留中です。星をタップすると評価が確定します。</p>}
              </div>
            ) : user.status === 'unconfirmed' ? (
              <p className="py-3 text-sm text-ink-soft">視聴状況が分かったら、上の「見た」から評価できます。</p>
            ) : (
              <div className="py-3">
                <p className="text-sm text-ink-soft">
                  {user.status === 'unwatched' || user.status === 'want'
                    ? 'まだ見ていない作品です。'
                    : user.status === 'watching'
                      ? '視聴中です。見終わったら評価しましょう。'
                      : '見たかどうか未確認です。見た場合は評価できます。'}
                </p>
                <Button variant="primary" block className="mt-2" onClick={() => setWatchedOpen(true)}>
                  <IconCheck size={20} />
                  見た・評価する
                </Button>
              </div>
            )}
          </section>

          <div className="mt-4 md:hidden">
            <ActionGrid bundle={bundle} onWatched={() => setWatchedOpen(true)} onPending={() => setConfirm('pending')} run={run} />
          </div>

          {/* 作品データ */}
          <section className="mt-8" aria-labelledby="h-data">
            <h2 id="h-data" className="flex items-end gap-3">
              <span className="text-lg font-bold">作品データ</span>
              <span className="kicker text-gray">Data</span>
              <span className="mb-[5px] h-px flex-1 bg-line" />
            </h2>
            <dl className="mt-2 text-[14px]">
              <Row k="区分">{WORK_TYPE_LABEL[work.type]}</Row>
              <Row k="公開年">{work.releaseYear ?? <Unknown />}</Row>
              <Row k="ジャンル">{work.genres.length ? work.genres.join('、') : <Unknown />}</Row>
              <Row k="監督">{work.directors.length ? work.directors.join('、') : <Unknown />}</Row>
              <Row k="出演">{work.cast.length ? work.cast.slice(0, 8).join('、') : <Unknown />}</Row>
              <Row k="制作国">{work.country.length ? work.country.join('、') : <Unknown />}</Row>
              <Row k={isSeries ? '話数' : '上映時間'}>
                {isSeries ? (
                  work.episodeCount || work.seasonCount ? (
                    `${work.seasonCount ? `${work.seasonCount}シーズン ` : ''}${work.episodeCount ? `全${work.episodeCount}話` : ''}${work.runtime ? `（1話 約${work.runtime}分）` : ''}`
                  ) : (
                    <Unknown />
                  )
                ) : work.runtime ? (
                  `${work.runtime}分`
                ) : (
                  <Unknown />
                )}
              </Row>
              <Row k="配信">
                {work.watchProviders.length ? (
                  <span>
                    {work.watchProviders
                      .filter((p) => p.kind === 'flatrate' || p.kind === 'free' || p.kind === 'ads')
                      .map((p) => p.name)
                      .join('、') || 'レンタル・購入のみ'}
                    <span className="block text-[11px] text-ink-soft">配信情報: JustWatch（{formatDateTime(work.watchProvidersFetchedAt)} 時点）</span>
                  </span>
                ) : (
                  <Unknown label="取得できていません" />
                )}
              </Row>
              {work.sourceCategory && <Row k="元の分類">{work.sourceCategory}</Row>}
              {work.importNote && <Row k="データメモ">{work.importNote}</Row>}
              <Row k="管理番号">
                <span className="num">No.{padNo(work.catalogNo)}</span>
                {work.legacyId != null && <span className="ml-2 text-xs text-ink-soft">（既存記録の No.{work.legacyId}）</span>}
              </Row>
              {user.legacyWatchlistNumber != null && <Row k="元の見たい番号">No.{user.legacyWatchlistNumber}</Row>}
              <Row k="登録日">{formatDateTime(user.addedAt)}</Row>
            </dl>
            {work.tmdbId != null && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <TmdbAttribution compact />
                <TmdbRefresh work={work} />
              </div>
            )}
          </section>

          <section className="mt-8">
            <SubHeading ja="あらすじ" en="Story" note="ネタバレなし" />
            {work.synopsis ? <p className="mt-2 text-[15px] leading-[1.9]">{work.synopsis}</p> : <p className="mt-2 text-sm text-gray">あらすじは未登録です。</p>}
          </section>

          <section className="mt-8">
            <SubHeading ja="感想メモ" en="Notes" />
            <div className="mt-3">
              <ReviewEditor user={user} />
            </div>
          </section>

          <section className="mt-6">
            <SubHeading ja="タグ" en="Tags" />
            <div className="mt-3">
              <TagEditor user={user} />
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-end gap-3">
              <h2 className="text-lg font-bold">視聴記録</h2>
              <span className="kicker text-gray">History</span>
              <span className="mb-[5px] h-px flex-1 bg-line" />
              <button type="button" onClick={() => setEventEdit({ event: null })} className="-my-2 flex min-h-11 items-center gap-1 text-sm font-bold hover:text-red">
                <IconPlus size={16} />
                追加
              </button>
            </div>
            {bundle.events.length ? (
              <ul className="mt-2">
                {bundle.events.map((e, i) => (
                  <li key={e.id} className="flex items-center gap-3 border-b border-line py-2.5">
                    <span className="num w-6 shrink-0 text-xs text-red">{bundle.events.length - i}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{formatPartialDate(e.watchedOn, e.watchedOnPrecision)}</p>
                      <p className="text-xs text-ink-soft">
                        {[
                          e.platform,
                          e.location,
                          e.seasonNumber != null ? `S${e.seasonNumber}` : null,
                          e.episodeNumber != null ? `第${e.episodeNumber}話` : null,
                          e.watchedMinutes != null ? `${e.watchedMinutes}分` : null,
                          e.notes,
                        ]
                          .filter(Boolean)
                          .join(' ・ ') || '詳細なし'}
                      </p>
                    </div>
                    <button type="button" className="grid h-11 w-11 place-items-center hover:text-red" aria-label="この視聴記録を編集" onClick={() => setEventEdit({ event: e })}>
                      <IconEdit size={18} />
                    </button>
                    <button type="button" className="grid h-11 w-11 place-items-center hover:text-red" aria-label="この視聴記録を削除" onClick={() => setConfirm({ deleteEvent: e })}>
                      <IconTrash size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3">
                <EmptyState title="視聴記録はありません" />
              </div>
            )}
          </section>

          {(bundle.watchlist.length > 0 || bundle.ratingHistory.length > 0) && (
            <section className="mt-8">
              <SubHeading ja="履歴" en="Log" />
              <ul className="mt-2 text-sm">
                {bundle.watchlist.map((e) => (
                  <li key={e.id} className="flex justify-between gap-3 border-b border-line py-2">
                    <span>
                      見たいリスト <span className="num">No.{e.fixedNumber}</span>
                    </span>
                    <span className="text-ink-soft">
                      {formatDateTime(e.addedAt)} 登録
                      {e.status === 'watched' ? ` → ${formatDateTime(e.closedAt)} 視聴済み` : e.status === 'removed' ? ` → ${formatDateTime(e.closedAt)} 削除` : ''}
                    </span>
                  </li>
                ))}
                {bundle.ratingHistory.map((r) => (
                  <li key={r.id} className="flex justify-between gap-3 border-b border-line py-2">
                    <span>
                      評価 {r.from ? `★${r.from}` : 'なし'} → <span className="font-bold text-red">{r.to ? `★${r.to}` : 'なし'}</span>
                    </span>
                    <span className="text-ink-soft">
                      {r.source === 'seed' ? '既存記録から取り込み' : r.source === 'import' ? 'インポート' : formatDateTime(r.changedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-10 border-t border-line pt-5">
            <Button variant="danger" onClick={() => setConfirm('delete')}>
              <IconTrash size={18} />
              この作品を削除
            </Button>
          </div>
        </div>
      </div>

      <WatchedSheet bundle={bundle} open={watchedOpen} onClose={() => setWatchedOpen(false)} />
      <EventSheet work={work} event={eventEdit?.event ?? null} open={!!eventEdit} onClose={() => setEventEdit(null)} />
      <ConfirmSheet
        open={confirm === 'delete'}
        title="作品を削除しますか？"
        confirmLabel="削除する"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          setConfirm(null);
          await run(() => repo.deleteWork(work.id), `「${work.title}」を削除しました`);
          navigate('/works', { replace: true });
        }}
      >
        <p>
          「{displayTitle(work)}」と、その評価・視聴記録・感想を削除します。
          <br />
          管理番号 No.{work.catalogNo} は欠番になり、再利用されません。この操作は元に戻せません。
        </p>
      </ConfirmSheet>
      <ConfirmSheet
        open={confirm === 'pending'}
        title="評価保留にしますか？"
        confirmLabel="評価保留にする"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          const prev = user.rating;
          run(() => repo.setPending(work.id), '評価保留にしました', prev ? () => repo.setRating(work.id, prev) : undefined);
        }}
      >
        <p>現在の評価 {user.rating ? `★${user.rating}` : ''} を外して評価保留にします。外した評価は履歴に残ります。</p>
      </ConfirmSheet>
      <ConfirmSheet
        open={typeof confirm === 'object' && confirm !== null}
        title="視聴記録を削除しますか？"
        confirmLabel="削除する"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (typeof confirm === 'object' && confirm) run(() => repo.deleteWatchEvent(confirm.deleteEvent.id), '視聴記録を削除しました');
          setConfirm(null);
        }}
      >
        <p>
          {typeof confirm === 'object' && confirm ? formatPartialDate(confirm.deleteEvent.watchedOn, confirm.deleteEvent.watchedOnPrecision) : ''} の視聴記録を削除します。評価は変わりません。
        </p>
      </ConfirmSheet>
      {wl && <span className="sr-only">見たいリスト No.{wl.fixedNumber}</span>}
    </article>
  );
}

function TitleBlock({ bundle }: { bundle: WorkBundle }) {
  const { work, user } = bundle;
  const wl = activeWatchlistEntry(bundle);
  return (
    <div>
      <p className="kicker text-red">
        {WORK_TYPE_EN[work.type]}
        {work.releaseYear ? ` ・ ${work.releaseYear}` : ''}
      </p>
      <h1 className="mt-1 text-[24px] leading-[1.25] font-black text-balance md:text-4xl md:leading-tight">{work.title}</h1>
      {work.edition && <p className="mt-0.5 text-sm font-bold text-teal">{work.edition}</p>}
      {work.alternateTitles.length > 0 && <p className="mt-1 text-xs text-ink-soft">原文・別表記：{work.alternateTitles.join(' / ')}</p>}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <StatusBadge status={user.status} />
        {wl && <span className="inline-flex h-5 items-center rounded-sm bg-mustard px-1.5 text-[10.5px] font-bold text-black">見たい No.{wl.fixedNumber}</span>}
        {work.needsReview && <ReviewBadge />}
      </div>
    </div>
  );
}

function ActionGrid({
  bundle,
  onWatched,
  onPending,
  run,
}: {
  bundle: WorkBundle;
  onWatched: () => void;
  onPending: () => void;
  run: (fn: () => Promise<unknown>, msg?: string, undo?: () => Promise<unknown>) => Promise<void>;
}) {
  const repo = useRepo();
  const { work, user } = bundle;
  const wl = activeWatchlistEntry(bundle);
  const watchedLike = user.status === 'watched' || user.status === 'pending';
  const icon = 'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded text-[11.5px] font-bold text-ink-soft hover:text-ink disabled:text-gray-light';
  return (
    // 視聴済みの作品は「視聴開始」を出さない（再視聴は「また見た」で視聴記録を追加する）
    <div className="space-y-2">
      {/* 未確認の作品は上の「視聴状況が未確認です」の枠から選ぶので、ここには出さない */}
      {user.status !== 'unconfirmed' && (
        <button type="button" className="flex min-h-12 w-full items-center justify-center gap-2 rounded bg-ink text-[15px] font-bold text-paper hover:bg-ink/80" onClick={onWatched}>
          <IconCheck size={20} strokeWidth={2.6} />
          {watchedLike ? 'また見た（視聴記録を追加）' : '見た・評価する'}
        </button>
      )}
      <div className="flex">
        {wl ? (
          <button type="button" className={`${icon} text-mustard`} onClick={() => run(() => repo.removeFromWatchlist(wl.id), `見たいリストから外しました（No.${wl.fixedNumber} は欠番）`)}>
            <IconBookmarkPlus size={24} />
            見たい解除
          </button>
        ) : (
          <button type="button" className={icon} onClick={() => run(async () => repo.addToWatchlist(work.id), '見たいリストに追加しました')}>
            <IconBookmarkPlus size={24} />
            {watchedLike ? 'また見たい' : '見たいに追加'}
          </button>
        )}
        {watchedLike ? null : user.status === 'watching' ? (
          <button type="button" className={`${icon} text-teal`} onClick={() => run(() => repo.setStatus(work.id, wl ? 'want' : 'unwatched'), '視聴中を解除しました')}>
            <IconPause size={24} />
            視聴中
          </button>
        ) : (
          <button type="button" className={icon} onClick={() => run(() => repo.startWatching(work.id), '視聴中にしました')}>
            <IconPlay size={24} />
            視聴開始
          </button>
        )}
        <button type="button" className={icon} disabled={user.status === 'pending'} onClick={onPending}>
          <IconHourglass size={24} />
          {user.status === 'pending' ? '保留中' : '評価保留'}
        </button>
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3 border-b border-line py-2.5">
      <dt className="text-[13px] font-bold text-ink-soft">{k}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Unknown({ label = '未登録' }: { label?: string }) {
  return <span className="text-gray">{label}</span>;
}

function SubHeading({ ja, en, note }: { ja: string; en: string; note?: string }) {
  return (
    <h2 className="flex items-end gap-3">
      <span className="text-lg font-bold">{ja}</span>
      <span className="kicker text-gray">{en}</span>
      {note && <span className="text-[11px] font-bold text-teal">{note}</span>}
      <span className="mb-[5px] h-px flex-1 bg-line" />
    </h2>
  );
}
