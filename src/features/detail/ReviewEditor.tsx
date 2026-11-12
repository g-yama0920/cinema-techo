import { useEffect, useState, type KeyboardEvent } from 'react';
import { useRepo } from '../../data/LibraryProvider';
import { uniqueStrings } from '../../domain/text';
import type { UserWork } from '../../domain/types';
import { IconClose } from '../../ui/icons';
import { useToast } from '../../ui/Toast';

/** 感想メモ（離れたときに自動保存） */
export function ReviewEditor({ user }: { user: UserWork }) {
  const repo = useRepo();
  const toast = useToast();
  const [text, setText] = useState(user.review);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    setText(user.review);
    setSaved(true);
  }, [user.workId, user.review]);

  const save = async () => {
    if (text === user.review) return setSaved(true);
    try {
      await repo.updateUserWork(user.workId, { review: text });
      setSaved(true);
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <div>
      <label htmlFor="review" className="sr-only">
        感想メモ
      </label>
      <textarea
        id="review"
        rows={4}
        className="field leading-relaxed"
        placeholder="感想・メモ（自分用）"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        onBlur={save}
      />
      <div className="mt-1.5 flex min-h-10 items-center justify-end gap-3 text-xs">
        <span className="text-ink-soft" aria-live="polite">
          {saved ? (user.review ? '保存済み' : '') : '未保存の変更があります'}
        </span>
        {!saved && (
          <button type="button" onClick={save} className="min-h-10 border border-ink bg-ink px-3 font-bold text-paper">
            保存
          </button>
        )}
      </div>
    </div>
  );
}

export function TagEditor({ user }: { user: UserWork }) {
  const repo = useRepo();
  const toast = useToast();
  const [draft, setDraft] = useState('');

  const setTags = async (tags: string[]) => {
    try {
      await repo.updateUserWork(user.workId, { tags });
    } catch (e) {
      toast.error(e);
    }
  };
  const add = () => {
    const t = draft.replace(/^#/, '').trim();
    if (!t) return;
    setDraft('');
    setTags(uniqueStrings([...user.tags, t]));
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      add();
    }
  };

  return (
    <div>
      {user.tags.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {user.tags.map((t) => (
            <li key={t} className="flex items-center border border-ink bg-paper-light pl-2.5 text-sm font-bold">
              #{t}
              <button
                type="button"
                className="grid h-9 w-9 place-items-center hover:text-red"
                aria-label={`タグ「${t}」を外す`}
                onClick={() => setTags(user.tags.filter((x) => x !== t))}
              >
                <IconClose size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <label htmlFor="tag-input" className="sr-only">
          タグを追加
        </label>
        <input id="tag-input" className="field" placeholder="タグを追加（例: 再見したい）" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} enterKeyHint="done" />
        <button type="button" onClick={add} disabled={!draft.trim()} className="min-h-12 shrink-0 border border-ink bg-paper-light px-4 font-bold disabled:text-gray">
          追加
        </button>
      </div>
    </div>
  );
}
