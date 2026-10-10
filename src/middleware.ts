import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { canonicalHostRedirect } from "./lib/hostRedirect";

/**
 * サブパス方式のロケール解決。
 * localeDetection は false（routing 側）なので、Accept-Language による
 * 自動リダイレクトは行わない。`/` は既定ロケールへ送るだけ。
 *
 * 2026-10-10: 旧ホスト（workers.dev）から正規ドメインへの 301 を先に判定する
 * （`src/lib/hostRedirect.ts`。SITE_URL が独自ドメインになった時点で自動で効く）。
 *
 * Next 16 では middleware.ts が非推奨で proxy.ts に改名されたが、OpenNext（Cloudflare）での
 * proxy の動作を確認するまで据え置く（.doc/99_management/02_backlog.md）。
 */
const intl = createMiddleware(routing);

/** ロケール解決の対象外だが、旧ホストからは転送したい公開ファイル */
const ROOT_FILES = new Set(["/sitemap.xml", "/robots.txt", "/llms.txt"]);

export default function middleware(request: NextRequest) {
  const to = canonicalHostRedirect(request.url, process.env.NEXT_PUBLIC_SITE_URL ?? "");
  if (to) return NextResponse.redirect(to, 301);
  if (ROOT_FILES.has(request.nextUrl.pathname)) return NextResponse.next();
  return intl(request);
}

export const config = {
  matcher: [
    // ルート（既定ロケールへ送る）
    "/",
    // 旧ホストからの 301 用（ロケール解決はしない）
    "/sitemap.xml",
    "/robots.txt",
    "/llms.txt",
    // 静的ファイル・API・タイルは対象外
    "/((?!api|_next|tiles|.*\\..*).*)",
  ],
};
