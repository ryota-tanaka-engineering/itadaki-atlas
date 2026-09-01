import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { CoverHeader } from "@/components/CoverHeader";
import { buttonVariants } from "@/components/ui/button";
import {
  fetchChainsForGenre,
  fetchGenre,
  fetchGenreItems,
  fetchShelf,
  fetchShelfGenres,
  fetchShelfOtherItems,
  fetchShelves,
  type Genre,
  type Locale,
  type Shelf,
} from "@/features/map/queries";
import { ChainBridgeSection } from "@/features/map/ChainBridgeSection";
import { PIN_STROKE, PRIMARY_STYLES, styleColor } from "@/features/map/styles";
import { localeAlternates } from "@/lib/seo";
import { PREF_SLUGS, type Prefecture } from "@/lib/prefectures";

/**
 * ジャンル/棚ページ（SEOの正面玄関のひとつ。"types of ramen" を受ける）。
 *
 * URLの第1セグメントは genres.slug で先に解決し、無ければ shelves.slug として
 * 解決する（CLAUDE.md「棚ページ + その他アイテムの到達経路」）。
 * genres/shelves のどちらに行を足してもページが生える。
 */
type Params = { locale: string; genre: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale, genre } = await params;

  const g = await fetchGenre(genre);
  if (g) {
    const items = await fetchGenreItems(genre, locale as Locale);
    const name = locale === "ja" ? g.nameJa : g.nameEn;
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

  const shelf = await fetchShelf(genre);
  if (!shelf) return {};
  const name = locale === "ja" ? shelf.nameJa : shelf.nameEn;
  return {
    title: locale === "ja" ? `${name}（棚）` : `${name}`,
    alternates: localeAlternates(`/${genre}`),
  };
}

export default async function GenreOrShelfPage({ params }: { params: Promise<Params> }) {
  const { locale, genre } = await params;
  setRequestLocale(locale);

  const g = await fetchGenre(genre);
  if (g) return <GenreView g={g} genreSlug={genre} locale={locale} />;

  const shelf = await fetchShelf(genre);
  if (shelf) return <ShelfView shelf={shelf} locale={locale} />;

  notFound();
}

// -----------------------------------------------------------------------------
// ジャンルページ
// -----------------------------------------------------------------------------

async function GenreView({ g, genreSlug, locale }: { g: Genre; genreSlug: string; locale: string }) {
  const t = await getTranslations("genre");
  const ts = await getTranslations("style");
  const tp = await getTranslations("prefecture");
  const [items, chains] = await Promise.all([
    fetchGenreItems(genreSlug, locale as Locale),
    fetchChainsForGenre(genreSlug),
  ]);
  const geo = items.filter((i) => i.lat !== null);
  const nonGeo = items.filter((i) => i.lat === null);
  const isJa = locale === "ja";
  const name = isJa ? g.nameJa : g.nameEn;
  const intro = isJa ? g.introJa : g.introEn;

  // 系統ごとにグルーピング（存在する系統だけが出る）
  const byStyle = PRIMARY_STYLES.map((style) => ({
    style,
    items: geo.filter((i) => i.primaryStyle === style),
  })).filter((grp) => grp.items.length > 0);
  const unstyled = geo.filter((i) => !i.primaryStyle);
  const groups = [...byStyle, ...(unstyled.length > 0 ? [{ style: null, items: unstyled }] : [])];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-8 md:max-w-3xl">
      <div className="px-4 md:px-0">
        <CoverHeader
          title={name}
          meta={t("count", { count: items.length })}
        />
      </div>

      <div className="px-4 pt-8 md:px-0">
        {/* 国民食型ジャンルの総論（未投入なら null。データが入れば自動で現れる） */}
        {intro && <p className="text-muted-foreground mb-8 leading-relaxed">{intro}</p>}

        {/* 系統チップ（ラーメンのみ・系統色。他ジャンルは系統を持たないため出ない） */}
        {byStyle.length > 0 && (
          <nav aria-label={t("styleNavLabel")} className="mb-8 flex flex-wrap gap-2">
            {byStyle.map((grp) => (
              <a
                key={grp.style}
                href={`#style-${grp.style}`}
                className="border-border inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
              >
                <span
                  aria-hidden
                  className="inline-block size-2.5 rounded-full border"
                  style={{ backgroundColor: styleColor(grp.style), borderColor: PIN_STROKE }}
                />
                {ts(grp.style)}
                <span className="text-muted-foreground">{grp.items.length}</span>
              </a>
            ))}
          </nav>
        )}

        {groups.map((grp) => (
          <section key={grp.style ?? "-"} id={grp.style ? `style-${grp.style}` : undefined} className="mb-10">
            <h2 className="font-serif border-border mb-3 flex items-center gap-2 border-b pb-2 text-lg">
              {grp.style && (
                <span
                  aria-hidden
                  className="inline-block size-3.5 rounded-full border"
                  style={{ backgroundColor: styleColor(grp.style), borderColor: PIN_STROKE }}
                />
              )}
              {/* 系統を持つジャンルでは「その他」、持たないジャンルでは「ご当地」と読ませる */}
              {grp.style ? ts(grp.style) : byStyle.length > 0 ? t("otherStyles") : t("regional")}
              <span className="text-muted-foreground text-sm font-normal">{grp.items.length}</span>
            </h2>
            <ul className="divide-border divide-y">
              {grp.items.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/${genreSlug}/${item.slug}`}
                    className="hover:bg-muted/40 -mx-2 block rounded-md px-2 py-3 transition-colors"
                  >
                    <span className="block font-medium">
                      {isJa ? item.nameJa : item.nameRomaji}
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
        ))}

        {/* 図鑑: 発祥地の物語を持たないアイテム（部位・定番種）。データが入れば自動で現れる */}
        {nonGeo.length > 0 && (
          <section className="mb-10">
            <h2 className="font-serif border-border mb-3 border-b pb-2 text-lg">{t("encyclopedia")}</h2>
            <ul className="divide-border grid grid-cols-2 divide-y">
              {nonGeo.map((item) => (
                <li key={item.slug} className="odd:pr-2">
                  <Link
                    href={`/${genreSlug}/${item.slug}`}
                    className="hover:bg-muted/40 -mx-2 block rounded-md px-2 py-3 transition-colors"
                  >
                    <span className="block font-medium">
                      {isJa ? item.nameJa : item.nameRomaji}
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

        {/* CTA: この一覧を地図で見る */}
        <p className="mb-10">
          <Link href="/" className={buttonVariants()}>
            {t("mapCta", { name })}
          </Link>
        </p>

        {/* チェーンから、ご当地へ（chains.genre_slug が一致するチェーンがあるジャンルのみ） */}
        <ChainBridgeSection
          heading={t("chainsHeading")}
          intro={t("chainsIntro")}
          chains={chains}
          locale={locale}
        />

        {/* 地域から探す（この genre のデータがある県だけが自然に並ぶ） */}
        {geo.length > 0 && (
          <section className="border-border mb-8 border-t pt-6">
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
        )}

        {/* 末尾: 同じ棚の仲間（棚ページへ。行き止まり禁止） */}
        <section className="border-border border-t pt-6">
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link
                href={`/${g.shelfSlug}`}
                className="bg-muted text-muted-foreground hover:bg-muted/70 inline-block rounded-full px-3 py-1 text-xs"
              >
                {t("shelfSiblingsTitle")}
              </Link>
            </li>
          </ul>
        </section>
      </div>

      <div className="px-4 md:px-0">
        <SiteFooter locale={locale} />
      </div>
    </main>
  );
}

// -----------------------------------------------------------------------------
// 棚ページ（genres に無いURLセグメントを shelves.slug として解決した場合）
// -----------------------------------------------------------------------------

async function ShelfView({ shelf, locale }: { shelf: Shelf; locale: string }) {
  const t = await getTranslations("shelf");
  const isJa = locale === "ja";
  const [genres, others, allShelves] = await Promise.all([
    fetchShelfGenres(shelf.slug),
    fetchShelfOtherItems(shelf.slug, locale as Locale),
    fetchShelves(),
  ]);

  const totalCount = genres.reduce((sum, g) => sum + g.itemCount, 0) + others.length;
  // データが1件も無い棚は薄いページを量産しないため404にする
  // （region ページと同じ方針。CLAUDE.md「行き止まり禁止」の裏側）
  if (totalCount === 0) notFound();

  const relatedShelves = allShelves.filter((s) => s.grp === shelf.grp && s.slug !== shelf.slug);
  const name = isJa ? shelf.nameJa : shelf.nameEn;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-8 md:max-w-3xl">
      <div className="px-4 md:px-0">
        <CoverHeader
          title={name}
          subtitle={t(`grpMeta.${shelf.grp}`)}
          meta={t("count", { count: totalCount })}
        />
      </div>

      <div className="px-4 pt-8 md:px-0">
        {/* 主要ジャンルのカード: この棚に属する genres */}
        {genres.length > 0 && (
          <section className="mb-10">
            <h2 className="font-serif border-border mb-3 border-b pb-2 text-lg">{t("genresTitle")}</h2>
            <ul className="divide-border divide-y">
              {genres.map((genreRow) => (
                <li key={genreRow.slug}>
                  <Link
                    href={`/${genreRow.slug}`}
                    className="hover:bg-muted/40 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-3 transition-colors"
                  >
                    <span>
                      <span className="block font-medium">
                        {isJa ? genreRow.nameJa : genreRow.nameEn}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {genreRow.nameJa} — {genreRow.nameEn}
                      </span>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">{genreRow.itemCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* まだ数の少ない仲間たち: genre_id が null のその他アイテム */}
        {others.length > 0 && (
          <section className="mb-10">
            <h2 className="font-serif border-border mb-1 border-b pb-2 text-lg">{t("othersTitle")}</h2>
            <p className="text-muted-foreground mb-3 text-xs">{t("othersHint")}</p>
            <ul className="divide-border divide-y">
              {others.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/${shelf.slug}/${item.slug}`}
                    className="hover:bg-muted/40 -mx-2 block rounded-md px-2 py-3 transition-colors"
                  >
                    <span className="block font-medium">
                      {isJa ? item.nameJa : item.nameRomaji}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {item.nameJa} — {item.nameRomaji}
                      {item.nameEn ? ` — ${item.nameEn}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 関連する他の棚（同じ grp）。行き止まり禁止 */}
        {relatedShelves.length > 0 && (
          <section className="border-border border-t pt-6">
            <h2 className="mb-3 text-sm font-semibold">{t("relatedShelvesTitle")}</h2>
            <ul className="flex flex-wrap gap-2">
              {relatedShelves.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/${s.slug}`}
                    className="bg-muted text-muted-foreground hover:bg-muted/70 inline-block rounded-full px-3 py-1 text-xs"
                  >
                    {isJa ? s.nameJa : s.nameEn}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="px-4 md:px-0">
        <SiteFooter locale={locale} />
      </div>
    </main>
  );
}
