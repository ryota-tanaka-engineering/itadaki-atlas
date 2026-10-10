// @vitest-environment node
import { describe, expect, it } from "vitest";

import { countByStyle, styleFileSchema, stylesWithoutIntro } from "./import-primary-styles.ts";

const file = {
  genre: "sushi",
  items: [
    { slug: "nigiri-zushi", style: "握り" },
    { slug: "maki-zushi", style: "巻き" },
    { slug: "edomae-zushi", style: "握り" },
  ],
};

describe("styleFileSchema", () => {
  it("通常の形が通る", () => {
    expect(styleFileSchema.safeParse(file).success).toBe(true);
  });

  it("slug の重複は弾く", () => {
    expect(styleFileSchema.safeParse({ ...file, items: [...file.items, file.items[0]] }).success).toBe(false);
  });

  it("21字以上の系統は DB の CHECK と同じく弾く", () => {
    expect(styleFileSchema.safeParse({ genre: "sushi", items: [{ slug: "a", style: "あ".repeat(21) }] }).success).toBe(false);
  });
});

describe("countByStyle / stylesWithoutIntro", () => {
  it("系統ごとの件数を出現順で数える", () => {
    expect(countByStyle(styleFileSchema.parse(file))).toEqual([
      ["握り", 2],
      ["巻き", 1],
    ]);
  });

  it("そのジャンルの一文が無い系統を返す（他ジャンルの同名系統は数えない）", () => {
    const styles = [
      { genre: "sushi", style: "握り" },
      { genre: "ramen", style: "巻き" },
    ];
    expect(stylesWithoutIntro(styleFileSchema.parse(file), styles)).toEqual(["巻き"]);
  });
});
