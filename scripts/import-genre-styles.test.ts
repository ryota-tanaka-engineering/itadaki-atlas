// @vitest-environment node
import { describe, expect, it } from "vitest";

import { genreStyleFileSchema, toDbRows } from "./import-genre-styles.ts";

const r = { genre: "ramen", style: "醤油", intro_ja: "醤油だれの清湯。", intro_en: "Soy-seasoned clear broth." };

describe("genreStyleFileSchema / toDbRows", () => {
  it("通常の行が通り、ロケールごとの2行に展開される", () => {
    const rows = genreStyleFileSchema.parse([r]);
    expect(toDbRows(rows)).toEqual([
      { genre_slug: "ramen", style: "醤油", locale: "ja", intro: "醤油だれの清湯。" },
      { genre_slug: "ramen", style: "醤油", locale: "en", intro: "Soy-seasoned clear broth." },
    ]);
  });

  it("sort_order があれば両ロケールの行に載る", () => {
    const rows = genreStyleFileSchema.parse([{ ...r, sort_order: 2 }]);
    expect(toDbRows(rows).map((x) => x.sort_order)).toEqual([2, 2]);
  });

  it("同じジャンル×系統の重複は弾く", () => {
    expect(genreStyleFileSchema.safeParse([r, r]).success).toBe(false);
  });

  it("ジャンル slug の形式違いは弾く", () => {
    expect(genreStyleFileSchema.safeParse([{ ...r, genre: "Ramen" }]).success).toBe(false);
  });
});

describe("data/genre-styles.json", () => {
  it("どの系統にも英語の系統名がある（無いと /en の見出しが日本語のまま出る）", async () => {
    const { readFileSync } = await import("node:fs");
    const rows = genreStyleFileSchema.parse(JSON.parse(readFileSync("data/genre-styles.json", "utf8")));
    const en = JSON.parse(readFileSync("messages/en.json", "utf8")) as {
      style?: Record<string, string>;
      styleNames?: Record<string, string>;
    };
    const missing = rows.map((r) => r.style).filter((s) => !en.styleNames?.[s] && !en.style?.[s]);
    expect(missing).toEqual([]);
  });
});
