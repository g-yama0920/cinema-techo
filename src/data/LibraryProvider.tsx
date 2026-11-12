import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { buildIndex, type LibraryIndex } from '../domain/library';
import type { LibrarySnapshot } from '../domain/types';
import type { LibraryRepository } from './repository';

type LibraryState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; index: LibraryIndex };

interface Ctx {
  state: LibraryState;
  repo: LibraryRepository;
}

const LibraryContext = createContext<Ctx | null>(null);

export function LibraryProvider({ repo, children }: { repo: LibraryRepository; children: ReactNode }) {
  const [snap, setSnap] = useState<LibrarySnapshot | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    return repo.subscribe(
      (s) => {
        setSnap(s);
        setError(null);
      },
      (e) => setError(e),
    );
  }, [repo]);

  const index = useMemo(() => (snap ? buildIndex(snap) : null), [snap]);
  const state: LibraryState = error
    ? { status: 'error', error }
    : index
      ? { status: 'ready', index }
      : { status: 'loading' };

  const value = useMemo(() => ({ state, repo }), [state, repo]);
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibraryState(): LibraryState {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('LibraryProvider がありません');
  return ctx.state;
}

/** ready のときだけ使う（AppShell が読み込み中・エラー表示を担当） */
export function useLibrary(): LibraryIndex {
  const s = useLibraryState();
  if (s.status !== 'ready') throw new Error('ライブラリが未読み込みです');
  return s.index;
}

export function useRepo(): LibraryRepository {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('LibraryProvider がありません');
  return ctx.repo;
}
