import { describe, expect, it } from "vitest";

import { parseBodyMarkdown } from "./markdown";

describe("parseBodyMarkdown", () => {
  it("## 見出しごとに章へ分割する", () => {
    const chapters = parseBodyMarkdown(
      "## 何でできているか\n\n味噌とにんにく。\n\n## どう作るのか\n\n中華鍋を振る。",
    );
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("何でできているか");
    expect(chapters[1].title).toBe("どう作るのか");
  });

  it("章に一意なidを振る", () => {
    const chapters = parseBodyMarkdown("## A\n\n本文\n\n## B\n\n本文");
    expect(chapters.map((c) => c.id)).toEqual(["ch-1", "ch-2"]);
  });

  it("空行区切りで段落を分ける", () => {
    const chapters = parseBodyMarkdown("## 章\n\n一段落目。\n\n二段落目。");
    expect(chapters[0].paragraphs).toHaveLength(2);
  });

  it("**強調**を太字トークンに変換する", () => {
    const chapters = parseBodyMarkdown("## 章\n\n寒さが**保存食**を育てた。");
    const tokens = chapters[0].paragraphs[0];
    expect(tokens).toEqual([
      { text: "寒さが", bold: false },
      { text: "保存食", bold: true },
      { text: "を育てた。", bold: false },
    ]);
  });

  it("最初の見出しより前のテキストは無視する", () => {
    const chapters = parseBodyMarkdown("見出し前の余計な文。\n\n## 章\n\n本文。");
    expect(chapters).toHaveLength(1);
    expect(chapters[0].paragraphs).toHaveLength(1);
  });

  it("見出しが無ければ空配列を返す", () => {
    expect(parseBodyMarkdown("本文だけ。")).toEqual([]);
  });
});
