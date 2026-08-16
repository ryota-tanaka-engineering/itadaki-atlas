import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("クラス名を結合する", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("falsy な値を除外する", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });

  it("競合する Tailwind クラスは後勝ちになる", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
