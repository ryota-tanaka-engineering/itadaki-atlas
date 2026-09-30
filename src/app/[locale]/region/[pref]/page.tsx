import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SiteFooter } from "@/components/SiteFooter";
import { CoverHeader } from "@/components/CoverHeader";
import { IndexRow } from "@/components/IndexRow";
import { SectionHeading } from "@/components/SectionHeading";
import { LabelChip } from "@/components/ui/chip";
import { ArrowLink, LinkCloud } from "@/components/ui/text-link";
import { fetchItemsByPref, fetchShelves, fetchPrefsWithItems, type Locale } from "@/features/map/queries";
import { PIN_BASE, PIN_STROKE, groupColor, styleColor } from "@/features/map/styles";
import { fetchGuidesForPref } from "@/features/guide/queries";
import { localeAlternates } from "@/lib/seo";
import { englishGloss } from "@/lib/names";
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

  return {
    title: locale === "ja" ? `${name}の食` : `What to eat in ${name}`,
    description:
      locale === "ja"
        ? `${name}で生まれた食べもの${items.length}件。発祥地と系統で整理。`
        : `${items.length} foods that originated in ${name}, organized by origin and style.`,
    alternates: localeAlternates(`/region/${prefSlug}`),
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

  const [shelves, prefsWithItems, experiences] = await Promise.all([
    fetchShelves(),
    fetchPrefsWithItems(),
    // この土地の食体験（食の街・市場・祭り・ビアガーデン・酒蔵/工場見学等。2026-09-12「体験と場所」）
    fetchGuidesForPref(pref, locale as Locale),
  ]);

  const t = await getTranslations("region");
  const tg = await getTranslations("guide");
  const tp = await getTranslations("prefecture");
  const ts = await getTranslations("style");
  const trr = await getTranslations("regionRelation");
  const th = await getTranslations("header");
  // カバーの副題: もう一方の言語の県名（ja ページなら "Fukushima"）
  const tpOther = await getTranslations({ locale: locale === "ja" ? "en" : "ja", namespace: "prefecture" });
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

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-8 md:max-w-3xl">
      <div className="px-4 md:px-0">
        <CoverHeader
          eyebrow={th("navPlace")}
          title={name}
          subtitle={tpOther(pref)}
          meta={t("count", { count: items.length })}
        />
      </div>

      <div className="px-4 pt-stack md:px-0">
        {groups.map((group) => (
          <section key={group.grp} className="mb-section">
            <SectionHeading
              count={group.items.length}
              mark={
                GRP_SYMBOL[group.grp] ? (
                  <span aria-hidden className="text-base" style={{ color: groupColor(group.grp) }}>
                    {GRP_SYMBOL[group.grp]}
                  </span>
                ) : (
                  // 本場は中抜きの○（CLAUDE.md「記号」節。地図の本場ピンと同じ形）
                  <span
                    aria-hidden
                    className="inline-block size-3 shrink-0 rounded-full"
                    style={{ border: `2.5px solid ${PIN_BASE}` }}
                  />
                )
              }
            >
              {t(`groupTitle.${group.grp}`)}
            </SectionHeading>
            <ul className="divide-rule divide-y">
              {group.items.map((item) => (
                <li key={item.slug}>
                  <IndexRow
                    href={`/${item.genreSlug ?? item.shelfSlug}/${item.slug}`}
                    name={isJa ? item.nameJa : item.nameRomaji}
                    // 三点セット: 1行目に名前＋もう一方の表記、英訳は重複を消して2行目に
                    aside={isJa ? item.nameRomaji : item.nameJa}
                    gloss={englishGloss(item.nameEn, item.nameRomaji)}
                    summary={item.summary}
                    dot={
                      item.primaryStyle
                        ? { color: styleColor(item.primaryStyle), stroke: PIN_STROKE }
                        : null
                    }
                    labels={
                      item.primaryStyle ||
                      (item.regionRelation && item.regionRelation !== "本場") ? (
                        <>
                          {item.primaryStyle && <LabelChip>{ts(item.primaryStyle)}</LabelChip>}
                          {/* 発祥ではなく名産地等で結びつくアイテムの区別（本場は群見出しで分かるので重ねない） */}
                          {item.regionRelation && item.regionRelation !== "本場" && (
                            <LabelChip>{trr(item.regionRelation)}</LabelChip>
                          )}
                        </>
                      ) : null
                    }
                    // 本場の構造的理由の一文。複数都市分は改行区切りで届く
                    note={isJa ? item.regionNoteJa : item.regionNoteEn}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* この土地の食体験（食の街・市場・祭り・ビアガーデン・酒蔵/工場見学等。0件なら節ごと出さない。
            CLAUDE.md体験原則3=分類名ではなく土地との関係で言う） */}
        {experiences.length > 0 && (
          // 「次に進む入口」（ガイドへ）はカード枠にまとめる
          <section className="border-rule mb-section rounded-xl border px-4 pt-4 pb-1 md:px-5">
            <SectionHeading className="mb-0">{t("experiencesTitle")}</SectionHeading>
            <ul className="divide-rule divide-y">
              {experiences.map((g) => (
                <li key={g.slug}>
                  <IndexRow
                    href={`/guide/${g.slug}`}
                    name={g.title}
                    summary={g.whenNote}
                    labels={<LabelChip>{tg(`kind.${g.kind}`)}</LabelChip>}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 隣の土地へ（行き止まり禁止。掲載がある隣接県だけが並ぶ） */}
        {neighbors.length > 0 && (
          <section className="border-rule mb-stack border-t pt-stack">
            <SectionHeading variant="label">{t("neighborsTitle")}</SectionHeading>
            <LinkCloud
              items={neighbors.map((p) => ({ key: p, href: `/region/${PREF_SLUGS[p]}`, label: tp(p) }))}
            />
          </section>
        )}

        <p className="mb-stack">
          <ArrowLink href="/">{t("viewOnMap")}</ArrowLink>
        </p>
      </div>

      <div className="px-4 md:px-0">
        <SiteFooter locale={locale} />
      </div>
    </main>
  );
}
