import { describe, expect, it } from "vitest";

import { englishGloss, joinDistinct } from "./names";

describe("englishGloss", () => {
  it("ローマ字と同じ英名は出さない", () => {
    expect(englishGloss("Aizu Ramen", "Aizu Ramen")).toBeNull();
    expect(englishGloss("aizu ramen ", "Aizu Ramen")).toBeNull();
  });

  it("先頭に同じ名前が付いた説明訳は、説明の部分だけを返す", () => {
    expect(
      englishGloss("Aizu Ramen — flat, curly hand-pulled noodles in clear soy broth", "Aizu Ramen"),
    ).toBe("flat, curly hand-pulled noodles in clear soy broth");
  });

  it("別の英名・説明訳はそのまま返す", () => {
    expect(englishGloss("Aizu-style sauce-dipped pork cutlet rice bowl", "Aizu Sôsu Katsudon")).toBe(
      "Aizu-style sauce-dipped pork cutlet rice bowl",
    );
  });

  it("空・未設定は null", () => {
    expect(englishGloss(null, "x")).toBeNull();
    expect(englishGloss("  ", "x")).toBeNull();
  });
});

describe("joinDistinct", () => {
  it("空と重複を除いて中黒でつなぐ", () => {
    expect(joinDistinct(["Aizu Ramen", null, "aizu ramen", "flat noodles"])).toBe("Aizu Ramen · flat noodles");
  });
});
