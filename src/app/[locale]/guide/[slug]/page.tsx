import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SiteFooter } from "@/components/SiteFooter";
import { CoverHeader } from "@/components/CoverHeader";
import { CorrectionLink } from "@/components/CorrectionLink";
import { RowList } from "@/components/RowList";
import { SectionHeading } from "@/components/SectionHeading";
import { LinkCloud } from "@/components/ui/text-link";
import { fetchGuideBySlug, fetchOtherGuides, fetchScenesForGuide } from "@/features/guide/queries";
import { parseGuideMarkdown } from "@/features/guide/markdown";
import { GuideBody } from "@/features/guide/GuideBody";
import { PositionBand } from "@/features/map/PositionBand";
import { localeAlternates } from "@/lib/seo";
import type { Prefecture } from "@/lib/prefectures";

// ISR: cookie を読まない static クライアントで取得しているため 5 分キャッシュにできる
// （2026-09-30 本番で Cloudflare 1102「Worker exceeded resource limits」を観測。都度描画の CPU を減らす）
export const revalidate = 300;

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
        <div className="px-4 pt-stack md:px-0">
          <PositionBand lat={guide.lat as number} lng={guide.lng as number} label={placeLabel} />
          {guide.whenNote && (
            <p className="type-note text-muted-foreground mt-2">
              {t("whenNoteLabel")}: {guide.whenNote}
            </p>
          )}
        </div>
      )}

      <div className="px-4 pt-section md:px-0">
        <article>
          <GuideBody blocks={blocks} />

          {guide.links.length > 0 && (
            <section className="border-rule mt-section border-t pt-stack">
              <SectionHeading variant="label">{t("relatedFoodHeading")}</SectionHeading>
              <LinkCloud
                items={guide.links.map((link) => ({
                  key: `${link.kind}-${link.slug}`,
                  href: link.href,
                  label: link.name,
                }))}
              />
            </section>
          )}

          {/* この場面で（2026-09-24「場面」。場面が無ければ出さない） */}
          {sceneSlugs.length > 0 && (
            <section className="border-rule mt-stack border-t pt-stack">
              <SectionHeading variant="label">{t("sceneHeading")}</SectionHeading>
              <LinkCloud
                items={sceneSlugs.map((sceneSlug) => ({
                  key: sceneSlug,
                  href: `/guide/scene/${sceneSlug}`,
                  label: t("sceneChip", { name: t(`scene.${sceneSlug}`) }),
                }))}
              />
            </section>
          )}

          {hasOtherGuides && (
            // 「次に進む入口」（他のガイドへ）はカード枠にまとめ、中は罫線区切りの行
            <section className="border-rule mt-stack rounded-xl border px-4 pt-4 pb-1 md:px-5">
              <SectionHeading variant="label" className="mb-1">
                {t("otherGuidesHeading")}
              </SectionHeading>
              <RowList
                rows={[
                  ...sameKind.map((g) => ({ key: g.slug, href: `/guide/${g.slug}`, title: g.title })),
                  ...(nextKindFirst
                    ? [
                        {
                          key: nextKindFirst.slug,
                          href: `/guide/${nextKindFirst.slug}`,
                          title: t("nextKindLabel", {
                            kind: t(`kind.${nextKindFirst.kind}`),
                            title: nextKindFirst.title,
                          }),
                        },
                      ]
                    : []),
                ]}
              />
            </section>
          )}

          <CorrectionLink label={t("correction")} className="mt-section" />
        </article>
      </div>

      <div className="px-4 md:px-0">
        <SiteFooter locale={locale} />
      </div>
    </main>
  );
}
