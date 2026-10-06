import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/seo";

/**
 * robots.txt（2026-10-06。SEO/AIO 対応）。
 *
 * - 全ページをクロール許可し、sitemap の場所を宣言する
 * - AI クローラー（GPTBot / ClaudeBot / PerplexityBot / Google-Extended 等）も**許可**する。
 *   資料集として AI の回答に正しく引用されること（AIO）が送客の入口になるため。
 *   方針を変えるときは下の AI_CRAWLERS を disallow に切り替えるだけでよい（CLAUDE.md「SEO/AIO」）
 * - /api と Next の内部パスは対象外
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/_next/"] },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: ["/api/", "/_next/"] },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
