"use client";

import { useTranslations } from "next-intl";

/**
 * マスタラベル（系統名・都道府県名）の表示。
 *
 * これらは DB でなく **アプリの i18n 辞書ファイル**で翻訳する
 * （Platform ../.doc/10_system/10_growth_infra.md §3.3 の二層方式）。
 * 有限の固定語彙で更新頻度が低く、型とビルド時チェックの恩恵を受けられるため。
 */
export function useMasterLabels() {
  const pref = useTranslations("prefecture");
  const style = useTranslations("style");

  return {
    prefecture: (v: string | null | undefined) => (v ? pref(v) : null),
    style: (v: string | null | undefined) => (v ? style(v) : null),
  };
}
