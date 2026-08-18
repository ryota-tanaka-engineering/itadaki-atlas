import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import {
  fetchGenre,
  fetchGenreItems,
  type Locale,
} from "@/features/map/queries";
import { PIN_STROKE, PRIMARY_STYLES, styleColor } from "@/features/map/styles";
import { localeAlternates } from "@/lib/seo";
import { PREF_SLUGS, type Prefecture } from "@/lib/prefectures";

/**
 * ジャンルページ（SEOの正面玄関のひとつ。"types of ramen" を受ける）。
 *
 * genres に行を足すだけでこのページが生える。ラーメン専用の意匠にしない。
 * - 地域性のあるアイテム → 系統別の一覧（地図の入口）
 * - 地域性のないアイテム（部位等）→ 図鑑セクション（データが入れば自動で現れる）
 */
type Params = { locale: string; genre: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale, genre } = await params;
  const g = await fetchGenre(genre);
  if (!g) return {};
  const items = await fetchGenreItems(genre, locale as Locale);
  const name = locale === "ja" ? g.nameJa : g.nameEn;

  // 料理（dish）は「ご当地◯◯一覧」、食材（ingredient）は「◯◯の銘柄と産地」
  const ing = g.type === "ingredient";
  return {
    title:
      locale === "ja"
        ? ing
          ? `${name}の銘柄と産地（${items.length}件）`
          : `ご当地${name}一覧（${items.length}種）`
        : ing
          ? `${name} — brands and regions`
          : `Types of ${name} — ${items.length} regional varieties`,
    description:
      locale === "ja"
        ? ing
          ? `日本各地の${name}の銘柄と産地を整理した一覧。`
          : `日本各地の${name}${items.length}種を、発祥地と系統で整理した一覧。`
        : ing
          ? `${name} brands and their source regions across Japan.`
          : `${items.length} regional varieties of ${name} in Japan, organized by origin and style.`,
    alternates: localeAlternates(`/${genre}`),
  };
}

export default async function GenrePage({ params }: { params: Promise<Params> }) {
  const { locale, genre } = await params;
  setRequestLocale(locale);

  const g = await fetchGenre(genre);
  if (!g) notFound();

  const t = await getTranslations("genre");
  const ts = await getTranslations("style");
  const tp = await getTranslations("prefecture");
  const items = await fetchGenreItems(genre, locale as Locale);
  const geo = items.filter((i) => i.lat !== null);
  const nonGeo = items.filter((i) => i.lat === null);
  const name = locale === "ja" ? g.nameJa : g.nameEn;

  // 系統ごとにグルーピング（存在する系統だけが出る）
  const byStyle = PRIMARY_STYLES.map((style) => ({
    style,
    items: geo.filter((i) => i.primaryStyle === style),
  })).filter((grp) => grp.items.length > 0);
  const unstyled = geo.filter((i) => !i.primaryStyle);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">
          {g.type === "ingredient" ? t("titleIngredient", { name }) : t("title", { name })}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("count", { count: items.length })}
        </p>
        <p className="mt-3">
          <Link href="/" className="text-sm underline">
            {t("viewOnMap")}
          </Link>
        </p>
      </header>

      {[...byStyle, ...(unstyled.length > 0 ? [{ style: null, items: unstyled }] : [])].map(
        (grp) => (
          <section key={grp.style ?? "-"} className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              {grp.style && (
                <span
                  aria-hidden
                  className="inline-block size-3.5 rounded-full border"
                  style={{ backgroundColor: styleColor(grp.style), borderColor: PIN_STROKE }}
                />
              )}
              {/* 系統を持つジャンルでは「その他」、持たないジャンルでは「ご当地」と読ませる */}
              {grp.style ? ts(grp.style) : byStyle.length > 0 ? t("otherStyles") : t("regional")}
              <span className="text-muted-foreground text-sm font-normal">
                {grp.items.length}
              </span>
            </h2>
            <ul className="space-y-3">
              {grp.items.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/${genre}/${item.slug}`}
                    className="hover:bg-muted/50 block rounded-lg border p-3"
                  >
                    <span className="block font-medium">
                      {locale === "ja" ? item.nameJa : item.nameRomaji}
                    </span>
                    {/* 三点セット（.doc/00_concept/05_brand.md §5） */}
                    <span className="text-muted-foreground block text-xs">
                      {item.nameJa} — {item.nameRomaji}
                      {item.nameEn ? ` — ${item.nameEn}` : ""}
                    </span>
                    {item.originPref && (
                      <span className="text-muted-foreground mt-1 block text-xs">
                        {tp(item.originPref)}
                        {item.originCity ? ` / ${item.originCity}` : ""}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}

      {/* 図鑑: 発祥地の物語を持たないアイテム（部位・定番種）。データが入れば自動で現れる */}
      {nonGeo.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">{t("encyclopedia")}</h2>
          <ul className="grid grid-cols-2 gap-3">
            {nonGeo.map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/${genre}/${item.slug}`}
                  className="hover:bg-muted/50 block rounded-lg border p-3"
                >
                  <span className="block font-medium">
                    {locale === "ja" ? item.nameJa : item.nameRomaji}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {item.nameRomaji}
                    {item.nameEn ? ` — ${item.nameEn}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 地域から探す（この genre のデータがある県だけが自然に並ぶ） */}
      <section className="border-t pt-6">
        <h2 className="mb-3 text-sm font-semibold">{t("byRegion")}</h2>
        <ul className="flex flex-wrap gap-2">
          {[...new Set(geo.map((i) => i.originPref).filter(Boolean))].map((pref) => (
            <li key={pref}>
              <Link
                href={`/region/${PREF_SLUGS[pref as Prefecture]}`}
                className="bg-muted text-muted-foreground hover:bg-muted/70 inline-block rounded-full px-3 py-1 text-xs"
              >
                {tp(pref as string)}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
