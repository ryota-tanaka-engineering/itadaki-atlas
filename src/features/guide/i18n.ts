export type Locale = "ja" | "en";

/**
 * 指定ロケールの翻訳行を返す。未翻訳は **en → ja** の順でフォールバックする
 * （多言語追加時の設計。`food_item_translations` の en↔ja 逆転パターンとは意図的に異なる。
 * 詳細は `.doc/20_data/01_models.md` §3.10）。
 */
export function pickGuideTranslation<T extends { locale: string }>(
  translations: T[],
  locale: Locale,
): T | null {
  return (
    translations.find((t) => t.locale === locale) ??
    translations.find((t) => t.locale === "en") ??
    translations.find((t) => t.locale === "ja") ??
    null
  );
}
