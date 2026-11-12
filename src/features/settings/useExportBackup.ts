import { useCallback } from 'react';
import { useLibrary, useRepo } from '../../data/LibraryProvider';
import { nowISO } from '../../domain/dates';
import { backupFileName, createBackup, downloadText } from '../../services/backup';
import { useToast } from '../../ui/Toast';

export function useExportBackup() {
  const index = useLibrary();
  const repo = useRepo();
  const toast = useToast();
  return useCallback(async () => {
    try {
      const backup = createBackup(index.snapshot);
      downloadText(backupFileName(), JSON.stringify(backup, null, 2), 'application/json');
      await repo.updateSettings({ lastBackupAt: nowISO() });
      toast.show(`バックアップを書き出しました（${backup.data.works.length}作品）`);
    } catch (e) {
      toast.error(e, 'バックアップに失敗しました');
    }
  }, [index.snapshot, repo, toast]);
}
