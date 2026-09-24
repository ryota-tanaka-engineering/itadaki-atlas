import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { CoverHeader } from "@/components/CoverHeader";
import { fetchGuideBySlug, fetchOtherGuides, fetchScenesForGuide } from "@/features/guide/queries";
import { parseGuideMarkdown } from "@/features/guide/markdown";
import { GuideBody } from "@/features/guide/GuideBody";
import { PositionBand } from "@/features/map/PositionBand";
import { localeAlternates } from "@/lib/seo";
import type { Prefecture } from "@/lib/prefectures";

/**
 * ガイド詳細ページ（`/guide/[slug]`。CLAUDE.md「ページ型」節）。
 *
 * 橙カバー（kindラベル・title・summary）→（場所を持つガイドのみ）位置帯・例年の時期
 * → 紙の本文（Markdown）→「関係する食べもの」（guide_links から genre/shelf/tag/pref/item へ。
 * pref/item は2026-09-12「体験と場所」で追加）→「他のガイド」（同kindの他ガイド + 次kindの先頭。
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
  const tp = await getTranslations("prefecture");
  const [{ sameKind, nextKindFirst }, sceneSlugs] = await Promise.all([
    fetchOtherGuides(guide.kind, guide.slug, locale as Locale),
    fetchScenesForGuide(guide.slug),
  ]);

  const blocks = guide.bodyMd ? parseGuideMarkdown(guide.bodyMd) : [];

  const hasOtherGuides = sameKind.length > 0 || nextKindFirst !== null;

  // 位置帯（場所を持つガイドのみ。2026-09-12「体験と場所」）。座標が両方揃っている時だけ出す
  const hasGeo = guide.lat !== null && guide.lng !== null;
  const placeLabel = guide.pref
    ? `${tp(guide.pref as Prefecture)}${guide.city ? (locale === "ja" ? guide.city : ` ${guide.city}`) : ""}`
    : guide.title;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-8 md:max-w-3xl">
      <div className="px-4 md:px-0">
        <CoverHeader eyebrow={t(`kind.${guide.kind}`)} title={guide.title} meta={guide.summary} />
      </div>

      {/* 位置帯 + 例年の時期（場所を持つガイドのみ。カバー直下） */}
      {hasGeo && (
        <div className="px-4 pt-6 md:px-0">
          <PositionBand lat={guide.lat as number} lng={guide.lng as number} label={placeLabel} />
          {guide.whenNote && (
            <p className="text-muted-foreground mt-2 text-xs">
              {t("whenNoteLabel")}: {guide.whenNote}
            </p>
          )}
        </div>
      )}

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
                      href={link.href}
                      className="border-border hover:bg-muted/50 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* この場面で（2026-09-24「場面」。場面が無ければ出さない） */}
          {sceneSlugs.length > 0 && (
            <section className="border-border mt-8 border-t pt-6">
              <h2 className="mb-3 text-sm font-semibold">{t("sceneHeading")}</h2>
              <ul className="flex flex-wrap gap-2">
                {sceneSlugs.map((sceneSlug) => (
                  <li key={sceneSlug}>
                    <Link
                      href={`/guide/scene/${sceneSlug}`}
                      className="border-border hover:bg-muted/50 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
                    >
                      {t("sceneChip", { name: t(`scene.${sceneSlug}`) })}
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
