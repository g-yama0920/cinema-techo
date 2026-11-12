import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useLibrary, useRepo } from '../../data/LibraryProvider';
import { WORK_TYPE_LABEL, WORK_TYPES } from '../../domain/labels';
import { displayTitle, findDuplicateCandidates } from '../../domain/library';
import { padNo, splitList } from '../../domain/text';
import type { Rating, WatchStatus, WorkType } from '../../domain/types';
import type { TmdbDetails, TmdbSearchResult } from '../../services/tmdb/client';
import { IconAlert, IconChevronLeft } from '../../ui/icons';
import { PartialDateInput, initialDateValue, resolveDate, type PartialDateValue } from '../../ui/PartialDateInput';
import { Poster } from '../../ui/Poster';
import { Button, Notice, PageHeader, SegmentedTabs } from '../../ui/primitives';
import { StarInput } from '../../ui/Stars';
import { useToast } from '../../ui/Toast';
import { TmdbSearchPanel } from './TmdbParts';
import { tmdb, useTmdb } from './useTmdb';

interface Draft {
  title: string;
  type: WorkType;
  releaseYear: string;
  edition: string;
  alternateTitles: string;
}

const EMPTY: Draft = { title: '', type: 'movie', releaseYear: '', edition: '', alternateTitles: '' };

/** 「作品を追加」を押し直したときは入力を初期化する */
export function AddWorkPage() {
  const location = useLocation();
  return <AddWork key={location.key} />;
}

function AddWork() {
  const { available } = useTmdb();
  const [sp] = useSearchParams();
  const [mode, setMode] = useState<'search' | 'manual'>(sp.get('mode') === 'manual' ? 'manual' : 'search');
  const [picked, setPicked] = useState<TmdbSearchResult | null>(null);
  const [details, setDetails] = useState<TmdbDetails | null>(null);
  const [draft, setDraft] = useState<Draft>({ ...EMPTY, title: sp.get('title') ?? '' });

  // TMDb が使えないときは手動登録へ
  useEffect(() => {
    if (available === false) setMode('manual');
  }, [available]);

  const pick = (r: TmdbSearchResult) => {
    setPicked(r);
    setDetails(null);
    setDraft({ title: r.title, type: r.suggestedType, releaseYear: r.year ? String(r.year) : '', edition: '', alternateTitles: r.originalTitle && r.originalTitle !== r.title ? r.originalTitle : '' });
    tmdb
      .details(r.mediaType, r.tmdbId)
      .then(setDetails)
      .catch(() => setDetails(null)); // 詳細が取れなくても登録は可能
    window.scrollTo({ top: 0 });
  };

  const step = picked || mode === 'manual' ? 2 : 1;

  return (
    <div>
      <PageHeader en="ADD" ja="作品を追加" sub={<Steps step={step} />} />
      {picked ? (
        <div className="mt-5">
          <button type="button" onClick={() => setPicked(null)} className="-ml-2 flex min-h-11 items-center gap-0.5 pr-3 text-sm font-bold hover:text-red">
            <IconChevronLeft size={18} />
            検索結果に戻る
          </button>
          <Confirm draft={draft} setDraft={setDraft} picked={picked} details={details} />
        </div>
      ) : mode === 'manual' ? (
        <div className="mt-5">
          {available === false && (
            <Notice>
              TMDb 検索は未設定のため使えません（
              <Link to="/settings" className="underline underline-offset-2">
                設定
              </Link>
              ）。タイトルを入力して手動で登録できます。
            </Notice>
          )}
          {available && (
            <button type="button" onClick={() => setMode('search')} className="-ml-2 flex min-h-11 items-center gap-0.5 pr-3 text-sm font-bold hover:text-red">
              <IconChevronLeft size={18} />
              TMDb で検索する
            </button>
          )}
          <Confirm draft={draft} setDraft={setDraft} picked={null} details={null} />
        </div>
      ) : (
        <div className="mt-5">
          {available === null ? (
            <p className="py-8 text-center text-sm font-bold">TMDb の接続を確認中…</p>
          ) : (
            <TmdbSearchPanel onPick={pick} autoFocus initialQuery={draft.title} />
          )}
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-sm text-ink-soft">TMDb に無い作品、映像化前の原作なども登録できます。</p>
            <Button className="mt-2" block onClick={() => setMode('manual')}>
              手動で登録する
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Steps({ step }: { step: number }) {
  const items = ['作品を探す', '内容を確認', '状態を選んで保存'];
  return (
    <ol className="grid grid-cols-3 border border-line text-center text-[11px] font-bold" aria-label="追加の手順">
      {items.map((t, i) => {
        const n = i + 1;
        const active = n === step || (step === 2 && n === 3);
        return (
          <li key={t} className={`border-l border-line px-1 py-1.5 first:border-l-0 ${active ? 'bg-ink text-paper' : n < step ? 'bg-paper-deep' : ''}`} aria-current={n === step ? 'step' : undefined}>
            <span className="num mr-1">{n}</span>
            {t}
          </li>
        );
      })}
    </ol>
  );
}

function Confirm({
  draft,
  setDraft,
  picked,
  details,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  picked: TmdbSearchResult | null;
  details: TmdbDetails | null;
}) {
  const index = useLibrary();
  const repo = useRepo();
  const toast = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useState<WatchStatus>('want');
  const [rating, setRating] = useState<Rating | null>(null);
  const [date, setDate] = useState<PartialDateValue>(initialDateValue());
  const [busy, setBusy] = useState(false);

  const dupes = useMemo(
    () =>
      draft.title.trim()
        ? findDuplicateCandidates(index.bundles, {
            title: draft.title,
            tmdbId: picked?.tmdbId,
            tmdbMediaType: picked?.mediaType,
            alternateTitles: splitList(draft.alternateTitles),
          })
        : [],
    [index.bundles, draft.title, draft.alternateTitles, picked],
  );
  const exact = dupes.find((d) => d.reason === 'tmdb');
  const canSave = draft.title.trim().length > 0 && !busy;

  const save = async () => {
    setBusy(true);
    try {
      const watched = status === 'watched';
      const year = Number(draft.releaseYear);
      const id = await repo.createWork({
        work: {
          title: draft.title.trim(),
          type: draft.type,
          releaseYear: Number.isInteger(year) && year > 1800 ? year : null,
          edition: draft.edition.trim() || null,
          alternateTitles: splitList(draft.alternateTitles),
          source: picked ? 'tmdb' : 'manual',
          tmdbId: picked?.tmdbId ?? null,
          tmdbMediaType: picked?.mediaType ?? null,
          posterPath: details?.posterPath ?? picked?.posterPath ?? null,
          synopsis: details?.overview || picked?.overview || null,
          genres: details?.genres ?? [],
          country: details?.countries ?? [],
          directors: details?.directors ?? [],
          cast: details?.cast ?? [],
          runtime: details?.runtime ?? null,
          seasonCount: details?.seasonCount ?? null,
          episodeCount: details?.episodeCount ?? null,
          watchProviders: details?.providers ?? [],
          watchProvidersFetchedAt: details ? new Date().toISOString() : null,
          needsReview: draft.type === 'other' ? '種別が「その他・要確認」です' : null,
        },
        status: watched ? (rating ? 'watched' : 'pending') : status,
        rating: watched ? rating : null,
        watch: watched ? resolveDate(date) : null,
      });
      toast.show(`「${draft.title}」を登録しました`);
      navigate(`/works/${id}`, { replace: true });
    } catch (e) {
      toast.error(e);
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-6">
      {/* 作品情報 */}
      <section className="grid grid-cols-[96px_1fr] gap-4">
        <Poster
          work={{
            title: draft.title || 'タイトル',
            type: draft.type,
            releaseYear: Number(draft.releaseYear) || null,
            posterPath: details?.posterPath ?? picked?.posterPath ?? null,
            catalogNo: index.snapshot.counters.nextCatalogNo,
          }}
          size="w185"
        />
        <div className="min-w-0 space-y-3">
          <div>
            <label className="label" htmlFor="add-title">
              タイトル<span className="ml-1 text-red">*</span>
            </label>
            <input id="add-title" className="field" required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus={!picked} />
          </div>
          <div>
            <label className="label" htmlFor="add-year">
              公開年
            </label>
            <input id="add-year" type="number" inputMode="numeric" min={1880} max={2100} className="field" value={draft.releaseYear} onChange={(e) => setDraft({ ...draft, releaseYear: e.target.value.slice(0, 4) })} />
          </div>
        </div>
      </section>

      <div>
        <p className="label">区分</p>
        <SegmentedTabs
          label="区分"
          value={draft.type}
          onChange={(type) => setDraft({ ...draft, type })}
          options={WORK_TYPES.map((t) => ({ value: t, label: t === 'other' ? 'その他' : WORK_TYPE_LABEL[t] }))}
        />
        {picked?.mediaType === 'tv' && <p className="mt-1.5 text-xs text-ink-soft">TMDb では TV 作品です。アニメの場合は「アニメ」を選んでください。</p>}
        {draft.type === 'other' && <p className="mt-1.5 text-xs text-ink-soft">漫画・小説など映像化前の作品や、種別が不明なものは「その他」（要確認）として登録します。</p>}
      </div>

      <details className="border-t border-line pt-2" open={!!draft.edition || !!draft.alternateTitles}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center font-bold">同名作品の区別・別題（任意）</summary>
        <div className="mt-2 grid gap-4">
          <div>
            <label className="label" htmlFor="add-edition">
              版・補足
            </label>
            <input id="add-edition" className="field" placeholder="例: 中国ドラマ版、2004年アニメ版" value={draft.edition} onChange={(e) => setDraft({ ...draft, edition: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="add-alt">
              別題（カンマ区切り）
            </label>
            <input id="add-alt" className="field" placeholder="例: 英題、原題" value={draft.alternateTitles} onChange={(e) => setDraft({ ...draft, alternateTitles: e.target.value })} />
          </div>
        </div>
      </details>

      {dupes.length > 0 && (
        <div className={`border px-3.5 py-3 text-sm ${exact ? 'border-red bg-paper-light' : 'border-line bg-paper-light'}`} role="alert">
          <p className="flex items-center gap-2 font-bold text-red">
            <IconAlert size={18} />
            {exact ? 'この作品は登録済みです' : '同じタイトルの作品があります'}
          </p>
          <ul className="mt-2 space-y-1">
            {dupes.map(({ bundle }) => (
              <li key={bundle.work.id}>
                <Link to={`/works/${bundle.work.id}`} className="underline underline-offset-2">
                  No.{padNo(bundle.work.catalogNo)} {displayTitle(bundle.work)}（{WORK_TYPE_LABEL[bundle.work.type]}
                  {bundle.work.releaseYear ? `・${bundle.work.releaseYear}` : ''}）
                </Link>
              </li>
            ))}
          </ul>
          {!exact && <p className="mt-2 text-xs">別の作品なら、そのまま登録できます（自動で統合はしません）。「版・補足」で区別すると便利です。</p>}
        </div>
      )}

      {/* 状態 */}
      <section className="border-t border-line pt-4">
        <p className="label">状態</p>
        <SegmentedTabs
          label="状態"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'want', label: '見たい' },
            { value: 'watching', label: '視聴中' },
            { value: 'watched', label: '見た' },
            { value: 'unwatched', label: '未視聴' },
          ]}
        />
        {status === 'watched' && (
          <div className="mt-5 space-y-5">
            <div>
              <p className="label">評価</p>
              <StarInput value={rating} onChange={setRating} />
              <p className="text-xs text-ink-soft">評価しない場合は「評価保留」として登録されます。</p>
            </div>
            <PartialDateInput value={date} onChange={setDate} />
          </div>
        )}
      </section>

      <div className="sticky bottom-[calc(var(--nav-h)+var(--safe-b)+8px)] z-10 md:bottom-4">
        <Button variant="primary" size="lg" block disabled={!canSave || !!exact} onClick={save}>
          {exact ? '登録済みです' : status === 'watched' ? (rating ? `★${rating} で登録する` : '評価保留で登録する') : '登録する'}
        </Button>
      </div>
    </div>
  );
}
