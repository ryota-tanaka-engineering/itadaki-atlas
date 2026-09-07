/**
 * ガイド本文（guide_translations.body_md）の最小Markdownパーサ。
 *
 * 依存を増やさない最小実装（`react-markdown` 等の依存はプロジェクトに未導入）。
 * 詳細ページ本文の `src/features/map/markdown.ts`（`parseBodyMarkdown`）は3章固定の
 * 章立て前提（`##` より前のテキストを捨てる）だが、ガイドは「見出しは自由」（章の数・
 * 見出し前の導入文も許す）ため、あちらは使わず本ファイルを新設した。
 *
 * 対応するのは `## ` / `### ` 見出し・段落・`**強調**`・`[文言](URL)` リンク・
 * `- ` 箇条書きのみ。dangerouslySetInnerHTML は使わず、ブロック/トークン列に
 * 分解してから呼び出し側（GuideBody.tsx）が通常のJSXとして描画する
 * （エスケープ漏れの余地をなくす）。
 */

export type InlineToken =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "link"; text: string; href: string };

export type GuideBlock =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "paragraph"; tokens: InlineToken[] }
  | { kind: "list"; items: InlineToken[][] };

const INLINE_RE = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(text))) {
    if (match.index > lastIndex) {
      tokens.push({ kind: "text", text: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      tokens.push({ kind: "bold", text: match[1] });
    } else {
      tokens.push({ kind: "link", text: match[2], href: match[3] });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    tokens.push({ kind: "text", text: text.slice(lastIndex) });
  }
  return tokens;
}

/** 見出しの数・見出し前の導入文も許す（3章固定の `parseBodyMarkdown` との違い）。 */
export function parseGuideMarkdown(bodyMd: string): GuideBlock[] {
  const lines = bodyMd.replace(/\r\n/g, "\n").split("\n");
  const blocks: GuideBlock[] = [];

  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const text = paragraphLines.join(" ").trim();
    if (text) blocks.push({ kind: "paragraph", tokens: parseInline(text) });
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({ kind: "list", items: listItems.map((item) => parseInline(item)) });
    listItems = [];
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", level: 3, text: line.slice(4).trim() });
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", level: 2, text: line.slice(3).trim() });
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      listItems.push(line.slice(2).trim());
      continue;
    }
    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }
    flushList();
    paragraphLines.push(line);
  }
  flushParagraph();
  flushList();

  return blocks;
}
