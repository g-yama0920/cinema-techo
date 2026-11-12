import { useId } from 'react';
import { todayISO } from '../domain/dates';
import type { DatePrecision } from '../domain/types';
import { SegmentedTabs } from './primitives';

export interface PartialDateValue {
  mode: 'today' | 'pick' | 'unknown';
  precision: DatePrecision;
  value: string;
}

export function initialDateValue(watchedOn?: string | null, precision?: DatePrecision | null): PartialDateValue {
  if (watchedOn && precision) return { mode: 'pick', precision, value: watchedOn };
  if (watchedOn === null && precision === null) return { mode: 'unknown', precision: 'day', value: todayISO() };
  return { mode: 'today', precision: 'day', value: todayISO() };
}

/** 入力値 → 保存値。不正・未入力は null（日付不明） */
export function resolveDate(v: PartialDateValue): { watchedOn: string | null; watchedOnPrecision: DatePrecision | null } {
  if (v.mode === 'unknown') return { watchedOn: null, watchedOnPrecision: null };
  if (v.mode === 'today') return { watchedOn: todayISO(), watchedOnPrecision: 'day' };
  const ok =
    (v.precision === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(v.value)) ||
    (v.precision === 'month' && /^\d{4}-\d{2}$/.test(v.value)) ||
    (v.precision === 'year' && /^\d{4}$/.test(v.value));
  return ok ? { watchedOn: v.value, watchedOnPrecision: v.precision } : { watchedOn: null, watchedOnPrecision: null };
}

/** 視聴日（年・月・日の精度を選べる。不明も可） */
export function PartialDateInput({ value, onChange, label = '視聴日' }: { value: PartialDateValue; onChange: (v: PartialDateValue) => void; label?: string }) {
  const id = useId();
  const setPrecision = (p: DatePrecision) => {
    const base = value.value || todayISO();
    const y = base.slice(0, 4);
    const next = p === 'year' ? y : p === 'month' ? `${y}-${(base.slice(5, 7) || '01').padStart(2, '0')}` : base.length === 10 ? base : todayISO();
    onChange({ ...value, precision: p, value: next });
  };
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <SegmentedTabs
        label={label}
        value={value.mode}
        onChange={(mode) => onChange({ ...value, mode })}
        options={[
          { value: 'today', label: '今日' },
          { value: 'pick', label: '日付を指定' },
          { value: 'unknown', label: '日付不明' },
        ]}
      />
      {value.mode === 'pick' && (
        <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-2">
          <SegmentedTabs
            size="sm"
            label="日付の精度"
            value={value.precision}
            onChange={setPrecision}
            options={[
              { value: 'day', label: '年月日' },
              { value: 'month', label: '年月' },
              { value: 'year', label: '年' },
            ]}
          />
          <label htmlFor={id} className="sr-only">
            {label}
          </label>
          {value.precision === 'day' && (
            <input id={id} type="date" className="field min-h-10 py-1.5" value={value.value} max="2100-12-31" onChange={(e) => onChange({ ...value, value: e.target.value })} />
          )}
          {value.precision === 'month' && (
            <input id={id} type="month" className="field min-h-10 py-1.5" value={value.value} onChange={(e) => onChange({ ...value, value: e.target.value })} />
          )}
          {value.precision === 'year' && (
            <input
              id={id}
              type="number"
              inputMode="numeric"
              min={1900}
              max={2100}
              className="field min-h-10 py-1.5"
              value={value.value}
              onChange={(e) => onChange({ ...value, value: e.target.value.slice(0, 4) })}
            />
          )}
        </div>
      )}
      {value.mode === 'unknown' && <p className="mt-2 text-xs text-ink-soft">日付不明の記録はカレンダーと月別・年別の集計には表示されません。</p>}
    </fieldset>
  );
}
