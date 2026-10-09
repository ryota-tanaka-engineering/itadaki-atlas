import { getTranslations } from "next-intl/server";

/**
 * サーバー側の系統名ラベル解決（labels.ts の `useMasterLabels().style` のサーバー版）。
 * messages.style → en のみ messages.styleNames → 生値 の順で落とす。辞書に無いキーを
 * t() に渡すと next-intl が "style.白身" の生キーを返して画面に出るため、必ず `has` で確かめる。
 * 「その他」はラーメン（4系統の外）とそれ以外（汎用の語）で言い分ける。
 */
export async function getStyleLabeler(locale: string) {
  const style = await getTranslations({ locale, namespace: "style" });
  const styleNames = await getTranslations({ locale, namespace: "styleNames" });
  const styleOther = await getTranslations({ locale, namespace: "styleOther" });

  return (v: string, genreSlug?: string | null): string => {
    if (v === "その他" && genreSlug && genreSlug !== "ramen") return styleOther("generic");
    if (style.has(v)) return style(v);
    if (locale === "en" && styleNames.has(v)) return styleNames(v);
    return v;
  };
}
