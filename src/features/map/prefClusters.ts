import type { MapPin } from "./queries";

/**
 * 県ごとの集約マーカー（2026-09 全国表示の作り直し）。
 *
 * 数字の数え方（CLUSTER_COUNT_IMPL_BRIEF.md 設計1）: `count` は**その県で生まれた件数**
 * （`kind === "origin"`）だけを数える。体験原則3「ラベルは分類名ではなく土地との関係で言う」
 * に沿い、シートの見出し件数（発祥アイテムのみ）と地図クラスタの数字を必ず一致させるため。
 * 本場（`kind === "honba"`）は数字に混ぜず、別枠の `honbaCount` として持つ（体験原則5
 * 「本場は数字に混ぜない」）。位置（重心）は発祥+本場の全ピンで計算する（位置の真実は変えない）。
 */
export type PrefCluster = {
  pref: string;
  lat: number;
  lng: number;
  /** その県で生まれた件数（`kind === "origin"`）。発祥ピンが1つも無い県は0。 */
  count: number;
  /** その県の本場ピン数（`kind === "honba"`）。 */
  honbaCount: number;
};

/**
 * 県座標マスタは新設せず、ピン群の重心をその場で計算する（データ駆動）。
 * `pins` は発祥ピン（kind='origin'）と本場ピン（kind='honba'）の合流データ
 * （MapView の `items` プロップとそのまま同じもの）。
 */
export function buildPrefClusters(pins: MapPin[]): PrefCluster[] {
  const byPref = new Map<string, MapPin[]>();
  for (const item of pins) {
    if (!item.originPref) continue;
    const list = byPref.get(item.originPref) ?? [];
    list.push(item);
    byPref.set(item.originPref, list);
  }
  return [...byPref.entries()].map(([pref, list]) => ({
    pref,
    lat: list.reduce((sum, i) => sum + i.lat, 0) / list.length,
    lng: list.reduce((sum, i) => sum + i.lng, 0) / list.length,
    count: list.filter((i) => i.kind === "origin").length,
    honbaCount: list.filter((i) => i.kind === "honba").length,
  }));
}
