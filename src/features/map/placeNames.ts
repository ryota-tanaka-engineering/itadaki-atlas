import type { Locale } from "./queries";

/**
 * 市区町村名の他言語表記（`${pref}::${city}` → 表記名）。
 * 実際の取得（DBの place_names テーブル）は queries.ts の fetchPlaceNames が行う。
 *
 * ここには純粋関数のみを置き、queries.ts（@/lib/supabase/server = next/headers 依存）
 * から分離する。クライアントコンポーネント（BrowseShell）が値として安全に import
 * できるようにするため（mapPinKey を ./pinKey.ts に分離しているのと同じ理由。
 * queries.ts 冒頭のコメント参照）。
 */
export type PlaceNameMap = Record<string, string>;

/**
 * 市区町村名をロケール表記にする（実装部隊の報告「/en の本場・産地チップに市区町村名が
 * 日本語のまま（例 "Tokyo / 中央区"）」対応）。
 *
 * ja は常に日本語のまま返す（都道府県の英語化と同じく、市区町村の翻訳は en のみ）。
 * en で該当行が place_names に無ければ日本語のままフォールバックする
 * （多言語正規化がまだのデータでも壊れないようにするため）。
 */
export function translateCityName(
  pref: string,
  city: string,
  locale: Locale,
  placeNames: PlaceNameMap,
): string {
  if (locale === "ja") return city;
  const whole = placeNames[`${pref}::${city}`];
  if (whole) return whole;
  // 「神戸市・西宮市」のように複数の市を「・」で並べた値は、1つずつ引いて " / " でつなぐ
  if (city.includes("・")) {
    const parts = city.split("・").map((c) => placeNames[`${pref}::${c}`] ?? c);
    return parts.join(" / ");
  }
  return city;
}

/**
 * 英語の発祥地表記で、県名と市名が同じ綴りになる場合（福岡県福岡市＝Fukuoka / Fukuoka、
 * 京都府京都市＝Kyoto / Kyoto）を区別する。同綴りのときだけ市の種別を付けて
 * "Fukuoka City, Fukuoka" のようにする（市以外の同綴り、例: 区・町村は重複を1つにする）。
 * 同綴りでなければ null を返し、呼び出し側が通常の連結表記を使う。ja では使わない。
 */
export function disambiguateSameNameEn(prefEn: string, cityJa: string, cityEn: string): string | null {
  if (prefEn.trim().toLowerCase() !== cityEn.trim().toLowerCase()) return null;
  if (cityJa.endsWith("市")) return `${cityEn} City, ${prefEn}`;
  return prefEn;
}
