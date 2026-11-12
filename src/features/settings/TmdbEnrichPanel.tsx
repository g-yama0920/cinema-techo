import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { useLibrary, useRepo } from '../../data/LibraryProvider';
import { padNo } from '../../domain/text';
import { enrichWorks, isEnrichTarget, type EnrichOutcome } from '../../services/tmdb/enrich';
import { Button } from '../../ui/primitives';
import { Sheet } from '../../ui/Sheet';
import { tmdb } from '../add/useTmdb';

/** 登録済み作品のポスター・公開年・ジャンル・あらすじを TMDb から一括取得 */
export function TmdbEnrichPanel({ available }: { available: boolean | null }) {
  const index = useLibrary();
  const repo = useRepo();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [outcomes, setOutcomes] = useState<EnrichOutcome[]>([]);
  const [total, setTotal] = useState(0);
  const abort = useRef<AbortController | null>(null);

  const works = index.bundles.map((b) => b.work);
  const targets = works.filter(isEnrichTarget);
  const linked = works.filter((w) => w.tmdbId != null).length;
  const reviewing = works.filter((w) => w.needsReview).length;

  const start = async () => {
    setOpen(true);
    setRunning(true);
    setOutcomes([]);
    setTotal(targets.length);
    abort.current = new AbortController();
    try {
      await enrichWorks(targets, tmdb, repo, {
        signal: abort.current.signal,
        delayMs: 250,
        onProgress: (_n, o) => setOutcomes((xs) => [...xs, o]),
      });
    } finally {
      setRunning(false);
    }
  };

  const count = (k: EnrichOutcome['result']) => outcomes.filter((o) => o.result === k).length;

  return (
    <div className="mt-4 border-t border-dashed border-gray pt-3">
      <p className="label">作品情報の一括取得</p>
      <p className="text-sm">
        取得済み <span className="num">{linked}</span> ／ 未取得 <span className="num">{targets.length}</span>
        {reviewing > 0 && <span className="text-ink-soft">（確認待ち {reviewing} 件は対象外）</span>}
      </p>
      <p className="mt-1 text-xs text-ink-soft">
        タイトル・区分・公開年が一致する候補が1件だけのときに自動で紐付け、ポスター・公開年・ジャンル・あらすじなどの空欄を埋めます。同名の候補が複数ある場合は「確認待ち」にして、勝手に決めません。
      </p>
      <Button className="mt-2" size="sm" variant="ink" disabled={!available || !targets.length || running} onClick={start}>
        {available ? `未取得の ${targets.length} 件を取得する` : 'TMDb が利用できません'}
      </Button>

      <Sheet open={open} onClose={() => (running ? abort.current?.abort() : setOpen(false))} kicker="TMDb から取得" title={running ? '取得中…' : '取得結果'}>
        <div className="space-y-3 text-sm">
          <div className="h-2 w-full bg-paper-deep" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={outcomes.length}>
            <div className="h-2 bg-red" style={{ width: `${total ? (outcomes.length / total) * 100 : 0}%` }} />
          </div>
          <p>
            {outcomes.length} / {total} 件　紐付け <strong>{count('linked')}</strong>・確認待ち <strong>{count('ambiguous')}</strong>・見つからず <strong>{count('notFound')}</strong>
            {count('error') > 0 && <>・エラー <strong className="text-red">{count('error')}</strong></>}
          </p>
          {running && (
            <Button size="sm" onClick={() => abort.current?.abort()}>
              中止する
            </Button>
          )}
          <ul className="max-h-[50dvh] overflow-y-auto border-t border-ink">
            {outcomes.map((o) => (
              <li key={o.workId} className="border-b border-dashed border-gray py-2">
                <Link to={`/works/${o.workId}`} className="font-bold underline-offset-2 hover:underline" onClick={() => setOpen(false)}>
                  <span className="num mr-1.5 text-xs text-gray">No.{padNo(o.catalogNo)}</span>
                  {o.title}
                </Link>
                <span className={`ml-2 text-xs font-bold ${o.result === 'linked' ? 'text-teal' : o.result === 'ambiguous' ? 'text-red' : 'text-ink-soft'}`}>
                  {o.result === 'linked' ? '紐付け' : o.result === 'ambiguous' ? '確認待ち' : o.result === 'notFound' ? '見つからず' : 'エラー'}
                </span>
                <span className="block text-xs text-ink-soft">{o.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>
    </div>
  );
}
