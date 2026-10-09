"use client";

import { useLocale, useTranslations } from "next-intl";

/**
 * マスタラベル（系統名・都道府県名）の表示。
 *
 * これらは DB でなく **アプリの i18n 辞書ファイル**で翻訳する
 * （Platform ../.doc/10_system/10_growth_infra.md §3.3 の二層方式）。
 * 有限の固定語彙で更新頻度が低く、型とビルド時チェックの恩恵を受けられるため。
 *
 * 系統（primary_style）は 2026-09-12 に自由値へ一般化したため、辞書に無い値が来る。
 * ジャンルページ（[genre]/page.tsx の translateStyle）と同じ順で落とす:
 * messages.style → en のみ messages.styleNames → 生値。辞書に無いキーを t() に渡すと
 * next-intl が "style.白身" の生キーを返して画面に出る（2026-09-26 体験検品の指摘）。
 */
export function useMasterLabels() {
  const locale = useLocale();
  const pref = useTranslations("prefecture");
  const style = useTranslations("style");
  const styleNames = useTranslations("styleNames");
  const styleOther = useTranslations("styleOther");

  return {
    prefecture: (v: string | null | undefined) => (v ? pref(v) : null),
    /**
     * `genreSlug` は「その他」の言い分けに使う。「4系統の外」はラーメンの4系統が前提の語
     * なので、ラーメン以外のジャンルの「その他」は汎用の語（styleOther.generic）にする。
     * ジャンル不明（undefined/null）はラーメン扱い（従来の既定）。
     */
    style: (v: string | null | undefined, genreSlug?: string | null) => {
      if (!v) return null;
      if (v === "その他" && genreSlug && genreSlug !== "ramen") return styleOther("generic");
      if (style.has(v)) return style(v);
      if (locale === "en" && styleNames.has(v)) return styleNames(v);
      return v;
    },
  };
}
