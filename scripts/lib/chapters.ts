/**
 * 詳細ページ本文（food_item_translations.body_md）の章見出し（ia-atlas-content Skill §4.5）。
 *
 * 3章（何でできているか／どう作るのか／なぜこの形になったのか）は必須・この順。
 * 2026-10 に4章目「どう食べるのか」（店でどう頼み、どう食べるか）を**任意の末尾章**として
 * 追加した（ユーザー決定「詳細の方に情報を厚くすべき」）。4章目は import-howto.ts が
 * 既存本文の末尾へ機械的に付け足す（部隊は見出し無しの本文だけを書く）。
 *
 * import-bodies.ts / import-howto.ts / content-lint.ts が同じ定数を使う（二重定義しない）。
 */
export const JA_CHAPTERS = ["## 何でできているか", "## どう作るのか", "## なぜこの形になったのか"] as const;
export const EN_CHAPTERS = ["## What it's made of", "## How it's made", "## Why it took this shape"] as const;

/** 任意の4章目（末尾固定）。 */
export const JA_HOWTO_HEADING = "## どう食べるのか";
export const EN_HOWTO_HEADING = "## How to eat it";

export type BodyLocale = "ja" | "en";

export function requiredChapters(locale: BodyLocale): readonly string[] {
  return locale === "ja" ? JA_CHAPTERS : EN_CHAPTERS;
}

export function howtoHeading(locale: BodyLocale): string {
  return locale === "ja" ? JA_HOWTO_HEADING : EN_HOWTO_HEADING;
}

/** 本文中の `## ` 見出し行を出現順に返す（前後の空白は落とす）。 */
export function chapterHeadings(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("## "));
}

/**
 * 章構成の検証。問題が無ければ null、あれば理由を返す。
 *
 * - 必須3章がこの順に揃っていること
 * - それ以外の見出しは4章目（どう食べるのか／How to eat it）だけ、かつ末尾に1つだけ
 */
export function validateChapters(body: string, locale: BodyLocale): string | null {
  const headings = chapterHeadings(body);
  const required = requiredChapters(locale);
  const howto = howtoHeading(locale);

  const unknown = headings.filter((h) => !required.includes(h) && h !== howto);
  if (unknown.length > 0) return `${locale}本文に規定外の見出しがあります: ${unknown.join(" / ")}`;

  const core = headings.filter((h) => h !== howto);
  if (core.length !== required.length || core.some((h, i) => h !== required[i])) {
    return `${locale}本文に3章の見出しがこの順で揃っていません（${required.join(" → ")}）`;
  }

  const howtoCount = headings.filter((h) => h === howto).length;
  if (howtoCount > 1) return `${locale}本文に4章目「${howto}」が複数あります`;
  if (howtoCount === 1 && headings[headings.length - 1] !== howto) {
    return `${locale}本文の4章目「${howto}」は末尾に置きます`;
  }
  return null;
}

/** 4章目を持つか（content-lint の集計用）。 */
export function hasHowtoChapter(body: string | null | undefined, locale: BodyLocale): boolean {
  if (!body) return false;
  return chapterHeadings(body).includes(howtoHeading(locale));
}

/**
 * 既存本文の末尾に4章目を付け足す（既にあれば差し替える）。
 *
 * 4章目は常に末尾なので、見出し行以降を切り落としてから新しい章を付ける。
 * 本文側の改行は `\n` に正規化し、章の前に空行を1つ置く（既存3章の区切りと同じ）。
 */
export function upsertHowtoChapter(body: string, locale: BodyLocale, howtoText: string): string {
  const heading = howtoHeading(locale);
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const idx = lines.findIndex((l) => l.trim() === heading);
  const base = (idx >= 0 ? lines.slice(0, idx) : lines).join("\n").replace(/\s+$/, "");
  const text = howtoText.replace(/\r\n/g, "\n").trim();
  return `${base}\n\n${heading}\n${text}\n`;
}
