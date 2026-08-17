import { defineRouting } from "next-intl/routing";

/**
 * i18n ルーティング（Platform ../.doc/10_system/10_growth_infra.md §3.2）。
 *
 * - **サブパス方式**（/ja/… /en/…）。SEO評価を1ドメインに集約する
 * - **自動リダイレクトはしない**（localeDetection: false）。
 *   ユーザーの意図とクローラの両方を壊すため。言語の切り替えは常に手動
 * - 対象言語は ja / en（.doc/10_system/10_growth_infra.md §2.1）
 */
export const routing = defineRouting({
  locales: ["ja", "en"],
  defaultLocale: "ja",
  localePrefix: "always",
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
