import { describe, expect, it } from "vitest";

import type { BrowseItem, HonbaGroup } from "@/features/map/queries";

import { pickDailyItems, pickHonbaGroups } from "./dailyPicks";

function makeItem(slug: string, hasBody: boolean): BrowseItem {
  return {
    slug,
    nameJa: `${slug}-ja`,
    nameEn: `${slug}-en`,
    nameRomaji: `${slug}-romaji`,
    originPref: null,
    originCity: null,
    lat: 0,
    lng: 0,
    primaryStyle: null,
    itemType: "dish",
    genreSlug: "ramen",
    shelfSlug: "ramen",
    tagSlugs: [],
    hasBody,
  };
}

function makeHonbaGroup(
  slug: string,
  itemType: "dish" | "ingredient",
  shelfSlug: string,
): HonbaGroup {
  return {
    slug,
    nameJa: `${slug}-ja`,
    nameEn: `${slug}-en`,
    nameRomaji: `${slug}-romaji`,
    genreSlug: null,
    shelfSlug,
    itemType,
    cities: [{ pref: "東京都", city: null }],
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

describe("pickHonbaGroups", () => {
  it("空配列を渡すと空配列を返す", () => {
    expect(pickHonbaGroups([], new Date(2026, 8, 6))).toEqual([]);
  });

  it("上限件数を超えない", () => {
    const groups = Array.from({ length: 20 }, (_, i) => makeHonbaGroup(`item-${i}`, "dish", "ramen"));
    const picked = pickHonbaGroups(groups, new Date(2026, 8, 6), 6);
    expect(picked.length).toBeLessThanOrEqual(6);
  });

  it("魚介棚（seafood）は seafoodCap 件までしか含まれない", () => {
    // 魚介棚ばかりの母集団でも、cap を超えて選ばれない
    const groups = Array.from({ length: 10 }, (_, i) => makeHonbaGroup(`fish-${i}`, "dish", "seafood"));
    const picked = pickHonbaGroups(groups, new Date(2026, 8, 6), 6, 2);
    expect(picked.filter((g) => g.shelfSlug === "seafood")).toHaveLength(2);
  });

  it("料理（dish）を優先し、枠が余れば食材等で埋める", () => {
    const dishes = Array.from({ length: 3 }, (_, i) => makeHonbaGroup(`dish-${i}`, "dish", "noodles"));
    const ingredients = Array.from({ length: 3 }, (_, i) => makeHonbaGroup(`ing-${i}`, "ingredient", "beef"));
    const picked = pickHonbaGroups([...dishes, ...ingredients], new Date(2026, 8, 6), 6, 2);
    // dish が3件しかないので、残り3枠は ingredient で埋まる
    expect(picked.filter((g) => g.itemType === "dish")).toHaveLength(3);
    expect(picked.filter((g) => g.itemType === "ingredient")).toHaveLength(3);
  });

  it("同じ日付なら常に同じ結果になる（中立・ランキングではない）", () => {
    const groups = Array.from({ length: 15 }, (_, i) => makeHonbaGroup(`item-${i}`, "dish", "ramen"));
    const today = new Date(2026, 8, 6);
    const first = pickHonbaGroups(groups, today);
    const second = pickHonbaGroups(groups, today);
    expect(first.map((g) => g.slug)).toEqual(second.map((g) => g.slug));
  });

  it("日付が変わると通算日の剰余で構成が入れ替わる", () => {
    const groups = Array.from({ length: 15 }, (_, i) => makeHonbaGroup(`item-${i}`, "dish", "ramen"));
    const day1 = pickHonbaGroups(groups, new Date(2026, 8, 6));
    const day2 = pickHonbaGroups(groups, new Date(2026, 8, 7));
    expect(day1.map((g) => g.slug)).not.toEqual(day2.map((g) => g.slug));
  });

  it("本場が2箇所以上ある食べものを優先する", () => {
    const one = makeHonbaGroup("one", "dish", "noodles");
    const two = {
      ...makeHonbaGroup("two", "ingredient", "seafood"),
      cities: [
        { pref: "北海道", city: "釧路市" },
        { pref: "石川県", city: "金沢市" },
      ],
    };
    const three = {
      ...makeHonbaGroup("three", "dish", "rice"),
      cities: [
        { pref: "北海道", city: "小樽市" },
        { pref: "北海道", city: "函館市" },
      ],
    };
    const picked = pickHonbaGroups([one, two, three], new Date("2026-09-07"), 2);
    expect(picked.map((g) => g.slug).sort()).toEqual(["three", "two"]);
  });

  it("同じslugを重複して選ばない", () => {
    const groups = Array.from({ length: 6 }, (_, i) => makeHonbaGroup(`item-${i}`, "dish", "ramen"));
    const picked = pickHonbaGroups(groups, new Date(2026, 8, 6), 6);
    expect(new Set(picked.map((g) => g.slug)).size).toBe(picked.length);
  });
});
