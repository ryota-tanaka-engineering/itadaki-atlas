import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

/**
 * サブパス方式のロケール解決。
 * localeDetection は false（routing 側）なので、Accept-Language による
 * 自動リダイレクトは行わない。`/` は既定ロケールへ送るだけ。
 */
export default createMiddleware(routing);

export const config = {
  matcher: [
    // ルート（既定ロケールへ送る）
    "/",
    // 静的ファイル・API・タイルは対象外
    "/((?!api|_next|tiles|.*\\..*).*)",
  ],
};
