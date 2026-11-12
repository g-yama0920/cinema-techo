# seed/

正式データをここに置くと、ビルド時にアプリへ同梱され、データが空の端末で初回起動したときに自動で登録されます。

- `movie_tracker_full_catalog.json`（正式データ）
- `movie_tracker_full_catalog.csv`（照合用・任意）

このフォルダの `*.json`・`*.csv` は `.gitignore` 済みです（個人データを誤ってコミットしないため）。

実データで作業完了条件を確認: `npm run verify:seed`
