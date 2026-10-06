import type { Metadata } from "next";

import { routing } from "@/i18n/routing";

/**
 * 公開URL（sitemap・OGP・canonical・JSON-LD の絶対URLの基点）。
 *
 * 本番は scripts/deploy-prod.sh が NEXT_PUBLIC_SITE_URL を注入する（既定は workers.dev、
 * `.env.production.local` で上書き）。未設定だと localhost になり、本番の sitemap と OGP が
 * 検索エンジンから読めない URL を指すので、ビルド時の注入を必ず通す（2026-10-06 に判明）。
 * TODO: [ドメイン itadakiatlas.com 取得後に本番の既定値を差し替える（.doc/10_system/02_infrastructure.md §6）]
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3300";

/** ロケールを除いたパスを、ロケール付きの絶対URLにする（JSON-LD・llms.txt 用）。 */
export function absoluteUrl(locale: string, path: string): string {
  return `${SITE_URL}/${locale}${path === "/" ? "" : path}`;
}

/**
 * hreflang（言語版の相互紐付け）と canonical。
 *
 * Platform 10_growth_infra.md §3.2 が要求する。サブパス方式なので
 * 同じパスをロケールごとに並べるだけでよい。
 *
 * canonical（2026-10-06 追加）: ロケールを渡すと自ページの正規URLを出す。クエリ付き URL や
 * 大文字小文字違いの重複を1本に寄せるため。metadataBase（layout）があるので相対パスでよい。
 *
 * @param path ロケールを除いたパス（先頭スラッシュ込み。例: "/ramen/sapporo"）
 * @param locale 現在のロケール（省略時は canonical を出さない）
 */
export function localeAlternates(path: string, locale?: string): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = `/${l}${path === "/" ? "" : path}`;
  }
  // x-default は既定ロケールを指す
  languages["x-default"] =
    `/${routing.defaultLocale}${path === "/" ? "" : path}`;

  return locale
    ? { canonical: `/${locale}${path === "/" ? "" : path}`, languages }
    : { languages };
}
