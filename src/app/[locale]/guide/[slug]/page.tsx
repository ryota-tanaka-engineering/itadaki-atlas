import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { CoverHeader } from "@/components/CoverHeader";
import { fetchGuideBySlug, fetchOtherGuides } from "@/features/guide/queries";
import { parseGuideMarkdown } from "@/features/guide/markdown";
import { GuideBody } from "@/features/guide/GuideBody";
import { localeAlternates } from "@/lib/seo";

/**
 * ガイド詳細ページ（`/guide/[slug]`。CLAUDE.md「ページ型」節）。
 *
 * 橙カバー（kindラベル・title・summary）→ 紙の本文（Markdown）→「関係する食べもの」
 * （guide_links から genre/shelf/tag へ）→「他のガイド」（同kindの他ガイド + 次kindの先頭。
 * 行き止まり禁止）。出典（guide_sources）はDB内部の検証データのためUIには出さない
 * （詳細ページ `[genre]/[slug]/page.tsx` と同じ方針）。
 */
type Params = { locale: string; slug: string };
type Locale = "ja" | "en";

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  const guide = await fetchGuideBySlug(slug, locale as Locale);
  if (!guide) return {};

  return {
    title: guide.title,
    description: guide.summary ?? undefined,
    alternates: localeAlternates(`/guide/${slug}`),
    openGraph: {
      type: "article",
      title: guide.title,
      description: guide.summary ?? undefined,
      locale,
    },
  };
}

export default async function GuideDetailPage({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const guide = await fetchGuideBySlug(slug, locale as Locale);
  if (!guide) notFound();

  const t = await getTranslations("guide");
  const { sameKind, nextKindFirst } = await fetchOtherGuides(guide.kind, guide.slug, locale as Locale);

  const blocks = guide.bodyMd ? parseGuideMarkdown(guide.bodyMd) : [];

  const linkHref = (link: (typeof guide.links)[number]) =>
    link.kind === "tag" ? `/tag/${link.slug}` : `/${link.slug}`;

  const hasOtherGuides = sameKind.length > 0 || nextKindFirst !== null;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-8 md:max-w-3xl">
      <div className="px-4 md:px-0">
        <CoverHeader eyebrow={t(`kind.${guide.kind}`)} title={guide.title} meta={guide.summary} />
      </div>

      <div className="px-4 pt-8 md:px-0">
        <article>
          <GuideBody blocks={blocks} />

          {guide.links.length > 0 && (
            <section className="border-border mt-10 border-t pt-6">
              <h2 className="mb-3 text-sm font-semibold">{t("relatedFoodHeading")}</h2>
              <ul className="flex flex-wrap gap-2">
                {guide.links.map((link) => (
                  <li key={`${link.kind}-${link.slug}`}>
                    <Link
                      href={linkHref(link)}
                      className="border-border hover:bg-muted/50 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hasOtherGuides && (
            <section className="border-border mt-8 border-t pt-6">
              <h2 className="mb-3 text-sm font-semibold">{t("otherGuidesHeading")}</h2>
              <ul className="space-y-2">
                {sameKind.map((g) => (
                  <li key={g.slug}>
                    <Link
                      href={`/guide/${g.slug}`}
                      className="border-border hover:bg-muted/50 block rounded-lg border p-3"
                    >
                      <span className="block font-medium">{g.title}</span>
                    </Link>
                  </li>
                ))}
                {nextKindFirst && (
                  <li key={nextKindFirst.slug}>
                    <Link
                      href={`/guide/${nextKindFirst.slug}`}
                      className="border-border hover:bg-muted/50 block rounded-lg border p-3"
                    >
                      <span className="block font-medium">
                        {t("nextKindLabel", {
                          kind: t(`kind.${nextKindFirst.kind}`),
                          title: nextKindFirst.title,
                        })}
                      </span>
                    </Link>
                  </li>
                )}
              </ul>
            </section>
          )}

          <p className="mt-10 text-center">
            <Link href="/contact" className="text-brand-accent-dark text-xs underline">
              {t("correction")}
            </Link>
          </p>
        </article>
      </div>

      <div className="px-4 md:px-0">
        <SiteFooter locale={locale} />
      </div>
    </main>
  );
}
