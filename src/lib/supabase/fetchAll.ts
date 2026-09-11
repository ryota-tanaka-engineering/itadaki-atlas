/**
 * PostgREST の既定行数上限（1,000）を越えて「全件」を取得するための共通ページングヘルパー。
 *
 * Supabase JS のクエリビルダーは `.range()` を明示しない限り既定で最大1,000行しか
 * 返さない。全件取得を想定したクエリ（食品アイテム全件・タグ横断集計等）にこれを
 * 付け忘れると、収録数が1,000件を超えた時点でサイレントに欠落する
 * （実装部隊の報告「トップで牛肉の部位を選ぶと30件のはずが19件」対応。
 * 収録1,867件到達で顕在化した）。
 *
 * 呼び出し側はクエリビルダーそのものではなく「範囲を受け取ってクエリを組み立てる関数」
 * を渡す。Supabase のクエリビルダーは `.range()` を呼ぶたびに内部の URL を書き換えて
 * 同じインスタンスを使い回せてしまうため、ページごとに `.from().select()...` から
 * 作り直す（`scripts/content-lint.ts` の `all()` と同じ方式）。
 */
export async function fetchAllRows<T>(
  buildPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  errorContext: string,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await buildPage(from, from + pageSize - 1);
    if (error) throw new Error(`${errorContext} failed: ${error.message}`);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return out;
}
