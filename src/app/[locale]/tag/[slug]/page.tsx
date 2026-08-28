import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { CoverHeader } from "@/components/CoverHeader";
import {
  fetchRelatedTags,
  fetchShelves,
  fetchTag,
  fetchTagItems,
  type Locale,
} from "@/features/map/queries";
import { localeAlternates } from "@/lib/seo";

/**
 * タグ詳細ページ（`/tag/[slug]`）。
 *
 * タグは棚を跨ぐため、各行に棚/ジャンル表記を添える。末尾の「近いタグ」で
 * 行き止まりを避け、`/tags` へも戻れるようにする（CLAUDE.md参照）。
 */
type Params = { locale: string; slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  const tag = await fetchTag(slug);
  if (!tag) return {};
  const name = locale === "ja" ? tag.nameJa : tag.nameEn;
  return {
    title: name,
    description: tag.definition,
    alternates: localeAlternates(`/tag/${slug}`),
  };
}

export default async function TagPage({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const tag = await fetchTag(slug);
  if (!tag) notFound();

  const t = await getTranslations("tag");
  const isJa = locale === "ja";

  const [items, relatedTags, shelves] = await Promise.all([
    fetchTagItems(slug, locale as Locale),
    fetchRelatedTags(slug, tag.kind),
    fetchShelves(),
  ]);

  const shelfName = new Map(shelves.map((s) => [s.slug, isJa ? s.nameJa : s.nameEn]));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-8 md:max-w-3xl">
      <div className="px-4 md:px-0">
        <CoverHeader
          title={isJa ? tag.nameJa : tag.nameEn}
          subtitle={isJa ? tag.nameEn : tag.nameJa}
          meta={`${tag.definition} ・ ${t("count", { count: items.length })}`}
        />
      </div>

      <div className="px-4 pt-8 md:px-0">
        <section className="mb-10">
          <ul className="divide-border divide-y">
            {items.map((item) => {
              const breadcrumb = item.genreNameJa
                ? `${shelfName.get(item.shelfSlug) ?? item.shelfSlug} ── ${isJa ? item.genreNameJa : item.genreNameEn}`
                : (shelfName.get(item.shelfSlug) ?? item.shelfSlug);
              return (
                <li key={item.slug}>
                  <Link
                    href={`/${item.genreSlug ?? item.shelfSlug}/${item.slug}`}
                    className="hover:bg-muted/40 -mx-2 block rounded-md px-2 py-3 transition-colors"
                  >
                    <span className="text-muted-foreground block text-xs">{breadcrumb}</span>
                    <span className="block font-medium">{isJa ? item.nameJa : item.nameRomaji}</span>
                    <span className="text-muted-foreground block text-xs">
                      {item.nameJa} — {item.nameRomaji}
                      {item.nameEn ? ` — ${item.nameEn}` : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {relatedTags.length > 0 && (
          <section className="border-border mb-8 border-t pt-6">
            <h2 className="mb-3 text-sm font-semibold">{t("relatedTitle")}</h2>
            <ul className="flex flex-wrap gap-2">
              {relatedTags.map((rt) => (
                <li key={rt.slug}>
                  <Link
                    href={`/tag/${rt.slug}`}
                    className="bg-muted text-muted-foreground hover:bg-muted/70 inline-block rounded-full px-3 py-1 text-xs"
                  >
                    {isJa ? rt.nameJa : rt.nameEn}
                    <span className="ml-1">{rt.itemCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mb-8">
          <Link href="/tags" className="text-sm underline">
            {t("allTagsLink")}
          </Link>
        </p>
      </div>

      <div className="px-4 md:px-0">
        <SiteFooter locale={locale} />
      </div>
    </main>
  );
}
