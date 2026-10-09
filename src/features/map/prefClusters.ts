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

/** 画面座標（px）上のクラスタ位置。 */
export type ClusterPoint = { x: number; y: number };

/** 円同士の間に最低限あける隙間（px）。 */
export const CLUSTER_GAP_PX = 5;

/**
 * 重なり緩和（表示位置だけをずらす）。位置の「真実」は重心のままで、ここは見た目だけ。
 * ペアごとの押し出しを反復する簡易版。反復回数は、絞り込み中の小さな地図帯（SP 38vh）で
 * 小さい県が密集しても収束するよう多めに取る。半径はクラスタごとに違う（件数の多い県は大きい段）。
 * 入力は変更せず、新しい配列を返す。
 */
export function relaxClusterPoints(
  points: ClusterPoint[],
  radii: number[],
  iterations = 24,
): ClusterPoint[] {
  const out = points.map((p) => ({ x: p.x, y: p.y }));
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const dx = out[j].x - out[i].x;
        const dy = out[j].y - out[i].y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const minDist = radii[i] + radii[j] + CLUSTER_GAP_PX;
        if (dist < minDist) {
          moved = true;
          const push = (minDist - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          out[i].x -= ux * push;
          out[i].y -= uy * push;
          out[j].x += ux * push;
          out[j].y += uy * push;
        }
      }
    }
    if (!moved) break;
  }
  return out;
}

/** 緩和後もなお重なっている（隙間が取れていない）クラスタの添字。 */
export function stillOverlapping(points: ClusterPoint[], radii: number[]): Set<number> {
  const result = new Set<number>();
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dist = Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y);
      // 緩和の収束誤差は許す（隙間 CLUSTER_GAP_PX のうち半分まで食い込んだら重なりとみなす）
      if (dist < radii[i] + radii[j] + CLUSTER_GAP_PX / 2) {
        result.add(i);
        result.add(j);
      }
    }
  }
  return result;
}
