import { describe, expect, it } from "vitest";

import { clip, prefLabel, sceneLabel } from "./ogLabels";

describe("ogLabels", () => {
  it("県名をロケールの辞書から引く", () => {
    expect(prefLabel("ja", "石川県")).toBe("石川県");
    expect(prefLabel("en", "石川県")).not.toBe("石川県");
    expect(prefLabel("en", "存在しない県")).toBe("存在しない県");
  });

  it("場面名を辞書から引き、未知の場面は slug のまま", () => {
    expect(sceneLabel("ja", "izakaya").name).toBe("居酒屋・焼き鳥屋");
    expect(sceneLabel("ja", "nope").name).toBe("nope");
  });

  it("clip は空白を詰め、長ければ省略記号で切る", () => {
    expect(clip("  a\n b ", 10)).toBe("a b");
    expect(clip("あいうえおかきくけこ", 5)).toBe("あいうえ…");
    expect(clip(null, 5)).toBeNull();
  });
});
