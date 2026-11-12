/** 初期データ変換層：形式の揺れへの対応と、依頼書の注意事項 */
import { describe, expect, it } from 'vitest';
import { normalizeSeed, parseRating, parseStatus, parseWorkType } from '../src/domain/seed';
import { parsePartialDate } from '../src/domain/dates';

describe('値の解釈', () => {
  it('評価は整数1〜5のみ。星記号・「4/5」も読む。小数は取り込まない', () => {
    expect(parseRating(4)).toEqual({ kind: 'rating', value: 4 });
    expect(parseRating('★★★☆☆')).toEqual({ kind: 'rating', value: 3 });
    expect(parseRating('★5')).toEqual({ kind: 'rating', value: 5 });
    expect(parseRating('4/5')).toEqual({ kind: 'rating', value: 4 });
    expect(parseRating('３')).toEqual({ kind: 'rating', value: 3 }); // 全角
    expect(parseRating(3.5).kind).toBe('invalid');
    expect(parseRating(0).kind).toBe('invalid');
    expect(parseRating('保留')).toEqual({ kind: 'status', value: 'pending' });
    expect(parseRating(null)).toEqual({ kind: 'none' });
  });

  it('状態の表記ゆれ', () => {
    expect(parseStatus('評価保留')).toBe('pending');
    expect(parseStatus('未視聴')).toBe('unwatched');
    expect(parseStatus('評価未回答')).toBe('unconfirmed');
    expect(parseStatus('rated')).toBe('watched');
    expect(parseStatus('見たい')).toBe('want');
  });

  it('区分：アニメ映画はアニメ、漫画は「その他（要確認）」', () => {
    expect(parseWorkType('アニメ映画')).toBe('anime');
    expect(parseWorkType('TVドラマ')).toBe('drama');
    expect(parseWorkType('movie')).toBe('movie');
    expect(parseWorkType('漫画')).toBe('other');
    expect(parseWorkType('')).toBeNull();
  });

  it('日付は精度を区別し、解釈できないものは null', () => {
    expect(parsePartialDate('2023/5/3')).toEqual({ value: '2023-05-03', precision: 'day' });
    expect(parsePartialDate('2023年5月')).toEqual({ value: '2023-05', precision: 'month' });
    expect(parsePartialDate('2023')).toEqual({ value: '2023', precision: 'year' });
    expect(parsePartialDate('2023-02-30')).toBeNull();
    expect(parsePartialDate('去年の夏')).toBeNull();
  });
});

describe('形式の揺れ', () => {
  it('日本語キー・配列直下でも読める', () => {
    const seed = normalizeSeed([
      { 番号: 1, タイトル: '作品A', 種別: '映画', 評価: '★★★★☆' },
      { 番号: 2, タイトル: '作品B', 種別: 'ドラマ', 評価: '保留' },
    ]);
    expect(seed.errors).toEqual([]);
    expect(seed.records.map((r) => [r.legacyId, r.type, r.rating, r.status])).toEqual([
      [1, 'movie', 4, 'watched'],
      [2, 'drama', null, 'pending'],
    ]);
  });

  it('番号が無い形式は並び順を No. とし、注意を出す', () => {
    const seed = normalizeSeed({ works: [{ title: 'A', rating: 3 }, { title: 'B', rating: 5 }] });
    expect(seed.records.map((r) => r.legacyId)).toEqual([1, 2]);
    expect(seed.warnings.join()).toMatch(/並び順/);
  });

  it('番号の重複は取り込みを止める', () => {
    const seed = normalizeSeed({ records: [{ no: 1, title: 'A' }, { no: 1, title: 'B' }] });
    expect(seed.errors.join()).toMatch(/No.1 が重複/);
  });

  it('登録日を視聴日として扱わない', () => {
    const seed = normalizeSeed({ records: [{ no: 1, title: 'A', rating: 3, createdAt: '2024-01-02', registeredAt: '2024-01-02' }] });
    expect(seed.records[0].watchedOn).toBeNull();
  });

  it('同名でも番号が違えば統合しない', () => {
    const seed = normalizeSeed({ records: [{ no: 1, title: 'モンスター', type: '映画', rating: 3 }, { no: 2, title: 'モンスター', type: 'アニメ', rating: 4 }] });
    expect(seed.records).toHaveLength(2);
  });
});

describe('依頼書の注意事項', () => {
  it('「宇宙を駆けるよだか」と「SWITCHED」が別番号で2件あれば1件に統合（評価は変えない）', () => {
    const seed = normalizeSeed({
      records: [
        { no: 31, title: '宇宙を駆けるよだか', type: 'ドラマ', rating: 4 },
        { no: 32, title: 'SWITCHED', type: 'ドラマ', rating: 4 },
      ],
    });
    expect(seed.records).toHaveLength(1);
    expect(seed.records[0].legacyId).toBe(31);
    expect(seed.records[0].alternateTitles).toContain('SWITCHED');
    expect(seed.records[0].rating).toBe(4);
  });

  it('評価が食い違う場合は勝手に決めず、取り込みを止める', () => {
    const seed = normalizeSeed({
      records: [
        { no: 31, title: '宇宙を駆けるよだか', rating: 4 },
        { no: 40, title: 'SWITCHED', rating: 2 },
      ],
    });
    expect(seed.errors.join()).toMatch(/評価が異なります/);
  });

  it('見たいリストの「SWITCHED」は No.31 と同じ作品として紐付ける', () => {
    const seed = normalizeSeed({ records: [{ no: 31, title: '宇宙を駆けるよだか', rating: 4 }], watchlist: [{ title: 'SWITCHED' }] });
    expect(seed.watchlist[0].linkedLegacyId).toBe(31);
  });

  it('No.38 ルパン三世 PART III は評価があっても未視聴（値はメモに退避）', () => {
    const seed = normalizeSeed({ records: [{ no: 38, title: 'ルパン三世 PART III', rating: 3 }] });
    expect(seed.records[0].status).toBe('unwatched');
    expect(seed.records[0].rating).toBeNull();
    expect(seed.records[0].review).toMatch(/★3/);
  });

  it('三体（Netflix版と明記されたもの）は中国ドラマ版にしない', () => {
    const seed = normalizeSeed({ records: [{ no: 1, title: '三体', edition: 'Netflix版', country: 'アメリカ', rating: 3 }] });
    expect(seed.records[0].edition).toBe('Netflix版');
  });
});
