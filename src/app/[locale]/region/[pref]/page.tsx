import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { CoverHeader } from "@/components/CoverHeader";
import { fetchItemsByPref, fetchShelves, fetchPrefsWithItems, type Locale } from "@/features/map/queries";
import { PIN_STROKE, styleColor } from "@/features/map/styles";
import { localeAlternates } from "@/lib/seo";
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
// 棚カテゴリではなく第4の群に分ける。記号は3群の●■◆に混ぜない（形の識別を守る）。
const GRP_ORDER = ["dish", "ingredient", "preparation", "honba"] as const;
const GRP_SYMBOL: Record<(typeof GRP_ORDER)[number], string | null> = {
  dish: "●",
  ingredient: "■",
  preparation: "◆",
  honba: null,
};

export default async function RegionPage({ params }: { params: Promise<Params> }) {
  const { locale, pref: prefSlug } = await params;
  setRequestLocale(locale);

  const pref = prefFromSlug(prefSlug);
  if (!pref) notFound();

  const items = await fetchItemsByPref(pref, locale as Locale);
  if (items.length === 0) notFound();

  const [shelves, prefsWithItems] = await Promise.all([fetchShelves(), fetchPrefsWithItems()]);

  const t = await getTranslations("region");
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

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-8 md:max-w-3xl">
      <div className="px-4 md:px-0">
        <CoverHeader title={name} meta={t("count", { count: items.length })} />
      </div>

      <div className="px-4 pt-8 md:px-0">
        {groups.map((group) => (
          <section key={group.grp} className="mb-10">
            <h2 className="font-serif border-border mb-3 flex items-center gap-2 border-b pb-2 text-lg">
              {GRP_SYMBOL[group.grp] && (
                <span aria-hidden className="text-primary">
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
