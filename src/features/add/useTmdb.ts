import { useEffect, useState } from 'react';
import { useLibrary } from '../../data/LibraryProvider';
import type { Settings } from '../../domain/types';
import { TmdbClient } from '../../services/tmdb/client';

let currentSettings: Pick<Settings, 'tmdbMode' | 'tmdbPersonalToken'> = { tmdbMode: 'proxy', tmdbPersonalToken: '' };

/** アプリ全体で共有する TMDb クライアント（設定は最新のものを参照） */
export const tmdb = new TmdbClient({ getSettings: () => currentSettings });

export function useTmdb(): { client: TmdbClient; available: boolean | null } {
  const { snapshot } = useLibrary();
  const { tmdbMode, tmdbPersonalToken } = snapshot.settings;
  currentSettings = { tmdbMode, tmdbPersonalToken };
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    setAvailable(null);
    tmdb.isAvailable().then((ok) => alive && setAvailable(ok));
    return () => {
      alive = false;
    };
  }, [tmdbMode, tmdbPersonalToken]);
  return { client: tmdb, available };
}
