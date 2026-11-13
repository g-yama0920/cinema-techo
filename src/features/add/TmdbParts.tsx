import { useEffect, useRef, useState } from 'react';
import { useRepo } from '../../data/LibraryProvider';
import { WORK_TYPE_LABEL } from '../../domain/labels';
import { nowISO } from '../../domain/dates';
import type { TmdbMediaType, Work } from '../../domain/types';
import { TmdbError, type TmdbSearchResult } from '../../services/tmdb/client';
import { IconSearch } from '../../ui/icons';
import { Poster } from '../../ui/Poster';
import { Button, EmptyState, ErrorState, SegmentedTabs } from '../../ui/primitives';
import { useToast } from '../../ui/Toast';
import { tmdb, useTmdb } from './useTmdb';

/**
 * TMDb の出典表記。公式ロゴは public/brand/tmdb-logo.svg に置く
 * （https://www.themoviedb.org/about/logos-attribution から入手。無い場合は文字表記のみ）。
 */
export function TmdbAttribution({ compact = false }: { compact?: boolean }) {
  const [logo, setLogo] = useState(__HAS_TMDB_LOGO__);
  return (
    <div className={`flex items-center gap-2.5 text-[11px] leading-snug text-ink-soft ${compact ? '' : 'border-t border-line pt-3'}`}>
      {logo ? (
        <img src={`${import.meta.env.BASE_URL}brand/tmdb-logo.svg`} alt="TMDB" className="h-3 w-auto shrink-0" onError={() => setLogo(false)} />
      ) : (
        <span className="shrink-0 border border-ink-soft px-1 font-bold">TMDB</span>
      )}
      <span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
    </div>
  );
}

/** TMDb から作品情報・配信情報を再取得（空欄だけ埋める。タイトル・評価は変えない） */
export function TmdbRefresh({ work }: { work: Work }) {
  const repo = useRepo();
  const toast = useToast();
  const { available } = useTmdb();
  const [busy, setBusy] = useState(false);
  if (!available || work.tmdbId == null || !work.tmdbMediaType) return null;
  const refresh = async () => {
    setBusy(true);
    try {
      const d = await tmdb.details(work.tmdbMediaType!, work.tmdbId!);
      await repo.updateWork(work.id, {
        genres: work.genres.length ? work.genres : d.genres,
        synopsis: work.synopsis || d.overview || null,
        posterPath: work.posterPath ?? d.posterPath,
        country: work.country.length ? work.country : d.countries,
        directors: work.directors.length ? work.directors : d.directors,
        cast: work.cast.length ? work.cast : d.cast,
        runtime: work.runtime ?? d.runtime,
        seasonCount: work.seasonCount ?? d.seasonCount,
        episodeCount: work.episodeCount ?? d.episodeCount,
        releaseYear: work.releaseYear ?? d.year,
        watchProviders: d.providers,
        watchProvidersFetchedAt: nowISO(),
      });
      toast.show('TMDb から情報を更新しました');
    } catch (e) {
      toast.error(e, e instanceof TmdbError ? e.message : 'TMDb の取得に失敗しました');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" onClick={refresh} disabled={busy}>
      {busy ? '取得中…' : '情報・配信を更新'}
    </Button>
  );
}

type Kind = TmdbMediaType | 'multi';

/** TMDb 検索（日本語）。結果を選ぶと onPick。自動では紐付けない */
export function TmdbSearchPanel({ initialQuery = '', onPick, autoFocus }: { initialQuery?: string; onPick: (r: TmdbSearchResult) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState(initialQuery);
  const [kind, setKind] = useState<Kind>('multi');
  const [state, setState] = useState<
    { s: 'idle' } | { s: 'loading' } | { s: 'error'; message: string } | { s: 'done'; results: TmdbSearchResult[]; page: number; totalPages: number; query: string }
  >({ s: 'idle' });
  const seq = useRef(0);

  const run = async (query: string, k: Kind, page = 1) => {
    const term = query.trim();
    if (!term) return setState({ s: 'idle' });
    const my = ++seq.current;
    if (page === 1) setState({ s: 'loading' });
    try {
      const { results, totalPages } = await tmdb.search(term, k, page);
      if (my !== seq.current) return;
      setState((prev) => ({
        s: 'done',
        results: page > 1 && prev.s === 'done' ? [...prev.results, ...results] : results,
        page,
        totalPages,
        query: term,
      }));
    } catch (e) {
      if (my !== seq.current) return;
      setState({ s: 'error', message: e instanceof Error ? e.message : '検索に失敗しました' });
    }
  };

  useEffect(() => {
    const t = setTimeout(() => run(q, kind), 450);
    return () => clearTimeout(t);
  }, [q, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          run(q, kind);
        }}
      >
        <label htmlFor="tmdb-q" className="label">
          タイトルで検索（TMDb・日本語）
        </label>
        <div className="relative">
          <IconSearch size={20} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray" />
          <input
            id="tmdb-q"
            type="search"
            enterKeyHint="search"
            autoFocus={autoFocus}
            className="field pl-10"
            placeholder="例: 千と千尋の神隠し"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </form>
      <div className="mt-3">
        <SegmentedTabs
          label="検索対象"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'multi', label: 'すべて' },
            { value: 'movie', label: '映画' },
            { value: 'tv', label: 'TV作品' },
          ]}
        />
      </div>
      <div className="mt-4" aria-live="polite">
        {state.s === 'loading' && <p className="py-6 text-center text-sm font-bold">検索中…</p>}
        {state.s === 'error' && <ErrorState title="検索できませんでした">{state.message}</ErrorState>}
        {state.s === 'done' && state.results.length === 0 && (
          <EmptyState title={`「${state.query}」は見つかりませんでした`}>表記を変えて検索するか、下の「手動で登録」を使ってください。</EmptyState>
        )}
        {state.s === 'done' && state.results.length > 0 && (
          <>
            <ul className="border-t border-line">
              {state.results.map((r) => (
                <li key={`${r.mediaType}-${r.tmdbId}`}>
                  <button type="button" onClick={() => onPick(r)} className="flex w-full gap-3 border-b border-line py-2.5 text-left hover:bg-paper-light">
                    <div className="w-14 shrink-0">
                      <Poster work={{ title: r.title, type: r.suggestedType, releaseYear: r.year, posterPath: r.posterPath, catalogNo: 0 }} size="w154" decorative />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="leading-snug font-bold">{r.title}</p>
                      {r.originalTitle && r.originalTitle !== r.title && <p className="truncate text-xs text-ink-soft">{r.originalTitle}</p>}
                      <p className="mt-1 text-xs">
                        <span className="num">{r.year ?? '年不明'}</span>
                        <span className="mx-1.5 text-gray" aria-hidden="true">|</span>
                        {r.mediaType === 'movie' ? '映画' : 'TV'}
                        {r.isAnimation && ' ・ アニメーション'}
                        {r.originCountry.length > 0 && ` ・ ${r.originCountry.join('/')}`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-teal">登録時の区分：{WORK_TYPE_LABEL[r.suggestedType]}（変更できます）</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {state.page < state.totalPages && (
              <div className="mt-3 text-center">
                <Button size="sm" onClick={() => run(state.query, kind, state.page + 1)}>
                  さらに表示
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      <div className="mt-4">
        <TmdbAttribution />
      </div>
    </div>
  );
}
