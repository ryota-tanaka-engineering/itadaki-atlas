/**
 * ガイドの種別（`guides.kind` の check 制約と同じ並び。migration・`ia-atlas-content` Skill参照）。
 *
 * 一覧ページ（`/guide`）の小見出し順、詳細ページ「他のガイド」の次kindの探索順として使う。
 */
export const GUIDE_KINDS = [
  "ordering",
  "paying",
  "manners",
  "finding",
  "takeaway",
  "seasons",
  "shopping",
  "food-town",
  "market",
  "festival",
  "beer-garden",
  "brewery-tour",
  "factory-tour",
] as const;

export type GuideKind = (typeof GUIDE_KINDS)[number];

export function isGuideKind(value: string): value is GuideKind {
  return (GUIDE_KINDS as readonly string[]).includes(value);
}

/**
 * 場所（pref/city/lat/lng）を持ちうる kind（2026-09-12「体験と場所」で追加した6種別）。
 * 一覧カードの県・市・when_note表示、詳細ページの位置帯表示の判定に使う
 * （`guides.pref`/`lat` は任意列のため、実際に値があるかは呼び出し側でさらに確認する）。
 */
export const PLACE_GUIDE_KINDS = [
  "food-town",
  "market",
  "festival",
  "beer-garden",
  "brewery-tour",
  "factory-tour",
] as const satisfies readonly GuideKind[];

export type PlaceGuideKind = (typeof PLACE_GUIDE_KINDS)[number];

export function isPlaceGuideKind(kind: GuideKind): kind is PlaceGuideKind {
  return (PLACE_GUIDE_KINDS as readonly string[]).includes(kind);
}
