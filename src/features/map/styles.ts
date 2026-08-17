/**
 * 系統色の定義。
 *
 * フェーズ1は写真・イラストを持たないため、**系統色がアイコンの役割を担う**
 * （.doc/30_features/02_ui_ux.md §5）。
 *
 * アクセシビリティ上、色だけに依存させない。ピンには必ず系統名テキストを併記する。
 */

export const PRIMARY_STYLES = ["醤油", "味噌", "塩", "豚骨", "その他"] as const;

export type PrimaryStyle = (typeof PRIMARY_STYLES)[number];

/** 系統ごとの色。実際のスープの色に寄せつつ、地図上で相互に判別できる明度差をつける。 */
export const STYLE_COLORS: Record<PrimaryStyle, string> = {
  醤油: "#8b4513",
  味噌: "#c1663b",
  塩: "#7fa8c9",
  豚骨: "#e8dcc8",
  その他: "#9a9a9a",
};

/** 白系の豚骨は縁取りが無いと背景に溶けるため、ピンには常に輪郭を付ける。 */
export const PIN_STROKE = "#3a2f27";

export function styleColor(style: string | null | undefined): string {
  if (style && (PRIMARY_STYLES as readonly string[]).includes(style)) {
    return STYLE_COLORS[style as PrimaryStyle];
  }
  return STYLE_COLORS["その他"];
}
