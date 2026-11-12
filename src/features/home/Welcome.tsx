import { Link } from 'react-router';
import { IconDownload, IconPlus, IconUpload } from '../../ui/icons';

/** 作品が1件もないときの最初の画面 */
export function Welcome() {
  return (
    <div className="pt-[calc(var(--safe-t)+28px)] md:pt-12">
      <h1 className="text-[44px] leading-none font-black tracking-tight text-red md:text-6xl">シネマ手帖</h1>
      <p className="mt-2 text-sm font-bold text-ink-soft">映画・ドラマ・アニメの記録帖</p>
      <p className="mt-5 text-[15px] leading-relaxed">
        見た作品・見たい作品・評価保留をひとつの手帖にまとめます。
        <br />
        データはこの端末のブラウザ内に保存され、外部には送信されません。
      </p>

      <ol className="mt-8 grid gap-3 md:grid-cols-3">
        <li>
          <Link to="/settings/seed" className="flex h-full min-h-28 flex-col rounded-lg border-l-4 border-red bg-paper-light p-4 hover:bg-paper-deep">
            <span className="num text-sm text-red">01</span>
            <span className="mt-1 flex items-center gap-2 text-lg font-bold">
              <IconUpload size={20} />
              既存の記録を取り込む
            </span>
            <span className="mt-1 text-sm text-ink-soft">movie_tracker_full_catalog.json を選ぶと、取り込み前に内容と件数を確認できます。</span>
          </Link>
        </li>
        <li>
          <Link to="/add" className="flex h-full min-h-28 flex-col rounded-lg bg-paper-light p-4 hover:bg-paper-deep">
            <span className="num text-sm text-red">02</span>
            <span className="mt-1 flex items-center gap-2 text-lg font-bold">
              <IconPlus size={20} />
              作品を1件追加する
            </span>
            <span className="mt-1 text-sm text-ink-soft">タイトルを入れるだけで登録できます。</span>
          </Link>
        </li>
        <li>
          <Link to="/settings" className="flex h-full min-h-28 flex-col rounded-lg bg-paper-light p-4 hover:bg-paper-deep">
            <span className="num text-sm text-red">03</span>
            <span className="mt-1 flex items-center gap-2 text-lg font-bold">
              <IconDownload size={20} />
              バックアップから復元
            </span>
            <span className="mt-1 text-sm text-ink-soft">以前に書き出した JSON ファイルから戻します。</span>
          </Link>
        </li>
      </ol>
    </div>
  );
}
