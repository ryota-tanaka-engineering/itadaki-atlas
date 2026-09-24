import { describe, expect, it } from "vitest";

import { countPrefContext } from "./prefContext";

const shelves = [
  { slug: "ramen", grp: "dish" as const },
  { slug: "seafood", grp: "ingredient" as const },
  { slug: "condiments", grp: "preparation" as const },
];

function item(shelfSlug: string, nameJa: string, nameRomaji = nameJa) {
  return { shelfSlug, nameJa, nameRomaji };
}

describe("countPrefContext", () => {
  it("shelves.grp で3群に数える", () => {
    const items = [
      item("ramen", "喜多方ラーメン", "Kitakata Ramen"),
      item("ramen", "郡山ブラック", "Koriyama Black"),
      item("seafood", "会津にしん", "Aizu Nishin"),
      item("condiments", "会津のこづゆ", "Aizu Kozuyu"),
    ];
    const result = countPrefContext(items, shelves);
    expect(result.dish.count).toBe(2);
    expect(result.ingredient.count).toBe(1);
    expect(result.preparation.count).toBe(1);
  });

  it("0件の群は0のまま返し、代表も空配列になる（呼び出し側で非表示にする）", () => {
    const items = [item("ramen", "喜多方ラーメン")];
    const result = countPrefContext(items, shelves);
    expect(result.dish).toEqual({
      count: 1,
      representatives: [{ nameJa: "喜多方ラーメン", nameRomaji: "喜多方ラーメン" }],
    });
    expect(result.ingredient).toEqual({ count: 0, representatives: [] });
    expect(result.preparation).toEqual({ count: 0, representatives: [] });
  });

  it("items が空なら全て0", () => {
    const result = countPrefContext([], shelves);
    expect(result.dish).toEqual({ count: 0, representatives: [] });
    expect(result.ingredient).toEqual({ count: 0, representatives: [] });
    expect(result.preparation).toEqual({ count: 0, representatives: [] });
  });

  it("shelves に無い shelfSlug はどの群にも数えない", () => {
    const items = [item("unknown-shelf", "謎の料理"), item("ramen", "喜多方ラーメン")];
    const result = countPrefContext(items, shelves);
    expect(result.dish.count).toBe(1);
    expect(result.ingredient.count).toBe(0);
    expect(result.preparation.count).toBe(0);
  });

  it("代表は visibleItems の並び順の先頭3件（ランキングにしない）", () => {
    const items = [
      item("ramen", "1番目"),
      item("ramen", "2番目"),
      item("ramen", "3番目"),
      item("ramen", "4番目"),
      item("ramen", "5番目"),
    ];
    const result = countPrefContext(items, shelves);
    expect(result.dish.count).toBe(5);
    expect(result.dish.representatives.map((r) => r.nameJa)).toEqual(["1番目", "2番目", "3番目"]);
  });

  it("件数が3以下なら代表はその全件（超過扱いは呼び出し側の count>3 判定に委ねる）", () => {
    const items = [item("ramen", "1番目"), item("ramen", "2番目")];
    const result = countPrefContext(items, shelves);
    expect(result.dish.count).toBe(2);
    expect(result.dish.representatives.map((r) => r.nameJa)).toEqual(["1番目", "2番目"]);
  });

  it("nameJa/nameRomaji の両方を代表に保持する（/en 表示用）", () => {
    const items = [item("seafood", "会津にしん", "Aizu Nishin")];
    const result = countPrefContext(items, shelves);
    expect(result.ingredient.representatives).toEqual([
      { nameJa: "会津にしん", nameRomaji: "Aizu Nishin" },
    ]);
  });
});
