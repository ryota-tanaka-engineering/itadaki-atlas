/**
 * ピン・系統色の定義（2026-08 デザイン確定。CLAUDE.md「デザイン」節が正典）。
 *
 * フェーズ1は写真・イラストを持たないため、**系統色がアイコンの役割を担う**
 * （.doc/30_features/02_ui_ux.md §5）。
 *
 * 系統色（醤油・味噌・塩・豚骨）は**ラーメン内部・単一ジャンル時のみ**の識別軸。
 * それ以外（系統を持たないラーメン・他ジャンル全て）はブランド橙（PIN_BASE）を使う。
 *
 * アクセシビリティ上、色だけに依存させない。ピンには必ず系統名テキストを併記する。
 */

export const PRIMARY_STYLES = ["醤油", "味噌", "塩", "豚骨", "その他"] as const;

export type PrimaryStyle = (typeof PRIMARY_STYLES)[number];

/** ピンの基本色（系統を持たないアイテム全般）。 */
export const PIN_BASE = "#ff8f00";

/** ピンの輪郭。白系の豚骨は縁取りが無いと背景に溶けるため、ピンには常に輪郭を付ける。 */
export const PIN_STROKE = "#5b4a37";

/** 系統ごとの色。ラーメンの内部識別にのみ使う。 */
export const STYLE_COLORS: Record<PrimaryStyle, string> = {
  醤油: "#b06a1f",
  味噌: "#e08a2e",
  塩: "#7fa8c9",
  豚骨: "#e8dcc8",
  その他: PIN_BASE,
};

export function styleColor(style: string | null | undefined): string {
  if (style && (PRIMARY_STYLES as readonly string[]).includes(style)) {
    return STYLE_COLORS[style as PrimaryStyle];
  }
  return PIN_BASE;
}
