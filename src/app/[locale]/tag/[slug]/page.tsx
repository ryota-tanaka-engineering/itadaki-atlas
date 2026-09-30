import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SiteFooter } from "@/components/SiteFooter";
import { CoverHeader } from "@/components/CoverHeader";
import { IndexRow } from "@/components/IndexRow";
import { SectionHeading } from "@/components/SectionHeading";
import { LabelChip } from "@/components/ui/chip";
import { ArrowLink, LinkCloud } from "@/components/ui/text-link";
import {
  fetchRelatedTags,
  fetchShelves,
  fetchTag,
  fetchTagItems,
  type Locale,
} from "@/features/map/queries";
import { localeAlternates } from "@/lib/seo";
import { englishGloss } from "@/lib/names";

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
  const th = await getTranslations("header");
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
          eyebrow={th("navInterest")}
          title={isJa ? tag.nameJa : tag.nameEn}
          subtitle={isJa ? tag.nameEn : tag.nameJa}
          meta={`${tag.definition} ・ ${t("count", { count: items.length })}`}
        />
      </div>

      <div className="px-4 pt-stack md:px-0">
        <section className="mb-section">
          <ul className="divide-rule divide-y">
            {items.map((item) => {
              const breadcrumb = item.genreNameJa
                ? `${shelfName.get(item.shelfSlug) ?? item.shelfSlug} ── ${isJa ? item.genreNameJa : item.genreNameEn}`
                : (shelfName.get(item.shelfSlug) ?? item.shelfSlug);
              return (
                <li key={item.slug}>
                  <IndexRow
                    href={`/${item.genreSlug ?? item.shelfSlug}/${item.slug}`}
                    name={isJa ? item.nameJa : item.nameRomaji}
                    aside={isJa ? item.nameRomaji : item.nameJa}
                    gloss={englishGloss(item.nameEn, item.nameRomaji)}
                    labels={<LabelChip>{breadcrumb}</LabelChip>}
                  />
                </li>
              );
            })}
          </ul>
        </section>

        {relatedTags.length > 0 && (
          <section className="border-rule mb-stack border-t pt-stack">
            <SectionHeading variant="label">{t("relatedTitle")}</SectionHeading>
            <LinkCloud
              items={relatedTags.map((rt) => ({
                key: rt.slug,
                href: `/tag/${rt.slug}`,
                label: isJa ? rt.nameJa : rt.nameEn,
                count: rt.itemCount,
              }))}
            />
          </section>
        )}

        <p className="mb-stack">
          <ArrowLink href="/tags">{t("allTagsLink")}</ArrowLink>
        </p>
      </div>

      <div className="px-4 md:px-0">
        <SiteFooter locale={locale} />
      </div>
    </main>
  );
}
