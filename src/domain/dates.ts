import type { DatePrecision } from './types';

/** ローカル時刻で YYYY-MM-DD */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

const RE_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_MONTH = /^(\d{4})-(\d{2})$/;
const RE_YEAR = /^(\d{4})$/;

/** 文字列から精度を判定。不正な値は null */
export function precisionOf(value: string | null | undefined): DatePrecision | null {
  if (!value) return null;
  if (RE_DAY.test(value)) return isValidDay(value) ? 'day' : null;
  if (RE_MONTH.test(value)) {
    const m = Number(value.slice(5, 7));
    return m >= 1 && m <= 12 ? 'month' : null;
  }
  if (RE_YEAR.test(value)) return 'year';
  return null;
}

function isValidDay(value: string): boolean {
  const [, y, m, d] = RE_DAY.exec(value)!;
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return dt.getFullYear() === Number(y) && dt.getMonth() === Number(m) - 1 && dt.getDate() === Number(d);
}

/**
 * いろいろな書式の日付を部分日付へ変換する。
 * 「2023/5/3」「2023年5月」「2023」などに対応。解釈できないものは null（推測で補わない）。
 */
export function parsePartialDate(input: unknown): { value: string; precision: DatePrecision } | null {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  // ISO の日時（2023-05-03T12:00:00Z）は日付部分のみ
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(s);
  const slash = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(s);
  const jpDay = /^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日$/.exec(s);
  const day = iso ?? slash ?? jpDay;
  if (day) {
    const v = `${day[1]}-${day[2].padStart(2, '0')}-${day[3].padStart(2, '0')}`;
    return precisionOf(v) === 'day' ? { value: v, precision: 'day' } : null;
  }
  const month = /^(\d{4})[-/.](\d{1,2})$/.exec(s) ?? /^(\d{4})年\s*(\d{1,2})月$/.exec(s);
  if (month) {
    const v = `${month[1]}-${month[2].padStart(2, '0')}`;
    return precisionOf(v) === 'month' ? { value: v, precision: 'month' } : null;
  }
  const year = /^(\d{4})年?$/.exec(s);
  if (year) return { value: year[1], precision: 'year' };
  return null;
}

/** 表示用 */
export function formatPartialDate(value: string | null, precision: DatePrecision | null): string {
  if (!value || !precision) return '日付不明';
  const y = value.slice(0, 4);
  if (precision === 'year') return `${y}年`;
  const m = Number(value.slice(5, 7));
  if (precision === 'month') return `${y}年${m}月`;
  const d = Number(value.slice(8, 10));
  return `${y}年${m}月${d}日`;
}

export function formatShortDate(value: string | null, precision: DatePrecision | null): string {
  if (!value || !precision) return '日付不明';
  if (precision === 'year') return value.slice(0, 4);
  if (precision === 'month') return `${value.slice(0, 4)}.${value.slice(5, 7)}`;
  return `${value.slice(0, 4)}.${value.slice(5, 7)}.${value.slice(8, 10)}`;
}

/** 部分日付が指定の年に含まれるか（年精度以上が必要） */
export function inYear(value: string | null, year: number): boolean {
  return !!value && value.slice(0, 4) === String(year);
}

/** 部分日付が指定の年月に含まれるか（月精度以上が必要。年精度のみの日付は含めない） */
export function inMonth(value: string | null, year: number, month: number): boolean {
  if (!value || value.length < 7) return false;
  return value.slice(0, 7) === `${year}-${String(month).padStart(2, '0')}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];
