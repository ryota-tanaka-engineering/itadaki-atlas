import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { CoverHeader } from "@/components/CoverHeader";
import { fetchItemsByPref, fetchPrefIntro, fetchShelves, fetchPrefsWithItems, type Locale } from "@/features/map/queries";
import { parseGuideMarkdown } from "@/features/guide/markdown";
import { GuideBody } from "@/features/guide/GuideBody";
import { PIN_STROKE, groupColor, styleColor } from "@/features/map/styles";
import { fetchGuidesForPref } from "@/features/guide/queries";
import { absoluteUrl, localeAlternates } from "@/lib/seo";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { ADJACENT_PREFS, PREF_SLUGS, prefFromSlug } from "@/lib/prefectures";

/**
 * 地域ページ（"what to eat in ..." を受ける第二のSEO正面）。
 *
 * データが1件でも入った県はこのページが自動で生える。0件の県は404
 * （空のページを量産すると薄いページとしてSEOに毒なので、生成しない）。
 *
 * 2026-08 デザイン確定: アイテムは棚の grp（dish/ingredient/preparation）で
 * 3群に分ける（●この土地で生まれた／■この土地が育てる／◆この土地が仕込む）。
 */
type Params = { locale: string; pref: string };

// ISR（`revalidate = 300`）。全件系クエリ（fetchItemsByPref等）を持つため
// トップと同じ対応。詳細: `.doc/10_system/02_infrastructure.md` §1「ISRキャッシュ」。
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale, pref: prefSlug } = await params;
  const pref = prefFromSlug(prefSlug);
  if (!pref) return {};
  const items = await fetchItemsByPref(pref, locale as Locale);
  if (items.length === 0) return {};
  const t = await getTranslations({ locale, namespace: "prefecture" });
  const name = t(pref);
  // 総論（2026-10-10）があれば description に使う。検索結果と AI の要約に「これは何か」が出る
  const intro = await fetchPrefIntro(pref, locale as Locale);

  return {
    title: locale === "ja" ? `${name}の食` : `What to eat in ${name}`,
    description:
      intro?.intro ??
      (locale === "ja"
        ? `${name}で生まれた食べもの${items.length}件。発祥地と系統で整理。`
        : `${items.length} foods that originated in ${name}, organized by origin and style.`),
    alternates: localeAlternates(`/region/${prefSlug}`, locale),
  };
}

// 本場（どこでも食べられるが、ここのは特別）は生まれた/育てる/仕込むのどれでもないため、
// 棚カテゴリではなく第4の群に分ける。記号は3群の●に混ぜない（本場だけ記号なし。
// 2026-09「丸だけで色分け」決定で形はすべて丸になり、識別は色が主になった）。
const GRP_ORDER = ["dish", "ingredient", "preparation", "honba"] as const;
const GRP_SYMBOL: Record<(typeof GRP_ORDER)[number], string | null> = {
  dish: "●",
  ingredient: "●",
  preparation: "●",
  honba: null,
};

export default async function RegionPage({ params }: { params: Promise<Params> }) {
  const { locale, pref: prefSlug } = await params;
  setRequestLocale(locale);

  const pref = prefFromSlug(prefSlug);
  if (!pref) notFound();

  const items = await fetchItemsByPref(pref, locale as Locale);
  if (items.length === 0) notFound();

  const [shelves, prefsWithItems, experiences, prefIntro] = await Promise.all([
    fetchShelves(),
    fetchPrefsWithItems(),
    // この土地の食体験（食の街・市場・祭り・ビアガーデン・酒蔵/工場見学等。2026-09-12「体験と場所」）
    fetchGuidesForPref(pref, locale as Locale),
    // 総論（一行）と読み物（地の文。旗艦の県のみ）。2026-10-10、体験原則2の県ページ側
    fetchPrefIntro(pref, locale as Locale),
  ]);
  const storyBlocks = prefIntro?.bodyMd ? parseGuideMarkdown(prefIntro.bodyMd) : [];

  const t = await getTranslations("region");
  const tg = await getTranslations("guide");
  const tp = await getTranslations("prefecture");
  const ts = await getTranslations("style");
  const trr = await getTranslations("regionRelation");
  const name = tp(pref);
  const isJa = locale === "ja";

  const grpOf = new Map(shelves.map((s) => [s.slug, s.grp]));
  const grpOfItem = (i: (typeof items)[number]) =>
    i.regionRelation === "本場" ? "honba" : grpOf.get(i.shelfSlug);
  const groups = GRP_ORDER.map((grp) => ({
    grp,
    items: items.filter((i) => grpOfItem(i) === grp),
  })).filter((g) => g.items.length > 0);

  const withItems = new Set(prefsWithItems);
  const neighbors = (ADJACENT_PREFS[pref] ?? []).filter((p) => withItems.has(p));

  // JSON-LD（2026-10-06 SEO/AIO）: パンくず（トップ → 県）と、この県の食の一覧
  const pageUrl = absoluteUrl(locale, `/region/${prefSlug}`);
  const jsonLd = [
    breadcrumbJsonLd([
      { name: "Itadaki Atlas", url: absoluteUrl(locale, "/") },
      { name, url: pageUrl },
    ]),
    itemListJsonLd({
      url: pageUrl,
      name: isJa ? `${name}の食` : `What to eat in ${name}`,
      description: prefIntro?.intro ?? null,
      items: items.map((i) => ({ name: isJa ? i.nameJa : i.nameRomaji, url: absoluteUrl(locale, `/${i.genreSlug ?? i.shelfSlug}/${i.slug}`) })),
    }),
  ];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-8 md:max-w-3xl">
      <JsonLd data={jsonLd} />
      <div className="px-4 md:px-0">
        <CoverHeader title={name} meta={t("count", { count: items.length })} />
      </div>

      <div className="px-4 pt-8 md:px-0">
        {/* 総論（体験原則2: 件数・一覧の前に「これは何か」）。ジャンルページの総論と同じ見た目。
            読み物がある県は、一覧の下の読み物へのページ内リンクを添える */}
        {prefIntro && (
          <div className="mb-8">
            <p className="text-muted-foreground leading-relaxed">{prefIntro.intro}</p>
            {storyBlocks.length > 0 && (
              <p className="mt-2">
                <a href="#region-story" className="text-brand-accent-dark text-sm underline">
                  {t("storyLink")}
                </a>
              </p>
            )}
          </div>
        )}

        {groups.map((group) => (
          <section key={group.grp} className="mb-10">
            <h2 className="font-serif border-border mb-3 flex items-center gap-2 border-b pb-2 text-lg">
              {GRP_SYMBOL[group.grp] && (
                <span aria-hidden style={{ color: groupColor(group.grp) }}>
                  {GRP_SYMBOL[group.grp]}
                </span>
              )}
              {t(`groupTitle.${group.grp}`)}
              <span className="text-muted-foreground text-sm font-normal">{group.items.length}</span>
            </h2>
            <ul className="divide-border divide-y">
              {group.items.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/${item.genreSlug ?? item.shelfSlug}/${item.slug}`}
                    className="hover:bg-muted/40 -mx-2 block rounded-md px-2 py-3 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {item.primaryStyle && (
                        <span
                          aria-hidden
                          className="inline-block size-3 shrink-0 rounded-full border"
                          style={{
                            backgroundColor: styleColor(item.primaryStyle),
                            borderColor: PIN_STROKE,
                          }}
                        />
                      )}
                      <span className="font-medium">{isJa ? item.nameJa : item.nameRomaji}</span>
                      {item.primaryStyle && (
                        <span className="text-muted-foreground text-xs">{ts(item.primaryStyle)}</span>
                      )}
                      {/* 発祥ではなく名産地等で結びつくアイテムの区別（本場は群見出しで分かるので重ねない） */}
                      {item.regionRelation && item.regionRelation !== "本場" && (
                        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                          {trr(item.regionRelation)}
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground mt-1 block text-xs">
                      {item.nameJa} — {item.nameRomaji}
                      {item.nameEn ? ` — ${item.nameEn}` : ""}
                    </span>
                    {item.summary && <span className="mt-1 block text-sm">{item.summary}</span>}
                    {/* 本場の構造的理由の一文。複数都市分は改行区切りで届く */}
                    {(isJa ? item.regionNoteJa : item.regionNoteEn) && (
                      <span className="text-muted-foreground mt-1 block text-xs whitespace-pre-line">
                        {isJa ? item.regionNoteJa : item.regionNoteEn}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* この土地の食の物語（読み物・地の文。旗艦の県のみ。ロードマップ P2-3）。
            一覧（索引）を先に、読み物をその後に置く。見出し・段落・リストとアイテムへの内部リンクは
            ガイドと同じ最小 Markdown（React 要素として描画し HTML を流し込まない） */}
        {storyBlocks.length > 0 && (
          <section id="region-story" className="border-border mb-10 scroll-mt-[calc(var(--header-height)+1rem)] border-t pt-6">
            <h2 className="font-serif mb-4 text-lg">{t("storyTitle")}</h2>
            <GuideBody blocks={storyBlocks} />
          </section>
        )}

        {/* この土地の食体験（食の街・市場・祭り・ビアガーデン・酒蔵/工場見学等。0件なら節ごと出さない。
            CLAUDE.md体験原則3=分類名ではなく土地との関係で言う） */}
        {experiences.length > 0 && (
          <section className="border-border mb-10 border-t pt-6">
            <h2 className="font-serif mb-3 text-lg">{t("experiencesTitle")}</h2>
            <ul className="divide-border divide-y">
              {experiences.map((g) => (
                <li key={g.slug}>
                  <Link
                    href={`/guide/${g.slug}`}
                    className="hover:bg-muted/40 -mx-2 block rounded-md px-2 py-3 transition-colors"
                  >
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium">{g.title}</span>
                      <span className="text-muted-foreground text-xs">{tg(`kind.${g.kind}`)}</span>
                    </span>
                    {g.whenNote && (
                      <span className="text-muted-foreground mt-1 block text-xs">{g.whenNote}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 隣の土地へ（行き止まり禁止。掲載がある隣接県だけが並ぶ） */}
        {neighbors.length > 0 && (
          <section className="border-border mb-8 border-t pt-6">
            <h2 className="mb-3 text-sm font-semibold">{t("neighborsTitle")}</h2>
            <ul className="flex flex-wrap gap-2">
              {neighbors.map((p) => (
                <li key={p}>
                  <Link
                    href={`/region/${PREF_SLUGS[p]}`}
                    className="bg-muted text-muted-foreground hover:bg-muted/70 inline-block rounded-full px-3 py-1 text-xs"
                  >
                    {tp(p)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mb-8">
          <Link href="/" className="text-sm underline">
            {t("viewOnMap")}
          </Link>
        </p>
      </div>

      <div className="px-4 md:px-0">
        <SiteFooter locale={locale} />
      </div>
    </main>
  );
}
