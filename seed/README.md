# seed/

アプリに同梱する初期データです。データが空の端末で初めて開いたときに自動で登録されます。

- `movie_tracker_full_catalog.csv`：全107作品（利用者の了承のもと公開・同梱）
- そのほかの `*.json`・`*.csv` は `.gitignore` 済み（置いた場合はローカルのビルドにだけ同梱されます）

実データで作業完了条件を確認: `npm run verify:seed`（GitHub の自動テストでも毎回実行）
