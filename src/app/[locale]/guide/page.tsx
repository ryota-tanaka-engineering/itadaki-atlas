import { getTranslations, setRequestLocale } from "next-intl/server";

import { SiteFooter } from "@/components/SiteFooter";
import { CoverHeader } from "@/components/CoverHeader";
import { SectionHeading } from "@/components/SectionHeading";
import { ArrowLink, LinkCloud } from "@/components/ui/text-link";
import { GuideKindSections } from "@/features/guide/GuideKindSections";
import { GUIDE_SCENES, fetchGuides, fetchSceneCounts } from "@/features/guide/queries";
import { localeAlternates } from "@/lib/seo";

// ISR: cookie を読まない static クライアントで取得しているため 5 分キャッシュにできる
// （2026-09-30 本番で Cloudflare 1102「Worker exceeded resource limits」を観測。都度描画の CPU を減らす）
export const revalidate = 300;

/**
 * `/guide` 一覧（「食べに行く前に」ガイドの入口。CLAUDE.md「ページ型」節）。
 *
 * `/tags` と同じ方針: kind別にグルーピングし、1件も無いkindの見出しは出さない
 * （見出しだけあってリンクが1本も無い状態を作らない）。GUIDE_KINDS に沿って自動で
 * 小見出しが増減する（2026-09-12「体験と場所」6種別追加時もこのページの変更は不要だった）。
 *
 * CoverHeader直下に「場面からさがす」節（2026-09-24「場面」）。件数>0の場面だけを
 * チップで出す（行き止まり入口を作らない）。その下は既存の話題別一覧のまま。
 */
type Params = { locale: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "guide" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates("/guide"),
  };
}

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("guide");
  const th = await getTranslations("header");
  const [guides, sceneCounts] = await Promise.all([
    fetchGuides(locale as "ja" | "en"),
    fetchSceneCounts(locale as "ja" | "en"),
  ]);

  const scenesWithGuides = GUIDE_SCENES.filter((s) => (sceneCounts[s.slug] ?? 0) > 0);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-8 md:max-w-3xl">
      <div className="px-4 md:px-0">
        <CoverHeader eyebrow={th("navGuide")} title={t("title")} meta={t("description")} />
      </div>

      <div className="px-4 pt-stack md:px-0">
        {/* 場面からさがす（2026-09-24「場面」）。0件の場面は出さない。
            「次に進む入口」なのでカード枠に入れ、中は遷移リンクの流し組み */}
        {scenesWithGuides.length > 0 && (
          <section className="border-rule mb-section rounded-xl border px-4 pt-4 pb-3 md:px-5">
            <SectionHeading className="mb-3">{t("scenesHeading")}</SectionHeading>
            <LinkCloud
              items={scenesWithGuides.map((s) => ({
                key: s.slug,
                href: `/guide/scene/${s.slug}`,
                label: t(`scene.${s.slug}`),
              }))}
            />
          </section>
        )}

        <GuideKindSections guides={guides} locale={locale} />

        <p className="mb-stack">
          <ArrowLink href="/">{t("backToFood")}</ArrowLink>
        </p>
      </div>

      <div className="px-4 md:px-0">
        <SiteFooter locale={locale} />
      </div>
    </main>
  );
}
