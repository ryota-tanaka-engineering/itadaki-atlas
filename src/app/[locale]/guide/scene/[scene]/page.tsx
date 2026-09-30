import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SiteFooter } from "@/components/SiteFooter";
import { CoverHeader } from "@/components/CoverHeader";
import { SectionHeading } from "@/components/SectionHeading";
import { LinkCloud } from "@/components/ui/text-link";
import { GuideKindSections } from "@/features/guide/GuideKindSections";
import { findGuideScene, GUIDE_SCENES, fetchGuidesForScene } from "@/features/guide/queries";
import { fetchGenres } from "@/features/map/queries";
import { localeAlternates } from "@/lib/seo";

/**
 * 場面ページ（`/guide/scene/[scene]`。2026-09-24「場面」。
 * data/ledgers/GUIDE_SCENES_IMPL_BRIEF.md §6）。
 *
 * 未知のslug（GUIDE_SCENESに無いもの）は notFound。橙カバー（場面名+一行説明）→
 * その場面のガイドをkindごとにグループ表示（`/guide`一覧と同じ見た目。GuideKindSections
 * を共有）→「この場面の食べもの」（GUIDE_SCENESのgenresをジャンル名チップで。空の場面は
 * 節ごと出さない）→ 末尾「他の場面」チップ（行き止まり禁止。CLAUDE.md体験原則6）。
 */
type Params = { locale: string; scene: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale, scene } = await params;
  const found = findGuideScene(scene);
  if (!found) return {};

  const t = await getTranslations({ locale, namespace: "guide" });
  return {
    title: t(`scene.${found.slug}`),
    description: t(`sceneIntro.${found.slug}`),
    alternates: localeAlternates(`/guide/scene/${scene}`),
  };
}

export default async function GuideScenePage({ params }: { params: Promise<Params> }) {
  const { locale, scene } = await params;
  setRequestLocale(locale);

  const found = findGuideScene(scene);
  if (!found) notFound();

  const t = await getTranslations("guide");
  const th = await getTranslations("header");
  const isJa = locale === "ja";

  const [guides, allGenres] = await Promise.all([
    fetchGuidesForScene(found.slug, locale as "ja" | "en"),
    // ジャンル名の取得は既存の仕組み（fetchGenres）を使い、この場面のgenresで絞る
    found.genres.length > 0 ? fetchGenres() : Promise.resolve([]),
  ]);

  const sceneGenreSlugs: readonly string[] = found.genres;
  const sceneGenres = allGenres.filter((g) => sceneGenreSlugs.includes(g.slug));
  const otherScenes = GUIDE_SCENES.filter((s) => s.slug !== found.slug);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-8 md:max-w-3xl">
      <div className="px-4 md:px-0">
        <CoverHeader
          eyebrow={th("navGuide")}
          title={t(`scene.${found.slug}`)}
          meta={t(`sceneIntro.${found.slug}`)}
        />
      </div>

      <div className="px-4 pt-stack md:px-0">
        <GuideKindSections guides={guides} />

        {/* この場面の食べもの（genresが空の場面は出さない） */}
        {sceneGenres.length > 0 && (
          <section className="border-rule mb-stack border-t pt-stack">
            <SectionHeading variant="label">{t("sceneFoodsHeading")}</SectionHeading>
            <LinkCloud
              items={sceneGenres.map((g) => ({ key: g.slug, href: `/${g.slug}`, label: isJa ? g.nameJa : g.nameEn }))}
            />
          </section>
        )}

        {/* 他の場面（行き止まり禁止） */}
        <section className="border-rule border-t pt-stack">
          <SectionHeading variant="label">{t("otherScenesHeading")}</SectionHeading>
          <LinkCloud
            items={otherScenes.map((s) => ({
              key: s.slug,
              href: `/guide/scene/${s.slug}`,
              label: t(`scene.${s.slug}`),
            }))}
          />
        </section>
      </div>

      <div className="px-4 md:px-0">
        <SiteFooter locale={locale} />
      </div>
    </main>
  );
}
