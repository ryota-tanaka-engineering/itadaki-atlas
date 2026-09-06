/**
 * 詳細ページ本文（food_item_translations.body_md）の最小Markdownパーサ。
 *
 * 依存を増やさない最小実装（CLAUDE.md「詳細ページの確定構造」3節）。対応するのは
 * `## 見出し`（章）・段落・`**強調**` のみ。dangerouslySetInnerHTML は使わず、
 * トークン列に分解してから呼び出し側で通常のJSXとして描画する（エスケープ漏れの余地をなくす）。
 *
 * 章立て前提の設計（ia-atlas-content Skill）のため、最初の `## ` より前のテキストは
 * 扱わない（本文はTier2以上のみで、そこでは必ず章から始まる運用）。
 */
export type InlineToken = { text: string; bold: boolean };
export type BodyParagraph = InlineToken[];
export type BodyChapter = {
  id: string;
  title: string;
  paragraphs: BodyParagraph[];
};

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    tokens.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex), bold: false });
  }
  return tokens;
}

export function parseBodyMarkdown(bodyMd: string): BodyChapter[] {
  const lines = bodyMd.replace(/\r\n/g, "\n").split("\n");
  const chapters: BodyChapter[] = [];
  let current: BodyChapter | null = null;
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (!current || paragraphLines.length === 0) {
      paragraphLines = [];
      return;
    }
    const text = paragraphLines.join(" ").trim();
    if (text) current.paragraphs.push(parseInline(text));
    paragraphLines = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      flushParagraph();
      current = { id: `ch-${chapters.length + 1}`, title: line.slice(3).trim(), paragraphs: [] };
      chapters.push(current);
      continue;
    }
    if (line === "") {
      flushParagraph();
      continue;
    }
    if (!current) continue; // 見出し前のテキストは扱わない
    paragraphLines.push(line);
  }
  flushParagraph();

  return chapters;
}

/**
 * 本文（body_md）の指定した章（0始まり）の冒頭の最初の1文を抜き出す
 * （ピン選択カード・トップの情報モジュールの判断材料用。
 * 作業パッケージ「トップページ改善」B節・「トップページ情報モジュール」§1/§4）。
 *
 * 全文をクライアントに送らないため、この関数でサーバー側（queries.ts）が
 * 切り出した短い文字列だけを MapItem/BrowseItem に持たせる（150件×全文はペイロード過大）。
 * 指定した章が存在しない（本文が無い・章数が足りない）場合は null を返す。
 */
export function excerptChapterSentence(bodyMd: string, chapterIndex: number): string | null {
  const chapters = parseBodyMarkdown(bodyMd);
  const chapter = chapters[chapterIndex];
  const firstParagraph = chapter?.paragraphs[0];
  if (!firstParagraph) return null;

  const text = firstParagraph.map((token) => token.text).join("").trim();
  if (!text) return null;

  // 句点（。/．/.）までを最初の1文とする。見つからなければ全文をそのまま返す
  // （短い段落で句点が無いケースもあるため）。
  const match = text.match(/^[^。．.]*[。．.]/);
  return match ? match[0] : text;
}

/** 1章目（見出し直後の章。ia-atlas-content の3章構成の1章目）の冒頭1文。 */
export function excerptFirstSentence(bodyMd: string): string | null {
  return excerptChapterSentence(bodyMd, 0);
}
