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
