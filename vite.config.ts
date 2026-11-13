import { existsSync, readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { tmdbDevProxy } from './server/vite-tmdb-plugin';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig(({ mode }) => {
  // VITE_ で始まらない変数（TMDB_*）はブラウザ向けのコードには埋め込まれない
  const env = loadEnv(mode, process.cwd(), 'TMDB_');
  return {
    // 相対パスにして、サブディレクトリに置いても動くようにする
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      // 静的な公開先（GitHub Pages など）では TMDb 中継サーバーが無いので確認しない（TMDB_PROXY=none でビルド）
      __TMDB_PROXY__: JSON.stringify(process.env.TMDB_PROXY !== 'none'),
      // TMDb の公式ロゴを public/brand/tmdb-logo.svg に置いた場合だけ表示する
      __HAS_TMDB_LOGO__: JSON.stringify(existsSync(new URL('./public/brand/tmdb-logo.svg', import.meta.url))),
      // seed/ の初期データを同梱して初回に自動登録する（テスト用に同梱しないビルドは SEED_BUNDLE=off）
      __BUNDLE_SEED__: JSON.stringify(process.env.SEED_BUNDLE !== 'off'),
    },
    plugins: [
      react(),
      tailwindcss(),
      tmdbDevProxy({ TMDB_READ_ACCESS_TOKEN: env.TMDB_READ_ACCESS_TOKEN, TMDB_API_KEY: env.TMDB_API_KEY }),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'brand/*'],
        manifest: {
          name: 'シネマ手帖 — 映画・ドラマ・アニメの記録',
          short_name: 'シネマ手帖',
          description: '映画・ドラマ・アニメの視聴記録と評価を管理する個人用アプリ',
          lang: 'ja',
          start_url: './',
          scope: './',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#141414',
          theme_color: '#141414',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // フォントは数が多いので事前キャッシュせず、使った分だけキャッシュする
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.destination === 'font',
              handler: 'CacheFirst',
              options: { cacheName: 'fonts', expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 365 } },
            },
            {
              urlPattern: ({ url }) => url.hostname === 'image.tmdb.org',
              handler: 'CacheFirst',
              options: {
                cacheName: 'tmdb-images',
                expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 90 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    server: { host: true },
  };
});
