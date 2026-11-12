import { Link, useRouteError } from 'react-router';

export function NotFound({ crashed = false }: { crashed?: boolean }) {
  const error = useRouteError() as Error | undefined;
  return (
    <div className="mx-auto max-w-lg px-4 pt-16">
      <p className="kicker text-red">{crashed ? 'Error' : '404'}</p>
      <h1 className="font-display text-3xl">{crashed ? '表示中に問題が起きました' : 'ページが見つかりません'}</h1>
      <div className="rule-double mt-3" />
      {crashed && error?.message && <p className="mt-4 text-sm text-ink-soft">{error.message}</p>}
      <p className="mt-4 text-sm">保存済みのデータは消えていません。</p>
      <Link to="/" className="mt-6 inline-flex min-h-12 items-center border border-ink bg-ink px-5 font-bold text-paper">
        ホームへ戻る
      </Link>
    </div>
  );
}
