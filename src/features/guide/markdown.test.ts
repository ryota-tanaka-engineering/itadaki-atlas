import { describe, expect, it } from "vitest";

import { parseGuideMarkdown } from "./markdown";

describe("parseGuideMarkdown", () => {
  it("見出し前のテキストも導入文として拾う（3章固定パーサとの違い）", () => {
    const blocks = parseGuideMarkdown("見出し前の導入文。\n\n## 見出し\n\n本文。");
    expect(blocks[0]).toEqual({
      kind: "paragraph",
      tokens: [{ kind: "text", text: "見出し前の導入文。" }],
    });
    expect(blocks[1]).toEqual({ kind: "heading", level: 2, text: "見出し" });
  });

  it("## と ### の両方を見出しとして扱う", () => {
    const blocks = parseGuideMarkdown("## 大見出し\n\n### 小見出し\n\n本文。");
    expect(blocks[0]).toEqual({ kind: "heading", level: 2, text: "大見出し" });
    expect(blocks[1]).toEqual({ kind: "heading", level: 3, text: "小見出し" });
  });

  it("空行区切りで段落を分ける", () => {
    const blocks = parseGuideMarkdown("一段落目。\n\n二段落目。");
    expect(blocks).toHaveLength(2);
  });

  it("**強調**を太字トークンに変換する", () => {
    const blocks = parseGuideMarkdown("券売機は**左上**が人気メニューのことが多い。");
    expect(blocks[0]).toEqual({
      kind: "paragraph",
      tokens: [
        { kind: "text", text: "券売機は" },
        { kind: "bold", text: "左上" },
        { kind: "text", text: "が人気メニューのことが多い。" },
      ],
    });
  });

  it("[文言](URL)をリンクトークンに変換する", () => {
    const blocks = parseGuideMarkdown("詳しくは[JNTO公式サイト](https://www.jnto.go.jp/en/)へ。");
    expect(blocks[0]).toEqual({
      kind: "paragraph",
      tokens: [
        { kind: "text", text: "詳しくは" },
        { kind: "link", text: "JNTO公式サイト", href: "https://www.jnto.go.jp/en/" },
        { kind: "text", text: "へ。" },
      ],
    });
  });

  it("- で始まる連続行を箇条書きブロックにする", () => {
    const blocks = parseGuideMarkdown("## 手順\n\n- 左上のボタン\n- 右上のボタン\n\n次の段落。");
    expect(blocks[1]).toEqual({
      kind: "list",
      items: [
        [{ kind: "text", text: "左上のボタン" }],
        [{ kind: "text", text: "右上のボタン" }],
      ],
    });
    expect(blocks[2]).toEqual({
      kind: "paragraph",
      tokens: [{ kind: "text", text: "次の段落。" }],
    });
  });

  it("空文字は空配列を返す", () => {
    expect(parseGuideMarkdown("")).toEqual([]);
  });
});
