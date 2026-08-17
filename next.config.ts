import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// デフォルト: Cloudflare Workers（OpenNext経由）へのデプロイ用。
// NEXT_OUTPUT=standalone 指定時: ポータビリティ規約（standaloneでビルド可能な状態を
// 維持する）の確認・AWS移行（Docker化）用。
// 詳細: .doc/10_system/02_infrastructure.md §5 / ../.doc/10_system/02_infrastructure.md §3
const nextConfig: NextConfig = {
  // Playwright の webServer が 127.0.0.1 で叩くため、dev時のcross-origin警告を抑止する
  allowedDevOrigins: ["127.0.0.1"],
  ...(process.env.NEXT_OUTPUT === "standalone"
    ? { output: "standalone" as const }
    : {}),
};

export default withNextIntl(nextConfig);
