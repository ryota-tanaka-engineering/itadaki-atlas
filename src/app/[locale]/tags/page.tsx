import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { CoverHeader } from "@/components/CoverHeader";
import { fetchTagsWithCounts } from "@/features/map/queries";
import { localeAlternates } from "@/lib/seo";

/**
 * `/tags` 一覧（「興味からさがす」の入口。CLAUDE.md参照）。
 *
 * kind別にタグをまとめ、**件数>0のタグだけ**表示する（付与のないタグへの
 * リンクは行き止まりになるため出さない）。
 */
type Params = { locale: string };

// tags.kind の check 制約と同じ並び（ia-atlas-content Skill・migration参照）
const TAG_KINDS = ["味・特性", "素材", "調理", "形状・食べ方", "場面", "系譜"] as const;

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tags" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates("/tags"),
  };
}

export default async function TagsPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("tags");
  const tags = await fetchTagsWithCounts();
  const isJa = locale === "ja";

  const groups = TAG_KINDS.map((kind) => ({
    kind,
    tags: tags.filter((tag) => tag.kind === kind && tag.itemCount > 0),
  })).filter((g) => g.tags.length > 0);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-8 md:max-w-3xl">
      <div className="px-4 md:px-0">
        <CoverHeader title={t("title")} meta={t("description")} />
      </div>

      <div className="px-4 pt-8 md:px-0">
        {groups.map((group) => (
          <section key={group.kind} className="mb-10">
            <h2 className="font-serif border-border mb-3 border-b pb-2 text-lg">{t(`kind.${group.kind}`)}</h2>
            <ul className="flex flex-wrap gap-2">
              {group.tags.map((tag) => (
                <li key={tag.slug}>
                  <Link
                    href={`/tag/${tag.slug}`}
                    className="border-border hover:bg-muted/50 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
                  >
                    {isJa ? tag.nameJa : tag.nameEn}
                    <span className="text-muted-foreground text-xs">{tag.itemCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="px-4 md:px-0">
        <SiteFooter locale={locale} />
      </div>
    </main>
  );
}
