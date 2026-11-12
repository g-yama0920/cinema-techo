/**
 * CSV の読み込みと、JSON（正式データ）との照合。
 * CSV は「作品・評価・視聴状態の照合用」なので、取り込み自体には使わず差異の報告だけ行う。
 */
import { STATUS_LABEL, WORK_TYPE_LABEL } from './labels';
import { normalizeSeed, type NormalizedSeed } from './seed';
import { titleKey } from './text';

/** RFC 4180 形式（引用符・改行入りセル・BOM・CRLF 対応）。区切りはカンマ／タブ／セミコロンを自動判定 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = [',', '\t', ';'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
      continue;
    }
    if (c === '"' && cell === '') quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

export function csvToObjects(text: string): Record<string, string>[] {
  const [header, ...body] = parseCsv(text);
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body.map((cells) => Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? '').trim()])));
}

export interface ReconcileResult {
  csvRows: number;
  matched: number;
  mismatches: { no: number; title: string; field: string; json: string; csv: string }[];
  onlyInJson: { no: number; title: string }[];
  onlyInCsv: { no: number; title: string }[];
  csvErrors: string[];
}

export function reconcileWithCsv(json: NormalizedSeed, csvText: string): ReconcileResult {
  const csv = normalizeSeed(csvToObjects(csvText));
  const jsonBy = new Map(json.records.map((r) => [r.legacyId, r]));
  const csvBy = new Map(csv.records.map((r) => [r.legacyId, r]));
  const mismatches: ReconcileResult['mismatches'] = [];
  let matched = 0;
  for (const [no, j] of jsonBy) {
    const c = csvBy.get(no);
    if (!c) continue;
    let ok = true;
    const add = (field: string, a: string, b: string) => {
      ok = false;
      mismatches.push({ no, title: j.title, field, json: a, csv: b });
    };
    if (titleKey(j.title) !== titleKey(c.title) && ![...j.alternateTitles].map(titleKey).includes(titleKey(c.title))) add('タイトル', j.title, c.title);
    if (j.rating !== c.rating) add('評価', j.rating ? `★${j.rating}` : 'なし', c.rating ? `★${c.rating}` : 'なし');
    if (j.status !== c.status) add('状態', STATUS_LABEL[j.status], STATUS_LABEL[c.status]);
    if (j.type !== c.type && c.type !== 'other') add('区分', WORK_TYPE_LABEL[j.type], WORK_TYPE_LABEL[c.type]);
    if (ok) matched++;
  }
  return {
    csvRows: csv.records.length + csv.watchlist.length,
    matched,
    mismatches,
    onlyInJson: [...jsonBy.values()].filter((r) => !csvBy.has(r.legacyId)).map((r) => ({ no: r.legacyId, title: r.title })),
    onlyInCsv: [...csvBy.values()].filter((r) => !jsonBy.has(r.legacyId)).map((r) => ({ no: r.legacyId, title: r.title })),
    csvErrors: csv.errors,
  };
}
