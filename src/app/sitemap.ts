import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { fetchPublishedPaths } from "@/features/map/queries";
import { SITE_URL } from "@/lib/seo";

/**
 * sitemap（.doc/30_features/01_requirements.md F-08）。
 * ロケールごとにURLを並べ、alternates で言語版を相互に示す。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = await fetchPublishedPaths();

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
    ...paths.flatMap((p) => entry(`/${p.genreSlug}/${p.slug}`)),
  ];
}
