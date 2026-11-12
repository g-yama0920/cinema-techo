import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLibrary, useRepo } from '../../data/LibraryProvider';
import { nowISO } from '../../domain/dates';
import { STATUS_LABEL, WORK_TYPE_LABEL, WORK_TYPES } from '../../domain/labels';
import { splitList } from '../../domain/text';
import type { WatchStatus, WorkBundle, WorkType } from '../../domain/types';
import type { TmdbSearchResult } from '../../services/tmdb/client';
import { IconChevronLeft } from '../../ui/icons';
import { Poster } from '../../ui/Poster';
import { Button, ErrorState, Notice, PageHeader, SegmentedTabs } from '../../ui/primitives';
import { ConfirmSheet, Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { TmdbSearchPanel } from '../add/TmdbParts';
import { tmdb, useTmdb } from '../add/useTmdb';

export function WorkEditPage() {
  const { id } = useParams();
  const index = useLibrary();
  const bundle = id ? index.byId.get(id) : undefined;
  if (!bundle) return <div className="pt-10"><ErrorState title="作品が見つかりません" /></div>;
  return <EditForm bundle={bundle} key={bundle.work.id} />;
}

function EditForm({ bundle }: { bundle: WorkBundle }) {
  const { work, user } = bundle;
  const repo = useRepo();
  const toast = useToast();
  const navigate = useNavigate();
  const { available } = useTmdb();
  const [f, setF] = useState({
    title: work.title,
    alternateTitles: work.alternateTitles.join(', '),
    edition: work.edition ?? '',
    type: work.type as WorkType,
    releaseYear: work.releaseYear ? String(work.releaseYear) : '',
    genres: work.genres.join(', '),
    directors: work.directors.join(', '),
    cast: work.cast.join(', '),
    country: work.country.join(', '),
    runtime: work.runtime ? String(work.runtime) : '',
    seasonCount: work.seasonCount ? String(work.seasonCount) : '',
    episodeCount: work.episodeCount ? String(work.episodeCount) : '',
    synopsis: work.synopsis ?? '',
    posterPath: work.posterPath ?? '',
    reviewResolved: false,
  });
  const [status, setStatus] = useState<WatchStatus>(user.status);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkCandidate, setLinkCandidate] = useState<TmdbSearchResult | null>(null);
  const isSeries = f.type === 'drama' || f.type === 'anime';
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const num = (s: string) => (s && Number.isFinite(Number(s)) && Number(s) > 0 ? Math.round(Number(s)) : null);

  const save = async () => {
    if (!f.title.trim()) return toast.show('タイトルを入力してください', { tone: 'error' });
    try {
      await repo.updateWork(work.id, {
        title: f.title.trim(),
        alternateTitles: splitList(f.alternateTitles),
        edition: f.edition.trim() || null,
        type: f.type,
        releaseYear: num(f.releaseYear),
        genres: splitList(f.genres),
        directors: splitList(f.directors),
        cast: splitList(f.cast),
        country: splitList(f.country),
        runtime: num(f.runtime),
        seasonCount: num(f.seasonCount),
        episodeCount: num(f.episodeCount),
        synopsis: f.synopsis.trim() || null,
        posterPath: f.posterPath.trim() || null,
        needsReview: f.reviewResolved ? null : work.needsReview,
      });
      if (status !== user.status) await repo.setStatus(work.id, status);
      toast.show('保存しました');
      navigate(`/works/${work.id}`, { replace: true });
    } catch (e) {
      toast.error(e);
    }
  };

  const link = async (r: TmdbSearchResult) => {
    setLinkCandidate(null);
    setLinkOpen(false);
    try {
      const d = await tmdb.details(r.mediaType, r.tmdbId).catch(() => null);
      await repo.updateWork(work.id, {
        tmdbId: r.tmdbId,
        tmdbMediaType: r.mediaType,
        posterPath: work.posterPath ?? d?.posterPath ?? r.posterPath,
        synopsis: work.synopsis || d?.overview || r.overview || null,
        releaseYear: work.releaseYear ?? d?.year ?? r.year,
        genres: work.genres.length ? work.genres : (d?.genres ?? []),
        country: work.country.length ? work.country : (d?.countries ?? []),
        directors: work.directors.length ? work.directors : (d?.directors ?? []),
        cast: work.cast.length ? work.cast : (d?.cast ?? []),
        runtime: work.runtime ?? d?.runtime ?? null,
        seasonCount: work.seasonCount ?? d?.seasonCount ?? null,
        episodeCount: work.episodeCount ?? d?.episodeCount ?? null,
        watchProviders: d?.providers ?? work.watchProviders,
        watchProvidersFetchedAt: d ? nowISO() : work.watchProvidersFetchedAt,
      });
      toast.show('TMDb と紐付けました（空欄の項目を補完）');
      navigate(`/works/${work.id}`, { replace: true });
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <div>
      <div className="pt-[calc(var(--safe-t)+8px)] md:pt-6">
        <button type="button" onClick={() => navigate(-1)} className="-ml-2 flex min-h-11 items-center gap-0.5 pr-3 text-sm font-bold hover:text-red">
          <IconChevronLeft size={20} />
          キャンセル
        </button>
      </div>
      <PageHeader en="EDIT" ja="作品を編集" />
      <div className="mt-5 grid gap-5 md:grid-cols-[200px_1fr] md:gap-10">
        <div className="w-32 md:w-auto">
          <Poster work={{ ...work, title: f.title || work.title, type: f.type, posterPath: f.posterPath || null }} size="w342" />
        </div>
        <div className="space-y-5">
          {work.needsReview && (
            <Notice tone="warn">
              <p className="font-bold text-red">要確認：{work.needsReview}</p>
              <label className="mt-2 flex min-h-11 items-center gap-2 font-bold">
                <input type="checkbox" className="h-5 w-5 accent-[var(--color-ink)]" checked={f.reviewResolved} onChange={(e) => setF({ ...f, reviewResolved: e.target.checked })} />
                確認済みにする
              </label>
            </Notice>
          )}
          <Field id="e-title" label="タイトル" required value={f.title} onChange={set('title')} />
          <div>
            <p className="label">区分</p>
            <SegmentedTabs label="区分" value={f.type} onChange={(type) => setF({ ...f, type })} options={WORK_TYPES.map((t) => ({ value: t, label: t === 'other' ? 'その他' : WORK_TYPE_LABEL[t] }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field id="e-year" label="公開年" type="number" value={f.releaseYear} onChange={set('releaseYear')} />
            <div>
              <label className="label" htmlFor="e-status">
                視聴状況
              </label>
              <select id="e-status" className="field" value={status} onChange={(e) => setStatus(e.target.value as WatchStatus)}>
                {(Object.keys(STATUS_LABEL) as WatchStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {status !== user.status && user.rating != null && (status === 'want' || status === 'unwatched' || status === 'unconfirmed') && (
            <Notice tone="warn">この状態にすると現在の評価 ★{user.rating} は外れます（履歴には残ります）。</Notice>
          )}
          <Field id="e-edition" label="版・補足（同名作品の区別）" value={f.edition} onChange={set('edition')} placeholder="例: 中国ドラマ版" />
          <Field id="e-alt" label="別題（カンマ区切り）" value={f.alternateTitles} onChange={set('alternateTitles')} />
          <Field id="e-genres" label="ジャンル（カンマ区切り）" value={f.genres} onChange={set('genres')} />
          <Field id="e-directors" label="監督" value={f.directors} onChange={set('directors')} />
          <Field id="e-cast" label="出演者" value={f.cast} onChange={set('cast')} />
          <Field id="e-country" label="制作国" value={f.country} onChange={set('country')} />
          <div className={`grid gap-3 ${isSeries ? 'grid-cols-3' : 'grid-cols-1'}`}>
            <Field id="e-runtime" label={isSeries ? '1話の時間(分)' : '上映時間(分)'} type="number" value={f.runtime} onChange={set('runtime')} />
            {isSeries && (
              <>
                <Field id="e-seasons" label="シーズン数" type="number" value={f.seasonCount} onChange={set('seasonCount')} />
                <Field id="e-eps" label="話数" type="number" value={f.episodeCount} onChange={set('episodeCount')} />
              </>
            )}
          </div>
          <div>
            <label className="label" htmlFor="e-syn">
              あらすじ（ネタバレなし）
            </label>
            <textarea id="e-syn" rows={5} className="field" value={f.synopsis} onChange={set('synopsis')} />
          </div>
          <Field id="e-poster" label="ポスター画像（TMDb のパス または URL）" value={f.posterPath} onChange={set('posterPath')} placeholder="/abc123.jpg" />

          <div className="border-t border-line pt-4">
            <p className="label">TMDb との紐付け</p>
            {work.tmdbId ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {work.tmdbMediaType === 'movie' ? '映画' : 'TV'} ID {work.tmdbId}
                </span>
                <Button size="sm" variant="danger" onClick={() => repo.updateWork(work.id, { tmdbId: null, tmdbMediaType: null }).then(() => toast.show('紐付けを解除しました'))}>
                  解除
                </Button>
              </div>
            ) : available ? (
              <Button size="sm" onClick={() => setLinkOpen(true)}>
                TMDb で探して紐付ける
              </Button>
            ) : (
              <p className="text-sm text-ink-soft">TMDb 検索は未設定です（設定画面から有効にできます）。</p>
            )}
            {work.needsReview && <p className="mt-2 text-xs text-ink-soft">要確認の作品は自動では紐付けません。版を確かめてから選んでください。</p>}
          </div>

          <div className="sticky bottom-[calc(var(--nav-h)+var(--safe-b)+8px)] z-10 md:bottom-4">
            <Button variant="ink" size="lg" block onClick={save}>
              保存する
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={linkOpen} onClose={() => setLinkOpen(false)} kicker="TMDb と紐付け" title={work.title} wide>
        <TmdbSearchPanel initialQuery={work.title} onPick={setLinkCandidate} />
      </Sheet>
      <ConfirmSheet
        open={!!linkCandidate}
        title="この作品と紐付けますか？"
        confirmLabel="紐付ける"
        onClose={() => setLinkCandidate(null)}
        onConfirm={() => linkCandidate && link(linkCandidate)}
      >
        {linkCandidate && (
          <p>
            「{linkCandidate.title}」（{linkCandidate.year ?? '年不明'}・{linkCandidate.mediaType === 'movie' ? '映画' : 'TV'}）と紐付けます。
            <br />
            タイトル・評価・視聴記録は変わりません。空欄の項目だけ TMDb の情報で補完します。
          </p>
        )}
      </ConfirmSheet>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
        {required && <span className="ml-1 text-red">*</span>}
      </label>
      <input id={id} type={type} inputMode={type === 'number' ? 'numeric' : undefined} className="field" value={value} onChange={onChange} required={required} placeholder={placeholder} />
    </div>
  );
}
