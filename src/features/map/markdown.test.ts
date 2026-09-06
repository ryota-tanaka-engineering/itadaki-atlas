import { describe, expect, it } from "vitest";

import { excerptChapterSentence, excerptFirstSentence, parseBodyMarkdown } from "./markdown";

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

describe("excerptFirstSentence", () => {
  it("1章目冒頭の最初の1文だけを抜き出す", () => {
    const bodyMd = "## 何でできているか\n\n味噌とにんにくが決め手。深いコクが特徴。\n\n二段落目。\n\n## どう作るのか\n\n中華鍋を振る。";
    expect(excerptFirstSentence(bodyMd)).toBe("味噌とにんにくが決め手。");
  });

  it("句点が無い短い段落は全文を返す", () => {
    expect(excerptFirstSentence("## 章\n\n句点なしの一文")).toBe("句点なしの一文");
  });

  it("太字トークンはプレーンテキストに戻して結合する", () => {
    expect(excerptFirstSentence("## 章\n\n寒さが**保存食**を育てた。次の文。")).toBe(
      "寒さが保存食を育てた。",
    );
  });

  it("見出しが無い（本文が無い扱いの）Markdownは null を返す", () => {
    expect(excerptFirstSentence("本文だけ。")).toBeNull();
  });
});

describe("excerptChapterSentence", () => {
  const bodyMd =
    "## 何でできているか\n\n1章目の文。\n\n## どう作るのか\n\n2章目の文。\n\n## なぜこの形になったのか\n\n3章目の文。次の文。";

  it("指定した章（0始まり）の冒頭の最初の1文を抜き出す", () => {
    expect(excerptChapterSentence(bodyMd, 2)).toBe("3章目の文。");
  });

  it("章0を指定すると excerptFirstSentence と同じ結果になる", () => {
    expect(excerptChapterSentence(bodyMd, 0)).toBe(excerptFirstSentence(bodyMd));
  });

  it("章数を超えるインデックスは null を返す", () => {
    expect(excerptChapterSentence(bodyMd, 5)).toBeNull();
  });

  it("見出しが無いMarkdownはどの章指定でも null を返す", () => {
    expect(excerptChapterSentence("本文だけ。", 0)).toBeNull();
  });
});
