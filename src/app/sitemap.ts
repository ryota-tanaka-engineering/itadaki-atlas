import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { fetchGenres, fetchPrefsWithItems, fetchPublishedPaths } from "@/features/map/queries";
import { SITE_URL } from "@/lib/seo";
import { PREF_SLUGS, type Prefecture } from "@/lib/prefectures";

/**
 * sitemap（.doc/30_features/01_requirements.md F-08）。
 * ロケールごとにURLを並べ、alternates で言語版を相互に示す。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [paths, genres, prefs] = await Promise.all([
    fetchPublishedPaths(),
    fetchGenres(),
    fetchPrefsWithItems(),
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

  return [
    ...entry("/"),
    ...entry("/about"),
    // ジャンル・地域・詳細。データを足すと sitemap も自動で伸びる
    ...genres.flatMap((g) => entry(`/${g.slug}`)),
    ...prefs.flatMap((pref) => entry(`/region/${PREF_SLUGS[pref as Prefecture]}`)),
    ...paths.flatMap((p) => entry(`/${p.genreSlug}/${p.slug}`)),
  ];
}
