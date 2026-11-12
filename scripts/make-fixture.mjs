// テスト用の架空データ（実在の評価データではありません）
// 依頼書の構成（No.1〜49：評価済み41・評価保留7・未視聴1 / No.50 確認待ち / 見たいリスト3）を再現する
import { writeFileSync } from 'node:fs';

const fictional = [
  ['海辺の映写技師', 'movie', 2019], ['夜行列車の約束', 'movie', 2021], ['七月の灯台', 'drama', 2022], ['紙飛行機の街', 'anime', 2020],
  ['真夜中の郵便局', 'movie', 2018], ['青い屋根の下で', 'drama', 2023], ['星を数える少年', 'anime', 2017], ['雨の日の探偵', 'drama', 2021],
  ['銀幕の向こう側', 'movie', 2016], ['風見鶏の家', 'movie', 2015], ['氷の上のワルツ', 'anime', 2022], ['港町ブルース', 'movie', 2012],
  ['路面電車', 'drama', 2020], ['灯台守', 'movie', 2019], ['きつねの嫁入り', 'anime', 2014], ['最後の上映会', 'movie', 2023],
  ['月曜日の魔法使い', 'anime', 2024], ['屋上の天文台', 'drama', 2019], ['砂丘のオルガン', 'movie', 2011], ['旅する図書館', 'drama', 2024],
  ['白い自転車', 'movie', 2010], null, ['蒸気機関の少女', 'anime', 2016], ['金魚と花火', 'movie', 2022],
  ['坂道のアトリエ', 'drama', 2018], ['水平線の手紙', 'movie', 2020], ['八月の合唱団', 'drama', 2017], ['黒猫喫茶', 'anime', 2023],
  ['遠い国の切手', 'movie', 2013], ['鉄塔と少女', 'anime', 2021], null, ['冬の観覧車', 'movie', 2024],
  ['商店街の英雄', 'drama', 2016], ['夜明けのラジオ', 'movie', 2009], ['ガラスの温室', 'drama', 2025], ['灯台守', 'drama', 2023],
  ['桜並木のふたり', 'anime', 2019], null, ['廃線の向こう', 'movie', 2018], ['屋形船の夜', 'drama', 2015],
  ['空中ブランコ', 'movie', 2025], ['朝顔通信', 'anime', 2012], ['鉱山町の兄弟', 'movie', 2008], ['影絵の劇場', 'anime', 2025],
  ['蛍の川', 'drama', 2011], ['南十字星', 'movie', 2026], null, ['終点の駅舎', 'drama', 2026], ['小さな映画館', 'movie', 2026],
];
const special = {
  22: { title: '三体', type: 'ドラマ', year: 2023, country: '中国', rating: 1 },
  31: { title: '宇宙を駆けるよだか', type: 'ドラマ', year: 2018, rating: 4 },
  38: { title: 'ルパン三世 PART III', type: 'アニメ', year: 1984, status: '未視聴' },
  47: { title: 'モンスター', type: '', rating: 3 },
};
const pendingNos = new Set([5, 12, 19, 26, 33, 40, 45]);
const ratingCycle = [4, 5, 3, 4, 2, 5, 3, 4, 1, 3, 4, 5];
const dated = { 2: '2026-11-03', 3: '2026-11-08', 9: '2026-10-21', 16: '2026-10-21', 24: '2026-11-10', 44: '2026-09', 48: '2025', 6: '2026/11/01' };

const records = [];
let ri = 0;
for (let no = 1; no <= 49; no++) {
  const sp = special[no];
  const base = sp ?? { title: fictional[no - 1][0], type: { movie: '映画', drama: 'ドラマ', anime: 'アニメ' }[fictional[no - 1][1]], year: fictional[no - 1][2] };
  const rec = { no, title: base.title, type: base.type, year: base.year ?? null };
  if (base.country) rec.country = base.country;
  if (sp?.status) {
    rec.status = sp.status; rec.rating = null;
  } else if (pendingNos.has(no)) {
    rec.status = '評価保留'; rec.rating = null;
  } else {
    rec.status = '評価済み'; rec.rating = sp?.rating ?? ratingCycle[ri++ % ratingCycle.length];
  }
  if (dated[no]) rec.watchedOn = dated[no];
  // 登録日は視聴日として扱わないことを確認するための項目
  rec.registeredAt = '2025-04-01';
  if (no === 7) rec.memo = 'テスト用のメモです。';
  records.push(rec);
}
records.push({ no: 50, title: '全領域異常解決室', type: 'ドラマ', year: 2024, rating: null, status: '評価未回答' });

const rated = records.filter((r) => typeof r.rating === 'number');
const avg = rated.reduce((s, r) => s + r.rating, 0) / rated.length;

const seed = {
  note: 'テスト用の架空データです。実際の評価データではありません。',
  summary: { ratedCount: rated.length, pendingCount: 7, unwatchedCount: 1, averageRating: Math.round(avg * 100) / 100 },
  records,
  watchlist: [
    { no: 1, title: '灰色の港', type: '映画', year: 2026 },
    { no: 2, title: '雪国の電話交換手', type: 'ドラマ', plannedDate: '2026-11-22' },
    { no: 3, title: '夕焼け探偵団', type: 'アニメ', services: 'Netflix' },
  ],
};
writeFileSync('tests/fixtures/sample_seed.json', JSON.stringify(seed, null, 2));
console.log('records', records.length, 'rated', rated.length, 'avg', avg.toFixed(4));
