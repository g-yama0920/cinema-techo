/**
 * 重複チェック用のタイトル正規化。
 * 全角半角・大文字小文字・空白・記号の揺れを吸収するが、
 * 一致しても自動統合はせず「候補」として提示するだけにする。
 */
export function titleKey(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s　]+/g, '')
    .replace(/[・･:：\-‐―—~〜!！?？。、,.「」『』（）()[\]【】'"“”‘’]/g, '')
    .trim();
}

export function uniqueStrings(list: Iterable<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const s = (raw ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** 「a, b、c」形式をリストへ */
export function splitList(input: string): string[] {
  return uniqueStrings(input.split(/[,、，\n/／]/));
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function padNo(n: number, width = 3): string {
  return String(n).padStart(width, '0');
}
