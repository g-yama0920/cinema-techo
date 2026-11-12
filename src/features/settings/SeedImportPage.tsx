import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useLibrary, useRepo } from '../../data/LibraryProvider';
import type { ChangeSet } from '../../data/repository';
import { STATUS_LABEL, WORK_TYPE_LABEL } from '../../domain/labels';
import { reconcileWithCsv } from '../../domain/reconcile';
import { normalizeSeed, summarizeSeed, type NormalizedSeed } from '../../domain/seed';
import { hasBundledSeed, loadBundledSeed } from '../../services/bundledSeed';
import { planSeedImport } from '../../services/seedImport';
import { IconAlert, IconCheck, IconChevronLeft, IconUpload } from '../../ui/icons';
import { Button, ErrorState, PageHeader } from '../../ui/primitives';
import { ConfirmSheet } from '../../ui/Sheet';
import { StarDisplay } from '../../ui/Stars';
import { useToast } from '../../ui/Toast';

/** 既存データ（movie_tracker_full_catalog.json）の取り込み。取り込み前に必ずプレビューする */
export function SeedImportPage() {
  const index = useLibrary();
  const repo = useRepo();
  const toast = useToast();
  const navigate = useNavigate();
  const [source, setSource] = useState<{ name: string; seed: NormalizedSeed } | null>(null);
  const [csv, setCsv] = useState<{ name: string; text: string } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [applyDiffs, setApplyDiffs] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const bundled = hasBundledSeed();

  useEffect(() => {
    if (bundled && !source)
      loadBundledSeed().then((s) => {
        if (!s) return;
        setSource({ name: s.name, seed: normalizeSeed(s.data) });
        if (s.csv) setCsv(s.csv);
      });
  }, [bundled]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setParseError(null);
    for (const file of Array.from(files)) {
      const text = (await file.text()).replace(/^﻿/, '');
      if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
        setCsv({ name: file.name, text });
        continue;
      }
      try {
        setSource({ name: file.name, seed: normalizeSeed(JSON.parse(text)) });
        setApplyDiffs(false);
      } catch {
        setParseError(`「${file.name}」を JSON として読み込めませんでした。`);
      }
    }
  };

  const summary = source ? summarizeSeed(source.seed) : null;
  const plan = useMemo(() => (source && !source.seed.errors.length ? planSeedImport(source.seed, index.snapshot) : null), [source, index.snapshot]);
  const recon = useMemo(() => (source && csv ? reconcileWithCsv(source.seed, csv.text) : null), [source, csv]);
  const allWarnings = source ? [...source.seed.warnings, ...(plan?.warnings ?? [])] : [];
  const updatable = plan ? plan.diffs.filter((d) => !d.conflict).length : 0;
  const willDo = plan ? plan.added + plan.linked + (applyDiffs ? updatable : 0) : 0;

  const run = async () => {
    if (!plan) return;
    setConfirm(false);
    setBusy(true);
    try {
      await repo.applyChanges(plan.changes, 'merge');
      if (applyDiffs && updatable) await repo.applyChanges(plan.updates as ChangeSet, 'merge');
      toast.show(
        [plan.added ? `${plan.added}件を追加` : '', applyDiffs && updatable ? `${updatable}件を更新` : ''].filter(Boolean).join('・') || '変更はありませんでした',
      );
      navigate('/', { replace: true });
    } catch (e) {
      toast.error(e, '取り込みに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="pt-[calc(var(--safe-t)+8px)] md:pt-6">
        <Link to="/settings" className="-ml-2 inline-flex min-h-11 items-center gap-0.5 pr-3 text-sm font-bold hover:text-red">
          <IconChevronLeft size={20} />
          設定
        </Link>
      </div>
      <PageHeader en="IMPORT" ja="既存の記録を取り込む" />

      <div className="mt-5 space-y-5">
        <p className="text-[15px]">
          正式データ <code className="font-bold">movie_tracker_full_catalog.json</code> を取り込みます。照合用の CSV も一緒に選ぶと、内容が一致しているか確認できます。
          評価値はそのまま保持し、日付が無い記録に日付を補うことはしません。何度取り込んでも同じ作品は増えません。
        </p>

        <label className="flex min-h-16 cursor-pointer items-center justify-center gap-2 border border-dashed border-line bg-paper-light px-4 text-center font-bold hover:bg-paper-deep">
          <IconUpload size={22} />
          {source ? '別のファイルを選ぶ' : 'JSON（と照合用 CSV）を選ぶ'}
          <input type="file" multiple accept="application/json,.json,text/csv,.csv" className="sr-only" onChange={(e) => onFiles(e.target.files)} />
        </label>
        <p className="text-xs text-ink-soft">
          {source ? `JSON：${source.name}` : 'JSON：未選択'}　／　{csv ? `照合用CSV：${csv.name}` : '照合用CSV：未選択（任意）'}
          {bundled && '　※アプリに同梱された初期データを読み込んでいます'}
        </p>

        {parseError && <ErrorState title="読み込めません">{parseError}</ErrorState>}

        {source && summary && (
          <section aria-labelledby="pv" className="space-y-5">
            <h2 id="pv" className="flex items-end gap-3">
              <span className="text-lg font-bold">取り込み前の確認</span>
              <span className="kicker text-gray">Preview</span>
              <span className="mb-[5px] h-px flex-1 bg-line" />
            </h2>

            <div className="grid grid-cols-4 border-t border-l border-line bg-paper-light text-center">
              <Box label="作品" value={summary.totalWorks} strong />
              <Box label="評価済み" value={summary.rated} />
              <Box label="評価保留" value={summary.pending} />
              <Box label="未視聴" value={summary.unwatched} />
              <Box label="見たい" value={summary.want} />
              <Box label="未確認" value={summary.unconfirmed} />
              <Box label="確認待ち" value={summary.needsReview} />
              <Box label="平均評価" text={summary.averageRating != null ? summary.averageRating.toFixed(2) : '—'} />
            </div>
            <dl className="text-sm">
              {source.seed.declared.averageRating != null && (
                <Line k="ファイル記載の平均">
                  {source.seed.declared.averageRating.toFixed(2)}
                  {summary.averageRating != null && Math.abs(summary.averageRating - source.seed.declared.averageRating) < 0.005 ? (
                    <span className="ml-2 font-bold text-teal">一致</span>
                  ) : (
                    <span className="ml-2 font-bold text-red">不一致</span>
                  )}
                </Line>
              )}
              <Line k="評価分布">{summary.distribution.map((n, i) => `★${i + 1}: ${n}`).join(' / ')}</Line>
              <Line k="区分">{`映画 ${summary.byType.movie} / ドラマ ${summary.byType.drama} / アニメ ${summary.byType.anime} / その他 ${summary.byType.other}`}</Line>
              <Line k="視聴日あり">{summary.withDate} 件（それ以外は日付不明のまま登録）</Line>
              <Line k="TMDb ID あり">{summary.withTmdb} 件</Line>
              {summary.watchedUnrated > 0 && <Line k="視聴済み・評価なし">{summary.watchedUnrated} 件</Line>}
            </dl>

            {recon && <CsvResult recon={recon} />}

            {source.seed.errors.length > 0 && (
              <ErrorState title="このファイルは取り込めません">
                <ul className="list-disc space-y-1 pl-5">
                  {source.seed.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </ErrorState>
            )}

            {allWarnings.length > 0 && (
              <details className="border border-red bg-paper-light">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-bold text-red">
                  <IconAlert size={18} />
                  注意 {allWarnings.length} 件（取り込み方に関わるので確認してください）
                </summary>
                <ul className="list-disc space-y-1 border-t border-red py-2 pr-3 pl-8 text-sm">
                  {allWarnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </details>
            )}

            {plan && (
              <>
                <p className="text-sm font-bold">
                  新規 <span className="num text-red">{plan.added}</span> 件 ／ 取り込み済み {plan.skipped} 件
                  {plan.linked > 0 && ` ／ 既存作品に紐付け ${plan.linked} 件`}
                </p>

                {plan.diffs.length > 0 && (
                  <div className="border border-line bg-paper-light p-3 text-sm">
                    <p className="font-bold">登録済みの作品と内容が違うもの：{plan.diffs.length} 件</p>
                    <p className="mt-0.5 text-xs text-ink-soft">既定では変更しません（登録済みのデータを優先）。ファイルの内容に合わせたい場合だけ下のチェックを入れてください。</p>
                    <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
                      {plan.diffs.map((d) => (
                        <li key={d.legacyId} className={d.conflict ? 'text-red' : ''}>
                          No.{d.legacyId} {d.title}：{d.changes.map((c) => `${c.field} ${c.from}→${c.to}`).join('、')}
                          {d.conflict && '（タイトルが違うため別作品の可能性。自動では反映しません）'}
                        </li>
                      ))}
                    </ul>
                    {updatable > 0 && (
                      <label className="mt-2 flex min-h-11 items-center gap-2 font-bold">
                        <input type="checkbox" className="h-5 w-5 accent-[var(--color-red)]" checked={applyDiffs} onChange={(e) => setApplyDiffs(e.target.checked)} />
                        差分をファイルの内容で更新する（{updatable}件。感想・タグ・視聴記録は残します）
                      </label>
                    )}
                  </div>
                )}

                <details className="border border-line bg-paper-light" open={plan.added > 0 && plan.added <= 30}>
                  <summary className="flex min-h-11 cursor-pointer list-none items-center px-3 font-bold">一覧を表示（{source.seed.records.length + source.seed.watchlist.length}件）</summary>
                  <div className="max-h-[55vh] overflow-y-auto border-t border-line">
                    <table className="w-full text-left text-[13px]">
                      <thead className="sticky top-0 bg-paper-deep">
                        <tr>
                          <th className="px-2 py-1.5">No.</th>
                          <th className="px-2 py-1.5">タイトル</th>
                          <th className="px-2 py-1.5">状態</th>
                        </tr>
                      </thead>
                      <tbody>
                        {source.seed.records.map((r) => {
                          const row = plan.rows.find((x) => x.kind === 'record' && x.label === `No.${r.legacyId}`);
                          return (
                            <tr key={r.legacyId} className="border-t border-line align-top">
                              <td className="num px-2 py-1.5">{r.legacyId}</td>
                              <td className="px-2 py-1.5">
                                <span className="font-bold">{r.title}</span>
                                {r.edition && <span className="text-ink-soft">（{r.edition}）</span>}
                                <span className="block text-[11px] text-ink-soft">
                                  {WORK_TYPE_LABEL[r.type]}
                                  {r.releaseYear ? `・${r.releaseYear}` : ''}
                                  {r.watchedOn ? `・視聴 ${r.watchedOn}` : ''}
                                  {r.watchlistNumber != null ? `・見たい No.${r.watchlistNumber}` : ''}
                                </span>
                                {r.needsReview && <span className="block text-[11px] font-bold text-red">確認待ち：{r.needsReview}</span>}
                                {r.notes.length > 0 && <span className="block text-[11px] text-teal">{r.notes.join(' / ')}</span>}
                                {row?.action === 'skip' && <span className="block text-[11px] text-teal">取り込み済み（スキップ）</span>}
                              </td>
                              <td className="px-2 py-1.5 whitespace-nowrap">{r.rating ? <StarDisplay rating={r.rating} size={11} /> : STATUS_LABEL[r.status]}</td>
                            </tr>
                          );
                        })}
                        {source.seed.watchlist.map((w) => {
                          const row = plan.rows.find((x) => x.kind === 'watchlist' && x.label === `見たい No.${w.number}`);
                          return (
                            <tr key={`w${w.number}`} className="border-t border-line align-top">
                              <td className="num px-2 py-1.5 text-mustard">W{w.number}</td>
                              <td className="px-2 py-1.5">
                                <span className="font-bold">{w.title}</span>
                                <span className="block text-[11px] text-ink-soft">{WORK_TYPE_LABEL[w.type]}</span>
                                {row?.reason && <span className="block text-[11px] text-teal">{row.reason}</span>}
                              </td>
                              <td className="px-2 py-1.5 whitespace-nowrap">見たい</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
                <Button variant="primary" size="lg" block disabled={busy || willDo === 0} onClick={() => setConfirm(true)}>
                  {willDo === 0 ? 'すべて取り込み済みです' : plan.added ? `${plan.added}件を取り込む` : `${updatable}件を更新する`}
                </Button>
              </>
            )}
          </section>
        )}
      </div>

      <ConfirmSheet open={confirm} title="取り込みを実行しますか？" confirmLabel="取り込む" onClose={() => setConfirm(false)} onConfirm={run}>
        <p>
          新しい {plan?.added ?? 0} 件を追加します。
          {applyDiffs && updatable ? `登録済みの ${updatable} 件はファイルの内容で更新します（感想・タグ・視聴記録は残します）。` : 'すでにある作品（同じ番号）は変更しません。'}
          <br />
          取り込み後は、念のため設定画面からバックアップを保存してください。
        </p>
      </ConfirmSheet>
    </div>
  );
}

function CsvResult({ recon }: { recon: ReturnType<typeof reconcileWithCsv> }) {
  const ok = !recon.mismatches.length && !recon.onlyInCsv.length && !recon.onlyInJson.length && !recon.csvErrors.length;
  return (
    <div className={`border p-3 text-sm ${ok ? 'border-teal bg-paper-light' : 'border-red bg-paper-light'}`} role="status">
      <p className={`flex items-center gap-2 font-bold ${ok ? 'text-teal' : 'text-red'}`}>
        {ok ? <IconCheck size={18} /> : <IconAlert size={18} />}
        CSV との照合：{ok ? `${recon.matched}件すべて一致` : `一致 ${recon.matched}件／差異あり`}
      </p>
      {!ok && (
        <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-xs">
          {recon.csvErrors.map((e) => (
            <li key={e}>CSV：{e}</li>
          ))}
          {recon.mismatches.map((m, i) => (
            <li key={i}>
              No.{m.no} {m.title}：{m.field} JSON「{m.json}」／CSV「{m.csv}」
            </li>
          ))}
          {recon.onlyInJson.map((r) => (
            <li key={`j${r.no}`}>No.{r.no} {r.title}：CSV にありません</li>
          ))}
          {recon.onlyInCsv.map((r) => (
            <li key={`c${r.no}`}>No.{r.no} {r.title}：JSON にありません</li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[11px] text-ink-soft">取り込みには JSON（正式データ）だけを使います。CSV は照合にのみ使用します。</p>
    </div>
  );
}

function Box({ label, value, text, strong }: { label: string; value?: number; text?: string; strong?: boolean }) {
  return (
    <div className="border-r border-b border-line px-1 py-2.5">
      <p className={`num leading-none ${strong ? 'text-2xl text-red' : 'text-xl'}`}>{text ?? value}</p>
      <p className="mt-1 text-[10.5px] font-bold">{label}</p>
    </div>
  );
}

function Line({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 border-b border-line py-1.5">
      <dt className="font-bold text-ink-soft">{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}
