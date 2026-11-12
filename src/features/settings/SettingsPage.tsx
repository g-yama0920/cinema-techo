import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { requestPersistentStorage } from '../../data';
import { useLibrary, useRepo } from '../../data/LibraryProvider';
import { formatDateTime } from '../../domain/dates';
import { parseBackup, previewImport, downloadText, type ImportPreview, type BackupFile } from '../../services/backup';
import { eventsToCsv, worksToCsv } from '../../services/csv';
import { IconChevronRight, IconDownload, IconUpload } from '../../ui/icons';
import { Button, ErrorState, Notice, PageHeader, SegmentedTabs } from '../../ui/primitives';
import { ConfirmSheet, Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { TmdbAttribution } from '../add/TmdbParts';
import { useTmdb } from '../add/useTmdb';
import { TmdbEnrichPanel } from './TmdbEnrichPanel';
import { useExportBackup } from './useExportBackup';

export function SettingsPage() {
  const index = useLibrary();
  const exportBackup = useExportBackup();
  const toast = useToast();
  const s = index.snapshot.settings;
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');

  return (
    <div>
      <PageHeader en="SETTINGS" ja="設定・データ管理" />
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <Section title="バックアップ" en="Backup">
          <Notice tone="warn">
            記録はこの端末のブラウザ内（IndexedDB）に保存されています。<strong>ブラウザのデータ削除・機種変更・Safari の「履歴とWebサイトデータを消去」で失われる</strong>
            ことがあります。定期的に JSON バックアップを保存し、iCloud Drive などに置いてください。
          </Notice>
          <p className="mt-3 text-sm">
            最後のバックアップ：<span className="font-bold">{formatDateTime(s.lastBackupAt)}</span>
            <span className="ml-2 text-ink-soft">（{index.bundles.length}作品）</span>
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button variant="ink" size="lg" onClick={exportBackup}>
              <IconDownload size={20} />
              JSON で書き出す
            </Button>
            <ImportButton />
          </div>
          <StorageInfo />
        </Section>

        <Section title="CSV 書き出し" en="CSV">
          <p className="text-sm">表計算ソフトで見るための書き出しです（復元には JSON を使ってください）。</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button
              onClick={() => {
                downloadText(`cinema-techo-works-${stamp}.csv`, worksToCsv(index), 'text/csv');
                toast.show('作品一覧の CSV を書き出しました');
              }}
            >
              作品一覧 CSV
            </Button>
            <Button
              onClick={() => {
                downloadText(`cinema-techo-watch-history-${stamp}.csv`, eventsToCsv(index), 'text/csv');
                toast.show('視聴記録の CSV を書き出しました');
              }}
            >
              視聴記録 CSV
            </Button>
          </div>
        </Section>

        <Section title="既存の記録" en="Seed Data">
          <Link to="/settings/seed" className="flex min-h-14 items-center justify-between border border-ink bg-paper-light px-4 font-bold hover:bg-paper-deep">
            <span>
              初期データ（movie_tracker_full_catalog.json）を取り込む
              <span className="block text-xs font-normal text-ink-soft">{s.seedImportedAt ? `取り込み済み（${formatDateTime(s.seedImportedAt)}）・再実行しても重複しません` : '未取り込み'}</span>
            </span>
            <IconChevronRight />
          </Link>
        </Section>

        <TmdbSettings />

        <Section title="このアプリについて" en="About">
          <dl className="text-sm">
            <div className="grid grid-cols-[7rem_1fr] border-b border-dashed border-gray py-2">
              <dt className="font-bold text-ink-soft">名前</dt>
              <dd>シネマ手帖（個人用）</dd>
            </div>
            <div className="grid grid-cols-[7rem_1fr] border-b border-dashed border-gray py-2">
              <dt className="font-bold text-ink-soft">バージョン</dt>
              <dd className="num">{__APP_VERSION__}</dd>
            </div>
            <div className="grid grid-cols-[7rem_1fr] border-b border-dashed border-gray py-2">
              <dt className="font-bold text-ink-soft">次の管理番号</dt>
              <dd className="num">No.{index.snapshot.counters.nextCatalogNo}（見たい No.{index.snapshot.counters.nextWatchlistNo}）</dd>
            </div>
          </dl>
          <div className="mt-4">
            <TmdbAttribution />
            <p className="mt-2 text-[11px] text-ink-soft">配信サービスの情報は JustWatch のデータ（TMDb 経由）です。</p>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, en, children }: { title: string; en: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <h2 className="mb-3 flex items-end gap-3">
        <span className="text-lg font-bold">{title}</span>
        <span className="kicker text-gray">{en}</span>
        <span className="mb-[5px] h-px flex-1 bg-ink" />
      </h2>
      {children}
    </section>
  );
}

function StorageInfo() {
  const [info, setInfo] = useState<{ persisted: boolean | null; usage?: number; quota?: number }>({ persisted: null });
  useEffect(() => {
    (async () => {
      try {
        const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
        const est = navigator.storage?.estimate ? await navigator.storage.estimate() : undefined;
        setInfo({ persisted, usage: est?.usage, quota: est?.quota });
      } catch {
        setInfo({ persisted: null });
      }
    })();
  }, []);
  const ask = async () => {
    const r = await requestPersistentStorage();
    setInfo((x) => ({ ...x, persisted: r }));
  };
  return (
    <div className="mt-4 border-t border-dashed border-gray pt-3 text-sm">
      <p>
        保存の保護：
        <span className="font-bold">{info.persisted === true ? '有効（自動削除されにくい状態）' : info.persisted === false ? '未設定' : '確認できません'}</span>
        {info.usage != null && <span className="ml-2 text-xs text-ink-soft">使用量 約{Math.max(1, Math.round(info.usage / 1024))}KB</span>}
      </p>
      {info.persisted === false && (
        <Button size="sm" className="mt-2" onClick={ask}>
          自動削除されにくくする
        </Button>
      )}
      <p className="mt-2 text-xs text-ink-soft">iPhone ではホーム画面に追加（PWA）して使うと、データが自動削除されにくくなります。</p>
    </div>
  );
}

function ImportButton() {
  const index = useLibrary();
  const repo = useRepo();
  const toast = useToast();
  const [state, setState] = useState<{ file: string; backup: BackupFile; preview: ImportPreview } | { error: string } | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [confirm, setConfirm] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) return setState({ error: parsed.error });
    setMode(index.bundles.length ? 'merge' : 'replace');
    setState({ file: file.name, backup: parsed.backup, preview: previewImport(parsed.backup, index.snapshot) });
  };

  const apply = async () => {
    if (!state || 'error' in state) return;
    setConfirm(false);
    try {
      const changes = mode === 'replace' ? state.preview.replace : state.preview.merge;
      await repo.applyChanges(changes, mode);
      toast.show(mode === 'replace' ? `バックアップで置き換えました（${state.preview.incoming.works}作品）` : `${state.preview.newWorks}作品を追加、${state.preview.sameId}作品を更新しました`);
      setState(null);
    } catch (e) {
      toast.error(e, 'インポートに失敗しました');
    }
  };

  const p = state && !('error' in state) ? state.preview : null;
  return (
    <>
      <label className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 border border-ink bg-paper-light px-5 font-bold hover:bg-paper-deep">
        <IconUpload size={20} />
        JSON から読み込む
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      <Sheet
        open={!!state}
        onClose={() => setState(null)}
        kicker="インポート前の確認"
        title={state && 'file' in state ? state.file : '読み込みエラー'}
        footer={
          p && (
            <Button variant={mode === 'replace' ? 'primary' : 'ink'} size="lg" block onClick={() => setConfirm(true)} disabled={mode === 'merge' && p.newWorks + p.sameId === 0}>
              {mode === 'replace' ? '現在のデータを置き換える' : `追加・更新する（${p.newWorks + p.sameId}作品）`}
            </Button>
          )
        }
      >
        {state && 'error' in state && <ErrorState title="読み込めません">{state.error}</ErrorState>}
        {p && state && 'backup' in state && (
          <div className="space-y-4 text-sm">
            <dl>
              <Info k="書き出し日時">{formatDateTime(state.backup.exportedAt)}</Info>
              <Info k="ファイルの内容">
                {p.incoming.works}作品（評価済み {p.incoming.rated}）・視聴記録 {p.incoming.events}件・見たい {p.incoming.watchlistActive}件
              </Info>
              <Info k="この端末">{p.current.works}作品</Info>
            </dl>
            <div>
              <p className="label">読み込み方法</p>
              <SegmentedTabs
                label="読み込み方法"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'merge', label: '追加・更新' },
                  { value: 'replace', label: 'すべて置き換え' },
                ]}
              />
            </div>
            {mode === 'merge' ? (
              <div className="space-y-2">
                <p>
                  新規 <strong>{p.newWorks}</strong> 作品を追加し、同じデータ（同じ ID）の <strong>{p.sameId}</strong> 作品をファイルの内容で更新します。
                </p>
                {p.conflicts.length > 0 && (
                  <Notice tone="warn">
                    <p className="font-bold">重複のため追加しない作品：{p.conflicts.length}件</p>
                    <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-xs">
                      {p.conflicts.map((c, i) => (
                        <li key={i}>
                          {c.title}：{c.reason}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-xs">別の端末で同じ初期データを取り込んでいた場合などに起こります。ファイルの内容に揃えたい場合は「すべて置き換え」を選んでください。</p>
                  </Notice>
                )}
              </div>
            ) : (
              <Notice tone="warn">
                この端末の {p.current.works} 作品をすべて削除し、ファイルの {p.incoming.works} 作品に置き換えます。<strong>元に戻せません。</strong>念のため先に現在のデータを書き出してください。
              </Notice>
            )}
          </div>
        )}
      </Sheet>
      <ConfirmSheet
        open={confirm}
        title={mode === 'replace' ? '本当に置き換えますか？' : 'インポートしますか？'}
        confirmLabel={mode === 'replace' ? '置き換える' : 'インポート'}
        danger={mode === 'replace'}
        onClose={() => setConfirm(false)}
        onConfirm={apply}
      >
        <p>{mode === 'replace' ? '現在のデータは削除されます。' : '既存のデータは残したまま追加・更新します。'}</p>
      </ConfirmSheet>
    </>
  );
}

function Info({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 border-b border-dashed border-gray py-1.5">
      <dt className="font-bold text-ink-soft">{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function TmdbSettings() {
  const index = useLibrary();
  const repo = useRepo();
  const toast = useToast();
  const { available } = useTmdb();
  const s = index.snapshot.settings;
  const [token, setToken] = useState(s.tmdbPersonalToken);
  return (
    <Section title="作品検索（TMDb）" en="Search API">
      <p className="text-sm">
        状態：
        <span className={`font-bold ${available ? 'text-teal' : 'text-red'}`}>{available == null ? '確認中…' : available ? '利用できます' : '利用できません'}</span>
      </p>
      <p className="mt-1 text-xs text-ink-soft">TMDb が使えなくても、作品の登録・評価・閲覧はすべて利用できます。</p>
      <div className="mt-3">
        <SegmentedTabs
          label="接続方法"
          value={s.tmdbMode}
          onChange={(m) => repo.updateSettings({ tmdbMode: m }).catch((e) => toast.error(e))}
          options={[
            { value: 'proxy', label: 'サーバー経由' },
            { value: 'personal', label: '個人トークン' },
            { value: 'off', label: 'オフ' },
          ]}
        />
      </div>
      {s.tmdbMode === 'proxy' && (
        <p className="mt-3 text-sm">
          公開先のサーバーレス関数（/api/tmdb）経由で検索します。API キーはサーバーの環境変数 <code className="font-bold">TMDB_READ_ACCESS_TOKEN</code> に設定し、ブラウザには渡しません。
        </p>
      )}
      {s.tmdbMode === 'personal' && (
        <div className="mt-3 space-y-2">
          <Notice>
            サーバーを用意しない場合の方法です。トークンは<strong>この端末のブラウザ内だけ</strong>に保存され、バックアップには含まれません。共有の端末では使わないでください。
          </Notice>
          <label className="label" htmlFor="tmdb-token">
            TMDb の API 読み取りアクセストークン（または API キー）
          </label>
          <input id="tmdb-token" type="password" autoComplete="off" className="field" value={token} onChange={(e) => setToken(e.target.value)} />
          <Button
            size="sm"
            variant="ink"
            onClick={() =>
              repo
                .updateSettings({ tmdbPersonalToken: token.trim() })
                .then(() => toast.show('トークンを保存しました'))
                .catch((e) => toast.error(e))
            }
          >
            保存
          </Button>
        </div>
      )}
      <TmdbEnrichPanel available={available} />
    </Section>
  );
}
