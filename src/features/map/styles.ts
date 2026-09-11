/**
 * ピン・系統色の定義（2026-08 デザイン確定。CLAUDE.md「デザイン」節が正典）。
 *
 * フェーズ1は写真・イラストを持たないため、**系統色がアイコンの役割を担う**
 * （.doc/30_features/02_ui_ux.md §5）。
 *
 * 2026-09: `dish_details.primary_style` をラーメン専用の固定4系統からジャンルごとの
 * 自由テキストへ一般化した（`.doc/20_data/01_models.md` §3.5）。この定数群はその中で
 * **ラーメン内部・単一ジャンル時のみ**の色分け識別軸として残る（CLAUDE.md「デザイン」節の
 * 系統色規定はラーメン限定のまま）。ラーメン以外の系統（洋食のピザ/パスタ等）は色分けを
 * 持たず、`styleColor()` はブランド橙（PIN_BASE）にフォールバックする。
 *
 * アクセシビリティ上、色だけに依存させない。ピンには必ず系統名テキストを併記する。
 */

/** ラーメンの主系統（UI色分け専用の4値）。DB上の primary_style はこれ以外の任意の値も持てる。 */
export const RAMEN_STYLES = ["醤油", "味噌", "塩", "豚骨"] as const;

export type RamenStyle = (typeof RAMEN_STYLES)[number];

/** ピンの基本色（系統を持たないアイテム全般・ラーメン以外の系統全般）。 */
export const PIN_BASE = "#ff8f00";

/** ピンの輪郭。白系の豚骨は縁取りが無いと背景に溶けるため、ピンには常に輪郭を付ける。 */
export const PIN_STROKE = "#5b4a37";

/** 系統ごとの色。ラーメンの内部識別にのみ使う。 */
export const RAMEN_STYLE_COLORS: Record<RamenStyle, string> = {
  醤油: "#b06a1f",
  味噌: "#e08a2e",
  塩: "#7fa8c9",
  豚骨: "#e8dcc8",
};

/** ラーメンの4系統なら専用色、それ以外（「その他」や他ジャンルの系統）はブランド橙。 */
export function styleColor(style: string | null | undefined): string {
  if (style && (RAMEN_STYLES as readonly string[]).includes(style)) {
    return RAMEN_STYLE_COLORS[style as RamenStyle];
  }
  return PIN_BASE;
}

/**
 * @deprecated 旧名（フェーズ1当時、系統がラーメンの4系統+その他に固定されていた頃の名前）。
 * `src/features/browse/axes.ts`（索引「系統」タブの並び順）が別部隊の編集対象につき
 * 触らずに残す後方互換エイリアス。色分けの参照には `RAMEN_STYLES` / `RAMEN_STYLE_COLORS`
 * を使うこと。
 */
export const PRIMARY_STYLES = [...RAMEN_STYLES, "その他"] as const;
