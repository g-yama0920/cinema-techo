import { useEffect, useState } from 'react';
import { useRepo } from '../../data/LibraryProvider';
import type { WatchEvent, Work } from '../../domain/types';
import { PartialDateInput, initialDateValue, resolveDate, type PartialDateValue } from '../../ui/PartialDateInput';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { PLATFORM_SUGGESTIONS } from '../../ui/WatchedSheet';
import { Button } from '../../ui/primitives';

/** 視聴記録（視聴イベント）の追加・編集。評価は変えない */
export function EventSheet({ work, event, open, onClose }: { work: Work; event: WatchEvent | null; open: boolean; onClose: () => void }) {
  const repo = useRepo();
  const toast = useToast();
  const isSeries = work.type === 'drama' || work.type === 'anime';
  const [date, setDate] = useState<PartialDateValue>(initialDateValue());
  const [platform, setPlatform] = useState('');
  const [location, setLocation] = useState('');
  const [minutes, setMinutes] = useState('');
  const [season, setSeason] = useState('');
  const [episode, setEpisode] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setDate(event ? initialDateValue(event.watchedOn, event.watchedOnPrecision) : initialDateValue());
    setPlatform(event?.platform ?? '');
    setLocation(event?.location ?? '');
    setMinutes(event?.watchedMinutes != null ? String(event.watchedMinutes) : '');
    setSeason(event?.seasonNumber != null ? String(event.seasonNumber) : '');
    setEpisode(event?.episodeNumber != null ? String(event.episodeNumber) : '');
    setNotes(event?.notes ?? '');
  }, [open, event]);

  const save = async () => {
    const input = {
      ...resolveDate(date),
      platform: platform.trim() || null,
      location: location.trim() || null,
      watchedMinutes: minutes ? Number(minutes) : null,
      seasonNumber: season ? Number(season) : null,
      episodeNumber: episode ? Number(episode) : null,
      notes: notes.trim(),
    };
    try {
      if (event) await repo.updateWatchEvent(event.id, input);
      else await repo.addWatchEvent(work.id, input);
      toast.show(event ? '視聴記録を更新しました' : '視聴記録を追加しました');
      onClose();
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      kicker={event ? '視聴記録を編集' : '視聴記録を追加'}
      title={work.title}
      footer={
        <Button variant="ink" size="lg" block onClick={save}>
          保存する
        </Button>
      }
    >
      <div className="space-y-5">
        <PartialDateInput value={date} onChange={setDate} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ev-platform">
              配信サービス
            </label>
            <input id="ev-platform" list="ev-platforms" className="field" value={platform} onChange={(e) => setPlatform(e.target.value)} />
            <datalist id="ev-platforms">
              {PLATFORM_SUGGESTIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="ev-loc">
              場所
            </label>
            <input id="ev-loc" className="field" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例: 自宅、〇〇シネマ" />
          </div>
        </div>
        <div className={`grid gap-3 ${isSeries ? 'grid-cols-3' : 'grid-cols-1'}`}>
          <div>
            <label className="label" htmlFor="ev-min">
              視聴時間（分）
            </label>
            <input id="ev-min" type="number" inputMode="numeric" min={1} className="field" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="不明" />
          </div>
          {isSeries && (
            <>
              <div>
                <label className="label" htmlFor="ev-s">
                  シーズン
                </label>
                <input id="ev-s" type="number" inputMode="numeric" min={1} className="field" value={season} onChange={(e) => setSeason(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="ev-e">
                  話
                </label>
                <input id="ev-e" type="number" inputMode="numeric" min={1} className="field" value={episode} onChange={(e) => setEpisode(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <div>
          <label className="label" htmlFor="ev-notes">
            メモ
          </label>
          <textarea id="ev-notes" rows={2} className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </Sheet>
  );
}
