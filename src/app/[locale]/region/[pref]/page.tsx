import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { fetchItemsByPref, type Locale } from "@/features/map/queries";
import { PIN_STROKE, styleColor } from "@/features/map/styles";
import { localeAlternates } from "@/lib/seo";
import { prefFromSlug } from "@/lib/prefectures";

/**
 * 地域ページ（"what to eat in ..." を受ける第二のSEO正面）。
 *
 * データが1件でも入った県はこのページが自動で生える。0件の県は404
 * （空のページを量産すると薄いページとしてSEOに毒なので、生成しない）。
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

export default async function RegionPage({ params }: { params: Promise<Params> }) {
  const { locale, pref: prefSlug } = await params;
  setRequestLocale(locale);

  const pref = prefFromSlug(prefSlug);
  if (!pref) notFound();

  const items = await fetchItemsByPref(pref, locale as Locale);
  if (items.length === 0) notFound();

  const t = await getTranslations("region");
  const tp = await getTranslations("prefecture");
  const ts = await getTranslations("style");
  const trr = await getTranslations("regionRelation");
  const name = tp(pref);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">{t("title", { pref: name })}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("count", { count: items.length })}
        </p>
      </header>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.slug}>
            <Link
              href={`/${item.genreSlug ?? "ramen"}/${item.slug}`}
              className="hover:bg-muted/50 block rounded-lg border p-3"
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
                <span className="font-medium">
                  {locale === "ja" ? item.nameJa : item.nameRomaji}
                </span>
                {item.primaryStyle && (
                  <span className="text-muted-foreground text-xs">
                    {ts(item.primaryStyle)}
                  </span>
                )}
                {/* 発祥ではなく名産地等で結びつくアイテムの区別 */}
                {item.regionRelation && (
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                    {trr(item.regionRelation)}
                  </span>
                )}
              </span>
              <span className="text-muted-foreground mt-1 block text-xs">
                {item.nameJa} — {item.nameRomaji}
                {item.nameEn ? ` — ${item.nameEn}` : ""}
              </span>
              {item.summary && (
                <span className="mt-1 block text-sm">{item.summary}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8">
        <Link href="/" className="text-sm underline">
          {t("viewOnMap")}
        </Link>
      </p>
    </main>
  );
}
