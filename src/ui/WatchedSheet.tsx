import { useEffect, useState } from 'react';
import { useRepo } from '../data/LibraryProvider';
import { displayTitle } from '../domain/library';
import type { Rating, WorkBundle } from '../domain/types';
import { PartialDateInput, initialDateValue, resolveDate, type PartialDateValue } from './PartialDateInput';
import { Sheet } from './Sheet';
import { StarInput } from './Stars';
import { useToast } from './Toast';
import { Button } from './primitives';

export const PLATFORM_SUGGESTIONS = [
  '映画館', 'Netflix', 'Amazon Prime Video', 'U-NEXT', 'Disney+', 'Hulu', 'ABEMA', 'TVer', 'dアニメストア', 'Apple TV+', 'テレビ放送', 'DVD・Blu-ray',
];

/**
 * 「見た」を記録するシート。必ず星評価の入力を求めるが「後で評価する」も選べる。
 */
export function WatchedSheet({
  bundle,
  open,
  onClose,
  onDone,
  initialDate,
}: {
  bundle: WorkBundle;
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  /** カレンダーから開いたときの日付（YYYY-MM-DD） */
  initialDate?: string;
}) {
  const repo = useRepo();
  const toast = useToast();
  const [rating, setRating] = useState<Rating | null>(bundle.user.rating);
  const [date, setDate] = useState<PartialDateValue>(initialDate ? initialDateValue(initialDate, 'day') : initialDateValue());
  const [platform, setPlatform] = useState('');
  const [minutes, setMinutes] = useState('');
  const [season, setSeason] = useState('');
  const [episode, setEpisode] = useState('');
  const [busy, setBusy] = useState(false);
  const isSeries = bundle.work.type === 'drama' || bundle.work.type === 'anime';

  useEffect(() => {
    if (open) {
      setRating(bundle.user.rating);
      setDate(initialDate ? initialDateValue(initialDate, 'day') : initialDateValue());
      setPlatform('');
      setMinutes('');
      setSeason('');
      setEpisode('');
    }
  }, [open, bundle.user.rating, initialDate]);

  const save = async (r: Rating | null) => {
    setBusy(true);
    try {
      await repo.markWatched(
        bundle.work.id,
        {
          ...resolveDate(date),
          platform: platform.trim() || null,
          watchedMinutes: minutes ? Number(minutes) : null,
          seasonNumber: season ? Number(season) : null,
          episodeNumber: episode ? Number(episode) : null,
        },
        r,
      );
      toast.show(r ? `「${bundle.work.title}」を ★${r} で記録しました` : `「${bundle.work.title}」を評価保留で記録しました`);
      onClose();
      onDone?.();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      kicker="視聴を記録"
      title={displayTitle(bundle.work)}
      footer={
        <div className="grid gap-2">
          <Button variant="primary" size="lg" block disabled={!rating || busy} onClick={() => save(rating)}>
            {rating ? `★${rating} で記録する` : '星を選んで記録する'}
          </Button>
          <Button variant="ghost" block disabled={busy} onClick={() => save(null)} className="underline underline-offset-4">
            後で評価する（評価保留にする）
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <p className="label">評価（5段階）</p>
          <StarInput value={rating} onChange={setRating} size={38} />
        </div>
        <PartialDateInput value={date} onChange={setDate} />
        <details className="group border-t border-line pt-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-bold">
            詳細を入力（任意）
            <span className="text-xs text-ink-soft group-open:hidden">配信サービス・視聴時間など</span>
          </summary>
          <div className="mt-3 grid gap-4">
            <div>
              <label className="label" htmlFor="ws-platform">
                見た場所・配信サービス
              </label>
              <input id="ws-platform" list="platforms" className="field" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="例: Netflix" />
              <datalist id="platforms">
                {PLATFORM_SUGGESTIONS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div className={`grid gap-3 ${isSeries ? 'grid-cols-3' : 'grid-cols-1'}`}>
              <div>
                <label className="label" htmlFor="ws-min">
                  視聴時間（分）
                </label>
                <input
                  id="ws-min"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className="field"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder={!isSeries && bundle.work.runtime ? String(bundle.work.runtime) : '不明'}
                />
              </div>
              {isSeries && (
                <>
                  <div>
                    <label className="label" htmlFor="ws-s">
                      シーズン
                    </label>
                    <input id="ws-s" type="number" inputMode="numeric" min={1} className="field" value={season} onChange={(e) => setSeason(e.target.value)} />
                  </div>
                  <div>
                    <label className="label" htmlFor="ws-e">
                      話
                    </label>
                    <input id="ws-e" type="number" inputMode="numeric" min={1} className="field" value={episode} onChange={(e) => setEpisode(e.target.value)} />
                  </div>
                </>
              )}
            </div>
            <p className="text-xs text-ink-soft">
              {isSeries
                ? 'ドラマ・アニメは視聴時間を入力した場合のみ総視聴時間に加算します（推定はしません）。'
                : '空欄の場合、上映時間が登録されていればその時間を総視聴時間に使います。'}
            </p>
          </div>
        </details>
      </div>
    </Sheet>
  );
}
