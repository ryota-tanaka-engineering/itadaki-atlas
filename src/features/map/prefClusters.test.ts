import { describe, expect, it } from "vitest";
import { buildPrefClusters, relaxClusterPoints, stillOverlapping } from "./prefClusters";
import type { MapPin } from "./queries";

/** テスト用の最小 MapPin。指定しなかったフィールドはダミー値で埋める。 */
function pin(overrides: Partial<MapPin> & Pick<MapPin, "slug" | "kind" | "originPref" | "lat" | "lng">): MapPin {
  return {
    nameJa: overrides.slug,
    nameEn: null,
    nameRomaji: overrides.slug,
    summary: null,
    originCity: null,
    primaryStyle: null,
    itemType: "dish",
    genreSlug: null,
    shelfSlug: "shelf",
    ...overrides,
  };
}

describe("buildPrefClusters（CLUSTER_COUNT_IMPL_BRIEF.md 設計1〜2）", () => {
  it("originのみの県: countはorigin件数、honbaCountは0", () => {
    const pins: MapPin[] = [
      pin({ slug: "a", kind: "origin", originPref: "福島県", lat: 37.5, lng: 140.1 }),
      pin({ slug: "b", kind: "origin", originPref: "福島県", lat: 37.7, lng: 140.3 }),
    ];
    const clusters = buildPrefClusters(pins);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toMatchObject({ pref: "福島県", count: 2, honbaCount: 0 });
  });

  it("originとhonbaが混在する県: countはoriginだけ、honbaCountはhonbaだけを数える", () => {
    const pins: MapPin[] = [
      pin({ slug: "a", kind: "origin", originPref: "福島県", lat: 37.5, lng: 140.1 }),
      pin({ slug: "b", kind: "origin", originPref: "福島県", lat: 37.6, lng: 140.2 }),
      pin({ slug: "c", kind: "honba", originPref: "福島県", lat: 37.7, lng: 140.3 }),
    ];
    const clusters = buildPrefClusters(pins);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toMatchObject({ pref: "福島県", count: 2, honbaCount: 1 });
  });

  it("発祥ピンが1つも無くhonbaピンだけの県: countは0、honbaCountはhonba件数（クラスタは残る）", () => {
    const pins: MapPin[] = [
      pin({ slug: "kaisendon", kind: "honba", originPref: "石川県", originCity: "金沢市", lat: 36.6, lng: 136.6 }),
    ];
    const clusters = buildPrefClusters(pins);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toMatchObject({ pref: "石川県", count: 0, honbaCount: 1 });
  });

  it("重心はorigin/honba両方を含む全ピンの平均座標（位置の真実は変えない）", () => {
    const pins: MapPin[] = [
      pin({ slug: "a", kind: "origin", originPref: "福島県", lat: 37.0, lng: 140.0 }),
      pin({ slug: "b", kind: "honba", originPref: "福島県", lat: 39.0, lng: 142.0 }),
    ];
    const clusters = buildPrefClusters(pins);
    expect(clusters[0].lat).toBeCloseTo(38.0);
    expect(clusters[0].lng).toBeCloseTo(141.0);
  });

  it("originPrefが無いピンは県クラスタから除外する", () => {
    const pins: MapPin[] = [pin({ slug: "a", kind: "origin", originPref: null, lat: 37.0, lng: 140.0 })];
    expect(buildPrefClusters(pins)).toHaveLength(0);
  });

  it("県が複数あるときはそれぞれ独立して数える", () => {
    const pins: MapPin[] = [
      pin({ slug: "a", kind: "origin", originPref: "福島県", lat: 37.0, lng: 140.0 }),
      pin({ slug: "b", kind: "honba", originPref: "石川県", lat: 36.6, lng: 136.6 }),
    ];
    const clusters = buildPrefClusters(pins);
    const byPref = new Map(clusters.map((c) => [c.pref, c]));
    expect(byPref.get("福島県")).toMatchObject({ count: 1, honbaCount: 0 });
    expect(byPref.get("石川県")).toMatchObject({ count: 0, honbaCount: 1 });
  });
});

describe("relaxClusterPoints / stillOverlapping（重なり緩和）", () => {
  const r = [11, 11, 11];

  it("重なっている3点を、半径+隙間以上に押し分ける", () => {
    const points = [
      { x: 100, y: 100 },
      { x: 104, y: 100 },
      { x: 102, y: 106 },
    ];
    const out = relaxClusterPoints(points, r);
    expect(stillOverlapping(out, r).size).toBe(0);
  });

  it("入力を書き換えない", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    relaxClusterPoints(points, [11, 11]);
    expect(points[1]).toEqual({ x: 1, y: 0 });
  });

  it("小さい点（半径7）にすると、密集して丸のままでは解けない配置も収まる", () => {
    // 6点を一辺16pxの狭い範囲に詰める（丸=半径11では解けない密度）
    const points = Array.from({ length: 6 }, (_, i) => ({ x: 100 + (i % 3) * 8, y: 100 + Math.floor(i / 3) * 8 }));
    const big = relaxClusterPoints(points, points.map(() => 11));
    const dots = relaxClusterPoints(points, points.map(() => 7));
    const bigOverlap = stillOverlapping(big, points.map(() => 11)).size;
    const dotOverlap = stillOverlapping(dots, points.map(() => 7)).size;
    expect(dotOverlap).toBeLessThanOrEqual(bigOverlap);
    expect(dotOverlap).toBe(0);
  });
});
