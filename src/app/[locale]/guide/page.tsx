import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { CoverHeader } from "@/components/CoverHeader";
import { GuideKindSections } from "@/features/guide/GuideKindSections";
import { GUIDE_SCENES, fetchGuides, fetchSceneCounts } from "@/features/guide/queries";
import { localeAlternates } from "@/lib/seo";

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
  const [guides, sceneCounts] = await Promise.all([
    fetchGuides(locale as "ja" | "en"),
    fetchSceneCounts(locale as "ja" | "en"),
  ]);

  const scenesWithGuides = GUIDE_SCENES.filter((s) => (sceneCounts[s.slug] ?? 0) > 0);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-8 md:max-w-3xl">
      <div className="px-4 md:px-0">
        <CoverHeader title={t("title")} meta={t("description")} />
      </div>

      <div className="px-4 pt-8 md:px-0">
        {/* 場面からさがす（2026-09-24「場面」）。0件の場面は出さない */}
        {scenesWithGuides.length > 0 && (
          <section className="mb-10">
            <h2 className="font-serif border-border mb-3 border-b pb-2 text-lg">
              {t("scenesHeading")}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {scenesWithGuides.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/guide/scene/${s.slug}`}
                    className="border-border hover:bg-muted/50 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
                  >
                    {t(`scene.${s.slug}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <GuideKindSections guides={guides} />

        <p className="mb-8">
          <Link href="/" className="text-sm underline">
            {t("backToFood")}
          </Link>
        </p>
      </div>

      <div className="px-4 md:px-0">
        <SiteFooter locale={locale} />
      </div>
    </main>
  );
}
