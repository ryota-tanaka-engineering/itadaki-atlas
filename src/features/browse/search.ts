/**
 * トップの検索窓（作業パッケージ「トップ導線修正」A節）。
 *
 * 一致は部分一致・大文字小文字無視・全角半角スペース除去・ひらがな⇄カタカナの
 * 相互一致で行う。NFKC正規化で全角英数字・半角カタカナも通常の表記へ吸収したうえで、
 * カタカナをひらがなへ揃えて比較する（クエリ・対象の両方に同じ変換を通すため
 * 「ラーメン」と「らーめん」のどちらで入力しても一致する）。
 *
 * サーバー境界を持たない純関数のみ（DB/フックに依存しない）。BrowseShell から
 * クライアント側の絞り込みとして呼ばれる。
 */

const KATAKANA_START = 0x30a1; // ァ
const KATAKANA_END = 0x30f6; // ヶ
const HIRAGANA_START = 0x3041; // ぁ
const KANA_OFFSET = KATAKANA_START - HIRAGANA_START;

/** カタカナ1文字をひらがなへ変換する（対象範囲外はそのまま返す）。 */
function katakanaToHiragana(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    out += code >= KATAKANA_START && code <= KATAKANA_END
      ? String.fromCodePoint(code - KANA_OFFSET)
      : ch;
  }
  return out;
}

/**
 * 検索クエリ・対象文字列を比較可能な形へ正規化する。
 * NFKC（全角英数字・半角カナ等を統一）→ 空白除去（半角/全角）→ 小文字化 → カタカナ→ひらがな。
 */
export function normalizeSearchText(input: string): string {
  return katakanaToHiragana(
    input.normalize("NFKC").replace(/[\s　]+/g, "").toLowerCase(),
  );
}

/**
 * クエリが対象文字列のいずれかに部分一致するか。
 * クエリが空（正規化後に空文字になる場合を含む）なら常に true（絞り込み無し）。
 */
export function matchesSearchQuery(
  query: string,
  ...targets: (string | null | undefined)[]
): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  return targets.some((target) => target != null && normalizeSearchText(target).includes(q));
}
