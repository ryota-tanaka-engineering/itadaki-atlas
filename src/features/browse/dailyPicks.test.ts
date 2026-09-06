import { describe, expect, it } from "vitest";

import type { BrowseItem } from "@/features/map/queries";

import { pickDailyItems } from "./dailyPicks";

function makeItem(slug: string, hasBody: boolean): BrowseItem {
  return {
    slug,
    nameJa: `${slug}-ja`,
    nameEn: `${slug}-en`,
    nameRomaji: `${slug}-romaji`,
    summary: null,
    originPref: null,
    originCity: null,
    lat: 0,
    lng: 0,
    primaryStyle: null,
    itemType: "dish",
    genreSlug: "ramen",
    shelfSlug: "ramen",
    tags: [],
    bodyExcerpt: hasBody ? `${slug}の一文。` : null,
    bodyExcerptCh3: hasBody ? `${slug}の3章の一文。` : null,
  };
}

describe("pickDailyItems", () => {
  it("本文を持つアイテムが無ければ dish=null, stories=[] を返す", () => {
    const items = [makeItem("a", false), makeItem("b", false)];
    expect(pickDailyItems(items, new Date(2026, 8, 6))).toEqual({ dish: null, stories: [] });
  });

  it("本文を持たないアイテムは母集団から除外する", () => {
    const items = [makeItem("a", true), makeItem("b", false), makeItem("c", true)];
    const { dish, stories } = pickDailyItems(items, new Date(2026, 8, 6));
    expect(dish).not.toBeNull();
    expect(["a", "c"]).toContain(dish!.slug);
    for (const s of stories) expect(["a", "c"]).toContain(s.slug);
  });

  it("同じ日付なら常に同じ結果になる（サーバー側で決定・中立）", () => {
    const items = Array.from({ length: 10 }, (_, i) => makeItem(`item-${i}`, true));
    const today = new Date(2026, 8, 6);
    const first = pickDailyItems(items, today);
    const second = pickDailyItems(items, today);
    expect(first.dish?.slug).toBe(second.dish?.slug);
    expect(first.stories.map((s) => s.slug)).toEqual(second.stories.map((s) => s.slug));
  });

  it("日付が変わると通算日の剰余で選ぶアイテムが送り出される", () => {
    const items = Array.from({ length: 10 }, (_, i) => makeItem(`item-${i}`, true));
    const day1 = pickDailyItems(items, new Date(2026, 8, 6));
    const day2 = pickDailyItems(items, new Date(2026, 8, 7));
    expect(day1.dish?.slug).not.toBe(day2.dish?.slug);
  });

  it("「土地の物語から」は今日の一皿と重複しない、最大 storyCount 件になる", () => {
    const items = Array.from({ length: 10 }, (_, i) => makeItem(`item-${i}`, true));
    const { dish, stories } = pickDailyItems(items, new Date(2026, 8, 6), 3);
    expect(stories).toHaveLength(3);
    const slugs = stories.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(3);
    expect(slugs).not.toContain(dish?.slug);
  });

  it("母集団が storyCount+1 未満のときは重複なく取れるだけ返す（無限ループしない）", () => {
    const items = [makeItem("a", true), makeItem("b", true)];
    const { dish, stories } = pickDailyItems(items, new Date(2026, 8, 6), 3);
    expect(stories.length).toBeLessThanOrEqual(1);
    expect(stories.every((s) => s.slug !== dish?.slug)).toBe(true);
  });

  it("母集団が1件だけのときは stories が空になる", () => {
    const items = [makeItem("only", true)];
    const { dish, stories } = pickDailyItems(items, new Date(2026, 8, 6));
    expect(dish?.slug).toBe("only");
    expect(stories).toEqual([]);
  });
});
