import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import {
  fetchGenres,
  fetchPrefsWithItems,
  fetchPublishedPaths,
  fetchShelves,
  fetchTagsWithCounts,
} from "@/features/map/queries";
import { SITE_URL } from "@/lib/seo";
import { PREF_SLUGS, type Prefecture } from "@/lib/prefectures";

/**
 * sitemap（.doc/30_features/01_requirements.md F-08）。
 * ロケールごとにURLを並べ、alternates で言語版を相互に示す。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [paths, genres, prefs, shelves, tags] = await Promise.all([
    fetchPublishedPaths(),
    fetchGenres(),
    fetchPrefsWithItems(),
    fetchShelves(),
    fetchTagsWithCounts(),
  ]);

  const entry = (path: string): MetadataRoute.Sitemap[number][] =>
    routing.locales.map((locale) => ({
      url: `${SITE_URL}/${locale}${path === "/" ? "" : path}`,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${SITE_URL}/${l}${path === "/" ? "" : path}`]),
        ),
      },
    }));

  // 棚に1件でもアイテムがあるかどうか。genre経由・棚直下（その他アイテム）どちらの
  // パスも publishedPaths の genreSlug 欄（実体は genreSlug か shelfSlug のどちらか）
  // に現れるため、genre→shelf の変換だけすれば漏れなく判定できる。
  const genreShelf = new Map(genres.map((g) => [g.slug, g.shelfSlug]));
  const shelfSlugsWithItems = new Set<string>();
  for (const p of paths) {
    shelfSlugsWithItems.add(genreShelf.get(p.genreSlug) ?? p.genreSlug);
  }

  return [
    ...entry("/"),
    ...entry("/about"),
    ...entry("/terms"),
    ...entry("/privacy"),
    ...entry("/contact"),
    ...entry("/tags"),
    // ジャンル・棚・地域・詳細・タグ。データを足すと sitemap も自動で伸びる
    ...genres.flatMap((g) => entry(`/${g.slug}`)),
    ...shelves.filter((s) => shelfSlugsWithItems.has(s.slug)).flatMap((s) => entry(`/${s.slug}`)),
    ...prefs.flatMap((pref) => entry(`/region/${PREF_SLUGS[pref as Prefecture]}`)),
    ...paths.flatMap((p) => entry(`/${p.genreSlug}/${p.slug}`)),
    ...tags.filter((tg) => tg.itemCount > 0).flatMap((tg) => entry(`/tag/${tg.slug}`)),
  ];
}
