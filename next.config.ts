import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// ポータビリティ規約（standaloneでビルド可能な状態を維持する）。
// 詳細: .doc/10_system/02_infrastructure.md §5 / ../.doc/10_system/02_infrastructure.md §3
//
// 常時 standalone にする（food-recommend と同じ方式。NEXT_OUTPUT分岐は廃止）。
// 理由: @opennextjs/cloudflare のビルドは常に NEXT_PRIVATE_STANDALONE=true を
// 内部的に強制する（output: "standalone" 相当）。この内部フラグと本設定の
// output値が食い違う状態（本設定側は未設定のまま）だと、Turbopackが
// src/features/browse/BrowseShell.tsx（Client Component）→
// src/features/map/queries.ts → src/lib/supabase/server.ts（next/headers使用）
// の依存を誤ってクライアントバンドルに含めようとしてビルドが失敗する
// （`opennextjs-cloudflare build` で再現、`next build` 単体では再現しない）。
// 本設定を常時 standalone にして内部フラグと一致させることで回避する。
const nextConfig: NextConfig = {
  // Playwright の webServer が 127.0.0.1 で叩くため、dev時のcross-origin警告を抑止する
  allowedDevOrigins: ["127.0.0.1"],
  output: "standalone",
};

export default withNextIntl(nextConfig);
