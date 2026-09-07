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
] as const;

export type GuideKind = (typeof GUIDE_KINDS)[number];

export function isGuideKind(value: string): value is GuideKind {
  return (GUIDE_KINDS as readonly string[]).includes(value);
}
