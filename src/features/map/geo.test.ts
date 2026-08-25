import { describe, expect, it } from "vitest";

import { formatDegMinCoord } from "./geo";

describe("formatDegMinCoord", () => {
  it("札幌の座標を度分形式にする", () => {
    // 札幌市（北緯43.0621度・東経141.3544度）付近
    expect(formatDegMinCoord(43.0621, 141.3544)).toBe("43°04′N 141°21′E");
  });

  it("南緯・西経も符号から半球記号に変換する", () => {
    expect(formatDegMinCoord(-33.5, -70.5)).toBe("33°30′S 70°30′W");
  });

  it("分の丸めで60分になったら度へ繰り上げる", () => {
    expect(formatDegMinCoord(43.999, 141.0)).toBe("44°00′N 141°00′E");
  });
});
