import { describe, expect, it } from "vitest";

import { distanceFromTokyo, formatDegMinCoord, TOKYO_STATION } from "./geo";

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

describe("distanceFromTokyo", () => {
  it("札幌（データ投入値: 43.0618, 141.3545）は東京から北へ約830km", () => {
    // 実データ（data/ramen.csv の sapporo 行）と同じ座標で検証する
    expect(distanceFromTokyo(43.0618, 141.3545)).toEqual({ km: 830, direction: "N" });
  });

  it("博多（データ投入値: 33.5904, 130.4017）は東京から西へ約890km", () => {
    // 実データ（data/ramen.csv の hakata 行）と同じ座標で検証する
    expect(distanceFromTokyo(33.5904, 130.4017)).toEqual({ km: 890, direction: "W" });
  });

  it("東京駅そのもの（距離0）は null", () => {
    expect(distanceFromTokyo(TOKYO_STATION.lat, TOKYO_STATION.lng)).toBeNull();
  });

  it("30km未満（東京都内相当）は null", () => {
    // 東京駅から南へ約20km（八王子より近い都内相当の地点）
    expect(distanceFromTokyo(35.5, 139.767)).toBeNull();
  });
});
