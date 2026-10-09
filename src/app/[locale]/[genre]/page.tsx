import { notFound } from "next/navigation";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { CoverHeader } from "@/components/CoverHeader";
import { IndexRow } from "@/components/IndexRow";
import { RowList } from "@/components/RowList";
import { SectionHeading } from "@/components/SectionHeading";
import { buttonVariants } from "@/components/ui/button";
import { filterChipClass } from "@/components/ui/chip";
import { ArrowLink, LinkCloud } from "@/components/ui/text-link";
import {
  fetchChainsForGenre,
  fetchGenre,
  fetchGenreItems,
  fetchPlaceNames,
  fetchShelf,
  fetchShelfGenres,
  fetchShelfOtherItems,
  fetchShelves,
  type Genre,
  type Locale,
  type Shelf,
} from "@/features/map/queries";
import { translateCityName } from "@/features/map/placeNames";
import { ChainBridgeSection } from "@/features/map/ChainBridgeSection";
import { PIN_STROKE, styleColor } from "@/features/map/styles";
import { GUIDE_SCENES, fetchGuidesForItem } from "@/features/guide/queries";
import { localeAlternates } from "@/lib/seo";
import { englishGloss } from "@/lib/names";
import { PREF_SLUGS, type Prefecture } from "@/lib/prefectures";

/**
 * ジャンル/棚ページ（SEOの正面玄関のひとつ。"types of ramen" を受ける）。
 *
 * URLの第1セグメントは genres.slug で先に解決し、無ければ shelves.slug として
 * 解決する（CLAUDE.md「棚ページ + その他アイテムの到達経路」）。
 * genres/shelves のどちらに行を足してもページが生える。
 */
type Params = { locale: string; genre: string };

// ISR（`revalidate = 300`）。全件系クエリ（fetchGenreItems等）を持つため
// トップと同じ対応。詳細: `.doc/10_system/02_infrastructure.md` §1「ISRキャッシュ」。
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale, genre } = await params;

  const g = await fetchGenre(genre);
  if (g) {
    const items = await fetchGenreItems(genre, locale as Locale);
    const name = locale === "ja" ? g.nameJa : g.nameEn;
    const ing = g.type === "ingredient";
    const cut = g.type === "cut";
    return {
      title:
        locale === "ja"
          ? cut
            ? `${name}の一覧（${items.length}件）`
            : ing
              ? `${name}の銘柄と産地（${items.length}件）`
              : `${name}の種類（${items.length}種）— 生まれた土地から`
          : cut
            ? `${name} — ${items.length} entries`
            : ing
              ? `${name} — brands and regions`
              : `${items.length} kinds of ${name}, by where they were born`,
      description:
        locale === "ja"
          ? cut
            ? `${name}を、味・扱い方・料理での位置づけで整理した一覧。`
            : ing
              ? `日本各地の${name}の銘柄と産地を整理した一覧。`
              : `${name}${items.length}種を、生まれた土地と系統で整理した一覧。全国で食べられる型も、ここでしか出会えない型も。`
          : cut
            ? `${name} organized by taste, handling, and their place on the table.`
            : ing
              ? `${name} brands and their source regions across Japan.`
              : `${items.length} kinds of ${name}, organized by where each was born and how it is made — from styles served nationwide to ones found only in one town.`,
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
  const tc = await getTranslations("chain");
  const tp = await getTranslations("prefecture");
  const tg = await getTranslations("guide");
  const [items, chains, placeNames, messages, beforeYouGoGuides, shelf] = await Promise.all([
    fetchGenreItems(genreSlug, locale as Locale),
    fetchChainsForGenre(genreSlug),
    // 市区町村名の他言語表記（一覧行の発祥表記用。実装部隊の報告「/en の本場・産地
    // チップに市区町村名が日本語のまま」対応）。ja では不要。
    locale === "en" ? fetchPlaceNames("en") : Promise.resolve({}),
    getMessages(),
    // 「食べに行く前に」（2026-09-24「場面」）。genre/shelfのいずれかにguide_linksで
    // 結ばれたガイドを逆引きする（詳細ページ [genre]/[slug]/page.tsx と同じ関数）
    fetchGuidesForItem({ genreSlug, shelfSlug: g.shelfSlug, tagSlugs: [] }, locale as "ja" | "en"),
    // カバーの眉（棚名）用
    fetchShelf(g.shelfSlug),
  ]);
  // この genre を含む場面（GUIDE_SCENES はコード定数なのでDB問い合わせ不要）
  const genreScenes = GUIDE_SCENES.filter((s) => (s.genres as readonly string[]).includes(genreSlug));
  const geo = items.filter((i) => i.lat !== null);
  const nonGeo = items.filter((i) => i.lat === null);
  const isJa = locale === "ja";
  const name = isJa ? g.nameJa : g.nameEn;
  const otherName = isJa ? g.nameEn : g.nameJa;
  const shelfName = shelf ? (isJa ? shelf.nameJa : shelf.nameEn) : null;
  const intro = isJa ? g.introJa : g.introEn;
  const originLabel = (item: (typeof items)[number]) =>
    item.originPref
      ? `${tp(item.originPref)}${
          item.originCity
            ? ` ${translateCityName(item.originPref, item.originCity, locale as Locale, placeNames)}`
            : ""
        }`
      : null;

  // 系統名の表示ラベルを解決する（2026-09 系統の自由化: ジャンルごとに任意の値を
  // 持てるため、固定の翻訳キー一覧を前提にできない）。
  // 1. ja / en 共通: messages.style（旧ラーメン4系統+その他の訳語）に一致すればそれを使う
  // 2. en のみ: messages.styleNames（ジャンルごとの系統の英語名。無ければ未訳）を見る
  // 3. どちらにも無ければ入力値をそのまま表示する（ja はそもそも日本語なので実質これで足りる）
  const styleDict = (messages.style ?? {}) as Record<string, string>;
  const styleNamesDict = (messages.styleNames ?? {}) as Record<string, string>;
  const translateStyle = (style: string): string =>
    styleDict[style] ?? (locale === "en" ? styleNamesDict[style] : undefined) ?? style;

  // 系統ごとにグルーピング（データに実際に現れる系統だけが出る。出現順）。
  // 系統は発祥地の有無に関係なく付くので（洋食の「フライ」「肉」は全国区＝図鑑枠が多い）、
  // 系統群は全アイテムから作り、図鑑には「系統も発祥地も持たない」ものだけを残す
  const styleOrder: string[] = [];
  for (const item of items) {
    if (item.primaryStyle && !styleOrder.includes(item.primaryStyle)) {
      styleOrder.push(item.primaryStyle);
    }
  }
  const byStyle = styleOrder.map((style) => ({
    style,
    items: items.filter((i) => i.primaryStyle === style),
  }));
  const unstyled = geo.filter((i) => !i.primaryStyle);
  const nonGeoUnstyled = nonGeo.filter((i) => !i.primaryStyle);
  const groups = [...byStyle, ...(unstyled.length > 0 ? [{ style: null, items: unstyled }] : [])];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-8 md:max-w-3xl">
      <div className="px-4 md:px-0">
        <CoverHeader
          eyebrow={shelfName}
          title={name}
          subtitle={!isJa && otherName !== name ? otherName : null}
          meta={t("count", { count: items.length })}
        />
      </div>

      <div className="px-4 pt-stack md:px-0">
        {/* 国民食型ジャンルの総論（未投入なら null。データが入れば自動で現れる） */}
        {intro && <p className="type-body text-foreground/90 mb-stack max-w-prose">{intro}</p>}

        {/* 系統チップ（ラーメンのみ・系統色。他ジャンルは系統を持たないため出ない） */}
        {byStyle.length > 0 && (
          <nav aria-label={t("styleNavLabel")} className="mb-section flex flex-wrap gap-2">
            {byStyle.map((grp) => (
              <a key={grp.style} href={`#style-${grp.style}`} className={filterChipClass({ size: "sm" })}>
                <span
                  aria-hidden
                  className="inline-block size-2.5 rounded-full border"
                  style={{ backgroundColor: styleColor(grp.style), borderColor: PIN_STROKE }}
                />
                {translateStyle(grp.style)}
                <span className="text-muted-foreground tabular-nums">{grp.items.length}</span>
              </a>
            ))}
          </nav>
        )}

        {groups.map((grp) => (
          <section
            key={grp.style ?? "-"}
            id={grp.style ? `style-${grp.style}` : undefined}
            className="mb-section scroll-mt-[calc(var(--header-height)+1rem)]"
          >
            <SectionHeading
              count={grp.items.length}
              mark={
                grp.style ? (
                  <span
                    aria-hidden
                    className="inline-block size-3 shrink-0 rounded-full border"
                    style={{ backgroundColor: styleColor(grp.style), borderColor: PIN_STROKE }}
                  />
                ) : null
              }
            >
              {/* 系統を持つジャンルでは「その他」、持たないジャンルでは「ご当地」と読ませる */}
              {grp.style ? translateStyle(grp.style) : byStyle.length > 0 ? t("otherStyles") : t("regional")}
            </SectionHeading>
            <ul className="divide-rule divide-y">
              {grp.items.map((item) => (
                <li key={item.slug}>
                  {/* 三点セット（.doc/00_concept/05_brand.md §5）は /en で。/ja の一覧では
                      英語の説明訳が主役になってしまうため、ローマ字+日本語の概要にする
                      （本番レビュー「日本語ページに英語が大量」対応）。発祥は行末の小さな注 */}
                  <IndexRow
                    href={`/${genreSlug}/${item.slug}`}
                    name={isJa ? item.nameJa : item.nameRomaji}
                    aside={isJa ? item.nameRomaji : item.nameJa}
                    gloss={isJa ? null : englishGloss(item.nameEn, item.nameRomaji)}
                    summary={isJa ? item.summary : null}
                    labels={
                      originLabel(item) ? (
                        <span className="type-caption text-muted-foreground">{originLabel(item)}</span>
                      ) : null
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* 図鑑: 発祥地の物語を持たないアイテム（部位・定番種）。データが入れば自動で現れる */}
        {nonGeoUnstyled.length > 0 && (
          <section className="mb-section">
            <SectionHeading count={nonGeoUnstyled.length}>{t("encyclopedia")}</SectionHeading>
            <ul className="divide-rule grid grid-cols-1 divide-y md:grid-cols-2 md:gap-x-8">
              {nonGeoUnstyled.map((item) => (
                <li key={item.slug}>
                  <IndexRow
                    href={`/${genreSlug}/${item.slug}`}
                    name={isJa ? item.nameJa : item.nameRomaji}
                    aside={isJa ? item.nameRomaji : null}
                    gloss={isJa ? null : englishGloss(item.nameEn, item.nameRomaji)}
                    summary={isJa ? item.summary : null}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* CTA: この一覧を地図で見る */}
        <p className="mb-section">
          <Link href="/" className={buttonVariants({ size: "lg", className: "px-4" })}>
            {t("mapCta", { name })}
          </Link>
        </p>

        {/* 食べに行く前に（2026-09-24「場面」）。この genre を含む場面のチップ＋
            この genre に紐づくガイドの上位3件。どちらも0件なら節ごと出さない */}
        {(genreScenes.length > 0 || beforeYouGoGuides.length > 0) && (
          // 「次に進む入口」（ガイドへ）はカード枠にまとめる。中身は罫線区切りの行
          <section className="border-rule bg-background mb-section rounded-xl border px-4 pt-4 pb-2 md:px-5">
            <SectionHeading variant="label">{t("beforeYouGoHeading")}</SectionHeading>
            {genreScenes.length > 0 && (
              <LinkCloud
                className="mb-2"
                items={genreScenes.map((s) => ({
                  key: s.slug,
                  href: `/guide/scene/${s.slug}`,
                  label: tg("sceneChip", { name: tg(`scene.${s.slug}`) }),
                }))}
              />
            )}
            <RowList
              rows={beforeYouGoGuides.map((guide) => ({
                key: guide.slug,
                href: `/guide/${guide.slug}`,
                title: guide.title,
                meta: guide.summary,
              }))}
            />
          </section>
        )}

        {/* チェーンから、ご当地へ（chains.genre_slug が一致するチェーンがあるジャンルのみ） */}
        <ChainBridgeSection
          heading={t("chainsHeading")}
          intro={t("chainsIntro")}
          chains={chains}
          locale={locale}
          prefLimitedLabel={(pref) => tc("prefLimited", { pref: tp(pref as Prefecture) })}
        />

        {/* 地域から探す（この genre のデータがある県だけが自然に並ぶ） */}
        {geo.length > 0 && (
          <section className="border-rule mb-stack border-t pt-stack">
            <SectionHeading variant="label">{t("byRegion")}</SectionHeading>
            <LinkCloud
              items={[...new Set(geo.map((i) => i.originPref).filter(Boolean))].map((pref) => ({
                key: pref as string,
                href: `/region/${PREF_SLUGS[pref as Prefecture]}`,
                label: tp(pref as string),
              }))}
            />
          </section>
        )}

        {/* 末尾: 同じ棚の仲間（棚ページへ。行き止まり禁止） */}
        <section className="border-rule border-t pt-stack">
          <ul className="flex flex-wrap gap-2">
            <li>
              <ArrowLink href={`/${g.shelfSlug}`}>{t("shelfSiblingsTitle")}</ArrowLink>
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
  const tg = await getTranslations("genre");
  const tc = await getTranslations("chain");
  const tp = await getTranslations("prefecture");
  const isJa = locale === "ja";
  // 棚ページにだけ属する料理（カレー・餃子・鍋・定食）のチェーンは genre_slug に棚 slug を持つ
  const [genres, others, allShelves, chains] = await Promise.all([
    fetchShelfGenres(shelf.slug),
    fetchShelfOtherItems(shelf.slug, locale as Locale),
    fetchShelves(),
    fetchChainsForGenre(shelf.slug),
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
          eyebrow={t(`grpMeta.${shelf.grp}`)}
          title={name}
          subtitle={isJa ? null : shelf.nameJa}
          meta={t("count", { count: totalCount })}
        />
      </div>

      <div className="px-4 pt-stack md:px-0">
        {/* 主要ジャンルのカード: この棚に属する genres */}
        {genres.length > 0 && (
          <section className="mb-section">
            <SectionHeading>{t("genresTitle")}</SectionHeading>
            <ul className="divide-rule divide-y">
              {genres.map((genreRow) => (
                <li key={genreRow.slug}>
                  <IndexRow
                    href={`/${genreRow.slug}`}
                    name={isJa ? genreRow.nameJa : genreRow.nameEn}
                    aside={isJa ? genreRow.nameEn : genreRow.nameJa}
                    labels={
                      <span className="type-caption text-muted-foreground tabular-nums">{genreRow.itemCount}</span>
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* まだ数の少ない仲間たち: genre_id が null のその他アイテム */}
        {others.length > 0 && (
          <section className="mb-section">
            <SectionHeading count={others.length}>{t("othersTitle")}</SectionHeading>
            <p className="type-note text-muted-foreground mb-1">{t("othersHint")}</p>
            <ul className="divide-rule divide-y">
              {others.map((item) => (
                <li key={item.slug}>
                  <IndexRow
                    href={`/${shelf.slug}/${item.slug}`}
                    name={isJa ? item.nameJa : item.nameRomaji}
                    aside={isJa ? item.nameRomaji : item.nameJa}
                    gloss={isJa ? null : englishGloss(item.nameEn, item.nameRomaji)}
                    summary={isJa ? item.summary : null}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* チェーンから、ご当地へ（棚 slug を genre_slug に持つチェーンがあるときだけ） */}
        <ChainBridgeSection
          heading={tg("chainsHeading")}
          intro={tg("chainsIntro")}
          chains={chains}
          locale={locale}
          prefLimitedLabel={(pref) => tc("prefLimited", { pref: tp(pref as Prefecture) })}
        />

        {/* 関連する他の棚（同じ grp）。行き止まり禁止 */}
        {relatedShelves.length > 0 && (
          <section className="border-rule border-t pt-stack">
            <SectionHeading variant="label">{t("relatedShelvesTitle")}</SectionHeading>
            <LinkCloud
              items={relatedShelves.map((s) => ({
                key: s.slug,
                href: `/${s.slug}`,
                label: isJa ? s.nameJa : s.nameEn,
              }))}
            />
          </section>
        )}
      </div>

      <div className="px-4 md:px-0">
        <SiteFooter locale={locale} />
      </div>
    </main>
  );
}
