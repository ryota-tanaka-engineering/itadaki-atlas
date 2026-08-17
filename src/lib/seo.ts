import type { Metadata } from "next";

import { routing } from "@/i18n/routing";

/**
 * 公開URL。ドメイン取得前は暫定値を使う。
 * TODO: [ドメイン itadakiatlas.com 取得後に NEXT_PUBLIC_SITE_URL を設定する
 *        （.doc/10_system/02_infrastructure.md §6）]
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3300";

/**
 * hreflang（言語版の相互紐付け）。
 *
 * Platform 10_growth_infra.md §3.2 が要求する。サブパス方式なので
 * 同じパスをロケールごとに並べるだけでよい。
 *
 * @param path ロケールを除いたパス（先頭スラッシュ込み。例: "/ramen/sapporo"）
 */
export function localeAlternates(path: string): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = `/${locale}${path === "/" ? "" : path}`;
  }
  // x-default は既定ロケールを指す
  languages["x-default"] =
    `/${routing.defaultLocale}${path === "/" ? "" : path}`;

  return { languages };
}
