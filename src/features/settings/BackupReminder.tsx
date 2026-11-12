import { Link } from 'react-router';
import { useLibrary } from '../../data/LibraryProvider';
import { formatDateTime } from '../../domain/dates';
import { IconDownload } from '../../ui/icons';
import { useExportBackup } from './useExportBackup';

const DAYS = 14;

/** 一定期間バックアップしていなければ表示する */
export function BackupReminder() {
  const index = useLibrary();
  const exportBackup = useExportBackup();
  const last = index.snapshot.settings.lastBackupAt;
  const stale = !last || Date.now() - new Date(last).getTime() > DAYS * 86400000;
  if (!stale || !index.bundles.length) return null;
  return (
    <div className="flex items-center gap-3 border border-ink bg-mustard/35 px-3.5 py-3">
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold">{last ? `最後のバックアップ：${formatDateTime(last)}` : 'まだバックアップがありません'}</p>
        <p className="text-xs">
          ブラウザのデータを消すと記録も消えます。
          <Link to="/settings" className="underline underline-offset-2">
            詳しく
          </Link>
        </p>
      </div>
      <button type="button" onClick={exportBackup} className="flex min-h-11 shrink-0 items-center gap-1.5 border border-ink bg-ink px-3 text-sm font-bold text-paper">
        <IconDownload size={18} />
        保存
      </button>
    </div>
  );
}
