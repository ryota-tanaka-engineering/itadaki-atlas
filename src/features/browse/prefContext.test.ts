import { describe, expect, it } from "vitest";

import { countPrefContext } from "./prefContext";

const shelves = [
  { slug: "ramen", grp: "dish" as const },
  { slug: "seafood", grp: "ingredient" as const },
  { slug: "condiments", grp: "preparation" as const },
];

describe("countPrefContext", () => {
  it("shelves.grp で3群に数える", () => {
    const items = [
      { shelfSlug: "ramen" },
      { shelfSlug: "ramen" },
      { shelfSlug: "seafood" },
      { shelfSlug: "condiments" },
    ];
    expect(countPrefContext(items, shelves)).toEqual({ dish: 2, ingredient: 1, preparation: 1 });
  });

  it("0件の群は0のまま返す（呼び出し側で非表示にする）", () => {
    const items = [{ shelfSlug: "ramen" }];
    expect(countPrefContext(items, shelves)).toEqual({ dish: 1, ingredient: 0, preparation: 0 });
  });

  it("items が空なら全て0", () => {
    expect(countPrefContext([], shelves)).toEqual({ dish: 0, ingredient: 0, preparation: 0 });
  });

  it("shelves に無い shelfSlug はどの群にも数えない", () => {
    const items = [{ shelfSlug: "unknown-shelf" }, { shelfSlug: "ramen" }];
    expect(countPrefContext(items, shelves)).toEqual({ dish: 1, ingredient: 0, preparation: 0 });
  });
});
