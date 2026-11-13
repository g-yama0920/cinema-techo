// 実画面での作業完了条件の確認（Playwright / Chromium / 375px）。
//   SEED_BUNDLE=off npm run build && npx vite preview --port 4173 &  →  npm run e2e（同梱データを使わないビルドで確認する）
// 環境変数: BASE（既定 http://localhost:4173/）、SHOTS=1 でスクリーンショットを docs/screenshots に保存
// 使用データ: tests/fixtures/sample_full_catalog.(json|csv)（架空の作品名。構成は 107 = 評価済み44・評価保留7・未視聴1・見たい3・未確認52）
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE ?? 'http://localhost:4173/';
const JSON_FILE = 'tests/fixtures/sample_full_catalog.json';
const CSV_FILE = 'tests/fixtures/sample_full_catalog.csv';
const SHOTS = process.env.SHOTS === '1';
const results = [];
const errors = [];

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

async function newPage(browser, scale = 1) {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: scale,
    isMobile: true,
    hasTouch: true,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/api\/tmdb|favicon|tmdb-logo/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return { ctx, page };
}

async function go(page, hash) {
  await page.goto(`${BASE}#${hash}`);
  await page.waitForTimeout(500);
}

/** 取り込み画面で JSON と CSV を選び、プレビューを読み取ってから取り込む */
async function importViaUi(page) {
  await go(page, '/settings/seed');
  await page.setInputFiles('input[type=file]', [JSON_FILE, CSV_FILE]);
  const btn = page.getByRole('button', { name: /件を取り込む|すべて取り込み済みです|件を更新する/ });
  await btn.waitFor();
  const label = ((await btn.textContent()) ?? '').trim();
  const csvText = ((await page.getByRole('status').filter({ hasText: 'CSV との照合' }).textContent()) ?? '').trim();
  const boxes = await page.locator('section[aria-labelledby="pv"] .grid > div').allInnerTexts();
  if (/件を取り込む/.test(label)) {
    await btn.click();
    await page.getByRole('button', { name: '取り込む', exact: true }).click();
    await page.waitForURL(/#\/$/);
    await page.waitForTimeout(800);
  }
  return { label, csvText, boxes: boxes.map((b) => b.replace(/\s+/g, ' ').trim()) };
}

const total = (page) => page.locator('p[aria-live="polite"] .num').first().textContent();
const tabCount = async (page, name) => ((await page.getByRole('radio', { name: new RegExp(`^${name}`) }).textContent()) ?? '').replace(name, '').trim();
const homeStat = async (page, label) =>
  page.locator(`section[aria-label="記録の概要"] >> text=${label}`).locator('xpath=..').locator('span').first().textContent();
async function shot(page, name, full = false) {
  if (SHOTS) await page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage: full });
}

const browser = await chromium.launch();
try {
  const { ctx, page } = await newPage(browser, SHOTS ? 2 : 1);

  // 1. 取り込み（プレビューと CSV 照合）
  const first = await importViaUi(page);
  const want = ['107 作品', '44 評価済み', '7 評価保留', '1 未視聴', '3 見たい', '52 未確認', '3.00 平均評価'];
  check('プレビュー：作品107・評価済み44・評価保留7・未視聴1・見たい3・未確認52・平均3.00', want.every((x) => first.boxes.includes(x)), first.boxes.join(' | '));
  check('CSV 照合：107件すべて一致', /107件すべて一致/.test(first.csvText), first.csvText.slice(0, 30));
  check('取り込みボタン：107件', /107件を取り込む/.test(first.label), first.label);

  // 2. HOME
  check('HOME：評価済み 44', (await homeStat(page, '評価済み')) === '44');
  check('HOME：見たい 3', (await homeStat(page, '見たい')) === '3');
  check('HOME：未確認 52件の仕分け導線', await page.getByText(/視聴状況が未確認の作品\s*52\s*件/).isVisible());
  await shot(page, '01-home', true);

  // 3. 分類
  await go(page, '/works?type=all');
  check('WORKS：全 107 件', (await total(page)) === '107');
  check('WORKS：視聴済み 44', (await tabCount(page, '視聴済み')) === '44');
  check('WORKS：評価保留 7', (await tabCount(page, '評価保留')) === '7');
  check('WORKS：未視聴 1', (await tabCount(page, '未視聴')) === '1');
  check('WORKS：見たい 3', (await tabCount(page, '見たい')) === '3');
  check('WORKS：未確認 52', (await tabCount(page, '未確認')) === '52');
  await shot(page, '02-works-grid');

  // 4. 検索
  await page.locator('#works-q').fill('灯台守');
  await page.waitForTimeout(300);
  check('検索：「灯台守」で同名の別作品2件（統合されていない）', (await total(page)) === '2');

  // 5. 評価変更
  await go(page, '/works?type=all&view=list&status=watched&sort=title');
  await page.locator('main ul a[href^="#/works/"]').first().click();
  await page.waitForTimeout(400);
  const detailUrl = page.url();
  const before = (await page.getByRole('radio', { checked: true }).getAttribute('aria-label')) ?? '';
  const target = /星5つ/.test(before) ? '星1つ' : '星5つ';
  await page.getByRole('radio', { name: new RegExp(`^${target}`) }).click();
  await page.waitForTimeout(400);
  await shot(page, '04-detail', true);

  // 6. 視聴状態の変更（未確認 → 見ていない）
  await go(page, '/works?type=all&view=list&status=unconfirmed&sort=title');
  await page.locator('main ul a[href^="#/works/"]').first().click();
  await page.waitForTimeout(400);
  await shot(page, '05-detail-unconfirmed', true);
  await page.getByRole('button', { name: '見ていない' }).click();
  await page.waitForTimeout(400);

  // 7. 再読み込み後も保持
  await page.reload();
  await page.waitForTimeout(800);
  check('再読み込み後：状態変更（未確認→未視聴）が残る', /未視聴/.test(await page.locator('main').innerText()));
  await page.goto(detailUrl);
  await page.reload();
  await page.waitForTimeout(800);
  check(`再読み込み後：評価変更（${before.slice(0, 3)} → ${target}）が残る`, (await page.getByRole('radio', { name: new RegExp(`^${target}`) }).getAttribute('aria-checked')) === 'true');
  await go(page, '/works?type=all');
  check('再読み込み後：未確認 51・未視聴 2・全107件', (await tabCount(page, '未確認')) === '51' && (await tabCount(page, '未視聴')) === '2' && (await total(page)) === '107');

  // 8. 再インポートで重複しない
  const again = await importViaUi(page);
  check('再インポート：新規 0 件（重複しない）', /すべて取り込み済み|件を更新する/.test(again.label), again.label);
  await go(page, '/works?type=all');
  check('再インポート後も 107 件', (await total(page)) === '107');

  // 9. 見たいリスト：作品番号と見たい番号は別
  await go(page, '/watchlist');
  const wl = await page.locator('main ol > li').allInnerTexts();
  check('見たいリスト：3件・固定番号 No.1〜3', wl.length === 3 && wl.every((t, i) => new RegExp(`NO\\.\\s*${i + 1}\\b`, 'i').test(t)), `${wl.length}件`);
  await shot(page, '06-watchlist', true);
  await go(page, '/works?type=all&status=want&view=list&sort=title');
  const wantRows = (await page.locator('main ul a[href^="#/works/"]').allInnerTexts()).join(' ');
  check('見たい作品：作品番号 No.105〜107 と見たい番号 No.1〜3 を別々に表示', /No\.105/.test(wantRows) && /No\.107/.test(wantRows) && /見たい No\.1/.test(wantRows));

  // 10. 統計・カレンダー
  await go(page, '/stats?p=all');
  const kpi = (await page.locator('section[aria-label="全期間の概要"]').innerText()).replace(/\s+/g, ' ');
  check('統計（全期間）：評価 44 本で平均を表示', /平均評価 \d\.\d\d 評価 44 本/.test(kpi), kpi);
  await shot(page, '08-stats-all', true);
  await go(page, '/calendar?m=2026-11');
  await shot(page, '07-calendar', true);

  // 11. バックアップ → 別の端末に復元
  await go(page, '/settings');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'JSON で書き出す' }).click()]);
  const path = await download.path();
  const backup = JSON.parse(readFileSync(path, 'utf8'));
  check('バックアップ：107作品を含む', backup.data.works.length === 107);
  await shot(page, '10-settings', true);
  const other = await newPage(browser);
  await go(other.page, '/settings');
  await other.page.setInputFiles('label:has-text("JSON から読み込む") input[type=file]', path);
  await other.page.getByRole('button', { name: /現在のデータを置き換える|追加・更新する/ }).click();
  await other.page.getByRole('button', { name: /^(置き換える|インポート)$/ }).click();
  await other.page.waitForTimeout(800);
  const [dl2] = await Promise.all([other.page.waitForEvent('download'), other.page.getByRole('button', { name: 'JSON で書き出す' }).click()]);
  const restored = JSON.parse(readFileSync(await dl2.path(), 'utf8'));
  const key = (b) =>
    b.data.works
      .map((w) => {
        const u = b.data.userWorks.find((x) => x.workId === w.id);
        return `${w.catalogNo}|${w.legacyId}|${u?.status}|${u?.rating ?? '-'}`;
      })
      .sort()
      .join(',');
  check('復元：別の端末でも状態・評価・番号が一致', key(restored) === key(backup));
  await other.ctx.close();

  // 12. 375px で横スクロールなし
  const firstId = backup.data.works[0].id;
  const routes = ['/', '/works', '/works?view=list', `/works/${firstId}`, `/works/${firstId}/edit`, '/add', '/add?mode=manual', '/calendar', '/watchlist', '/stats', '/stats?p=year', '/stats?p=all', '/settings', '/settings/seed'];
  const bad = [];
  for (const r of routes) {
    await go(page, r);
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (o > 0) bad.push(`${r}:${o}px`);
  }
  check('375px：全14画面で横スクロールなし', bad.length === 0, bad.join(' ') || `${routes.length}画面`);
  await go(page, '/settings/seed');
  await page.setInputFiles('input[type=file]', [JSON_FILE, CSV_FILE]);
  await page.waitForTimeout(500);
  await shot(page, '03-import-preview', true);

  await ctx.close();
} finally {
  await browser.close();
}

check('コンソールエラーなし', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
