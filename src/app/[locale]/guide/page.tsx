import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { CoverHeader } from "@/components/CoverHeader";
import { GUIDE_KINDS, fetchGuides, type GuideKind } from "@/features/guide/queries";
import { localeAlternates } from "@/lib/seo";
import type { Prefecture } from "@/lib/prefectures";

/**
 * `/guide` 一覧（「食べに行く前に」ガイドの入口。CLAUDE.md「ページ型」節）。
 *
 * `/tags` と同じ方針: kind別にグルーピングし、1件も無いkindの見出しは出さない
 * （見出しだけあってリンクが1本も無い状態を作らない）。GUIDE_KINDS に沿って自動で
 * 小見出しが増減する（2026-09-12「体験と場所」6種別追加時もこのページの変更は不要だった）。
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
  const tp = await getTranslations("prefecture");
  const guides = await fetchGuides(locale as "ja" | "en");

  const groups = GUIDE_KINDS.map((kind: GuideKind) => ({
    kind,
    guides: guides.filter((g) => g.kind === kind),
  })).filter((group) => group.guides.length > 0);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-8 md:max-w-3xl">
      <div className="px-4 md:px-0">
        <CoverHeader title={t("title")} meta={t("description")} />
      </div>

      <div className="px-4 pt-8 md:px-0">
        {groups.map((group) => (
          <section key={group.kind} className="mb-10">
            <h2 className="font-serif border-border mb-3 border-b pb-2 text-lg">
              {t(`kind.${group.kind}`)}
            </h2>
            <ul className="divide-border divide-y">
              {group.guides.map((g) => (
                <li key={g.slug}>
                  <Link
                    href={`/guide/${g.slug}`}
                    className="hover:bg-muted/40 -mx-2 block rounded-md px-2 py-3 transition-colors"
                  >
                    <span className="block font-medium">{g.title}</span>
                    {g.summary && (
                      <span className="text-muted-foreground block text-sm">{g.summary}</span>
                    )}
                    {/* 場所を持つガイド（食の街・市場・祭り等）は県・市と時期メモを小さく添える
                        （2026-09-12「体験と場所」。CLAUDE.md体験原則3=土地との関係で言う） */}
                    {(g.pref || g.whenNote) && (
                      <span className="text-muted-foreground mt-1 flex flex-wrap gap-x-2 text-xs">
                        {g.pref && (
                          <span>
                            {tp(g.pref as Prefecture)}
                            {g.city ? ` ${g.city}` : ""}
                          </span>
                        )}
                        {g.whenNote && <span>{g.whenNote}</span>}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

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
