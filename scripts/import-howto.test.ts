// @vitest-environment node
import { describe, expect, it } from "vitest";

import { countWords, detailsPatch, howtoBundleSchema, rankingWordHits, softWarnings } from "./import-howto.ts";

const JA = "替え玉を頼める店が多い。".repeat(10); // 120字
const EN = "Many shops offer kaedama, a refill of noodles. ".repeat(12); // 96 words

function item(overrides: Record<string, unknown> = {}) {
  return {
    slug: "hakata",
    howto_ja: JA,
    howto_en: EN,
    noodle_thickness: "極細",
    noodle_curl: "ストレート",
    richness: 4,
    ...overrides,
  };
}

describe("howtoBundleSchema", () => {
  it("最小構成が通る", () => {
    const r = howtoBundleSchema.safeParse({ items: [item()] });
    expect(r.success).toBe(true);
  });

  it("見出し行を含む本文は弾く（見出しは投入時に機械で付く）", () => {
    const r = howtoBundleSchema.safeParse({ items: [item({ howto_ja: `## どう食べるのか\n${JA}` })] });
    expect(r.success).toBe(false);
  });

  it("麺の語彙外の値は弾く", () => {
    expect(howtoBundleSchema.safeParse({ items: [item({ noodle_thickness: "中太麺" })] }).success).toBe(false);
    expect(howtoBundleSchema.safeParse({ items: [item({ noodle_curl: "縮れ" })] }).success).toBe(false);
  });

  it("richness は 1〜5 の整数か null", () => {
    expect(howtoBundleSchema.safeParse({ items: [item({ richness: 6 })] }).success).toBe(false);
    expect(howtoBundleSchema.safeParse({ items: [item({ richness: 2.5 })] }).success).toBe(false);
    expect(howtoBundleSchema.safeParse({ items: [item({ richness: null })] }).success).toBe(true);
  });

  it("属性は省略・空文字・null のいずれでも通る（不明は埋めない）", () => {
    const r = howtoBundleSchema.safeParse({
      items: [item({ noodle_thickness: "", noodle_curl: null, richness: undefined })],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(detailsPatch(r.data.items[0])).toEqual({});
  });
});

describe("detailsPatch", () => {
  it("null の項目は送らない（既存の値を上書きしない）", () => {
    const r = howtoBundleSchema.parse({ items: [item({ noodle_curl: null })] });
    expect(detailsPatch(r.items[0])).toEqual({ noodle_thickness: "極細", richness: 4 });
  });
});

describe("softWarnings / rankingWordHits", () => {
  it("字数・語数の目安から外れると警告し、範囲内なら何も言わない", () => {
    const ok = howtoBundleSchema.parse({ items: [item({ howto_ja: "あ".repeat(200), howto_en: "word ".repeat(100) })] });
    expect(softWarnings(ok)).toEqual([]);
    const short = howtoBundleSchema.parse({ items: [item({ howto_ja: "短い。", howto_en: "Too short." })] });
    expect(softWarnings(short)).toHaveLength(2);
  });

  it("slug の重複を警告する", () => {
    const b = howtoBundleSchema.parse({ items: [item({ howto_ja: "あ".repeat(200), howto_en: "word ".repeat(100) }), item({ howto_ja: "あ".repeat(200), howto_en: "word ".repeat(100) })] });
    expect(softWarnings(b)).toEqual(["hakata: slug が重複"]);
  });

  it("格付け語を検出する", () => {
    const b = howtoBundleSchema.parse({ items: [item({ howto_ja: "日本三大ラーメンの一つとされ、人気No.1。" })] });
    expect(rankingWordHits(b)).toEqual(["hakata: 三大・No.1・人気No"]);
  });

  it("countWords は空白区切りで数える", () => {
    expect(countWords("  a b   c ")).toBe(3);
  });
});
