import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import {
  fetchItemBySlug,
  fetchItemByShelfSlug,
  fetchRelated,
  fetchSamePref,
  fetchShelfSiblings,
  fetchStyleSiblings,
  type Locale,
} from "@/features/map/queries";
import { styleColor } from "@/features/map/styles";
import { parseBodyMarkdown } from "@/features/map/markdown";
import { PositionBand } from "@/features/map/PositionBand";
import { TableOfContents, BodyChapters } from "@/features/map/ItemBody";
import { ItemConnections, type ConnectionCard, type RegionPill } from "@/features/map/ItemConnections";
import { localeAlternates } from "@/lib/seo";
import { PREF_SLUGS, type Prefecture } from "@/lib/prefectures";

type Params = { locale: string; genre: string; slug: string };

/**
 * genre セグメントは genres.slug でまず解決し、無ければ shelves.slug として
 * 解決する（棚内「その他」= genre_id null のアイテムのURL。CLAUDE.md参照）。
 */
async function resolveItem(genre: string, slug: string, locale: Locale) {
  return (await fetchItemBySlug(genre, slug, locale)) ?? (await fetchItemByShelfSlug(genre, slug, locale));
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale, genre, slug } = await params;
  const item = await resolveItem(genre, slug, locale as Locale);
  if (!item) return {};

  // 三点セットをタイトルにも出す（.doc/00_concept/05_brand.md §5）
  const title =
    locale === "ja"
      ? `${item.nameJa}（${item.nameRomaji}）`
      : `${item.nameRomaji}${item.nameEn ? ` — ${item.nameEn}` : ""}`;

  return {
    title,
    description: item.summary ?? undefined,
    alternates: localeAlternates(`/${genre}/${slug}`),
    openGraph: {
      type: "article",
      title,
      description: item.summary ?? undefined,
      locale,
    },
  };
}

export default async function ItemPage({ params }: { params: Promise<Params> }) {
  const { locale, genre, slug } = await params;
  setRequestLocale(locale);

  const item = await resolveItem(genre, slug, locale as Locale);
  if (!item) notFound();

  const t = await getTranslations("item");
  const tp = await getTranslations("prefecture");
  const ts = await getTranslations("style");
  const tr = await getTranslations("relation");
  const trr = await getTranslations("regionRelation");
  const isJa = locale === "ja";

  // 行き止まり禁止（回遊が価値の中核）。relations に行を足すと双方向で増え、
  // 同県リンクはデータを足すだけで自動で増える
  const [related, samePrefAll, styleSiblings] = await Promise.all([
    fetchRelated(slug, locale as Locale),
    item.originPref
      ? fetchSamePref(slug, item.originPref, locale as Locale)
      : Promise.resolve([]),
    item.genreSlug
      ? fetchStyleSiblings(item.genreSlug, slug, item.primaryStyle, locale as Locale)
      : fetchShelfSiblings(item.shelfSlug, slug, locale as Locale),
  ]);
  // 名前つき関係で既に出ているアイテムは同県リストから外す（重複表示を避ける）
  const relatedSlugs = new Set(related.map((r) => r.slug));
  const samePref = samePrefAll.filter((r) => !relatedSlugs.has(r.slug));

  // 英訳は「名前」ではなく説明訳なので、英語表示でも見出しはローマ字にする
  // （.doc/00_concept/05_brand.md §5）。説明訳は副題として添える。
  const displayName = isJa ? item.nameJa : item.nameRomaji;
  const subtitle = isJa ? item.nameRomaji : item.nameEn;

  // 1. カバー: 「棚名 ── ジャンル名」（その他アイテムは棚名のみ）
  const shelfName = isJa ? item.shelfNameJa : item.shelfNameEn;
  const genreName = isJa ? item.genreNameJa : item.genreNameEn;
  const breadcrumb = genreName ? `${shelfName} ── ${genreName}` : shelfName;

  // 2. 位置帯: 発祥地名+座標。座標が無いアイテム（部位・定番種）は帯ごと出さない
  const hasGeo = item.lat !== null && item.lng !== null;
  const placeLabel = item.originPref
    ? `${tp(item.originPref)}${item.originCity ? (isJa ? item.originCity : ` ${item.originCity}`) : ""}`
    : item.nameRomaji;

  // 3. 本文: body_md が無ければ目次ごと非表示（Tier1でもページが欠けて見えない設計）
  const chapters = item.bodyMd ? parseBodyMarkdown(item.bodyMd) : [];
  const tocHeading = t("toc");

  // 4. つながり（2軸）
  const styleTitle = t("connectionsStyleTitle");
  const landTitle = t("connectionsLandTitle");

  // ジャンルを持つ相手は /[genreSlug]/[slug]、持たない相手（棚内「その他」）は
  // /[shelfSlug]/[slug] へ。どちらも到達可能（CLAUDE.md「棚ページ + その他アイテムの
  // 到達経路」）なので、ここでは相手を取りこぼさない。
  const styleSiblingCards: ConnectionCard[] = styleSiblings.map((s) => ({
    key: s.slug,
    href: `/${s.genreSlug ?? s.shelfSlug}/${s.slug}`,
    name: isJa ? s.nameJa : s.nameRomaji,
    meta: s.summary ?? undefined,
  }));
  const viewAllHref = item.genreSlug ? `/${item.genreSlug}` : null;
  const viewAllLabel =
    item.genreSlug && genreName ? t("connectionsViewAll", { name: genreName }) : null;

  const regionPills: RegionPill[] = item.regions.map((r) => ({
    // 同一県・同一種別に複数都市が並ぶ（例: 海鮮丼の本場=釧路・小樽・函館）ため city も key に含める
    key: `${r.pref}-${r.city ?? ""}-${r.relationType}`,
    href: `/region/${PREF_SLUGS[r.pref as Prefecture]}`,
    label: `${tp(r.pref)}${r.city ? ` ${r.city}` : ""} ${trr(r.relationType)}`,
    note: isJa ? r.noteJa : r.noteEn,
  }));
  // 小見出しは実際に並ぶ種別から作る（本場だけなのに「名産地」と出さない）
  const regionKinds = [...new Set(item.regions.map((r) => r.relationType))];
  const regionsTitle =
    item.regions.length > 0 ? regionKinds.map((k) => trr(k)).join(isJa ? "・" : " / ") : null;

  const relatedCards: ConnectionCard[] = related.map((r) => ({
    key: `${r.relationType}-${r.slug}`,
    href: `/${genre}/${r.slug}`,
    name: isJa ? r.nameJa : r.nameRomaji,
    badge: tr(`${r.relationType}.${r.otherIsFrom ? "otherIsFrom" : "otherIsTo"}`),
    meta: r.summary ?? undefined,
  }));
  const samePrefCards: ConnectionCard[] = samePref.map((r) => ({
    key: `same-${r.slug}`,
    // 相手自身のジャンル/棚を使う（現在ページの genre/shelf は相手と一致するとは限らない）
    href: `/${r.genreSlug ?? r.shelfSlug}/${r.slug}`,
    name: isJa ? r.nameJa : r.nameRomaji,
    badge: item.originPref ? t("samePref", { pref: tp(item.originPref) }) : undefined,
  }));
  const landCards = [...relatedCards, ...samePrefCards];
  const regionPageHref = item.originPref ? `/region/${PREF_SLUGS[item.originPref as Prefecture]}` : null;
  const regionPageLabel = item.originPref ? t("regionPage", { pref: tp(item.originPref) }) : null;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-8 md:max-w-5xl">
      <article>
        {/* 1〜2. カバー + 位置帯。PCではカバー左テキスト・右に位置帯パネル */}
        <div className="bg-primary md:grid md:grid-cols-[1fr_320px] md:items-stretch md:gap-8 md:rounded-2xl md:p-10">
          <header className="text-primary-foreground px-4 py-8 md:px-0 md:py-0">
            {/* クリーム系（CLAUDE.md「詳細ページの確定構造」1節。淡トークン#ffc985とは別の、
                橙カバー上での可読性用の一色） */}
            <p className="text-xs" style={{ color: "#ffe9cf" }}>
              {breadcrumb}
            </p>

            {item.primaryStyle && (
              <div className="mt-2 flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block size-3.5 rounded-full border"
                  style={{ backgroundColor: styleColor(item.primaryStyle), borderColor: "#fffdf7" }}
                />
                <span className="text-sm">{ts(item.primaryStyle)}</span>
              </div>
            )}

            {/* 三点セット: 日本語名を大きく（明朝・白） */}
            <h1 className="font-serif mt-3 text-3xl md:text-4xl">{displayName}</h1>
            {subtitle && (
              <p className="mt-1 text-base" style={{ color: "#ffe9cf" }}>
                {subtitle}
              </p>
            )}
          </header>

          {hasGeo && (
            <div className="px-4 pb-4 md:px-0 md:py-2">
              <PositionBand lat={item.lat as number} lng={item.lng as number} label={placeLabel} />
            </div>
          )}
        </div>

        {/* 3. 本文（紙） */}
        <div className="px-4 pt-8 md:grid md:grid-cols-[minmax(0,700px)_260px] md:items-start md:gap-10 md:px-0">
          <div className="min-w-0">
            {item.summary && <p className="mb-8 leading-relaxed">{item.summary}</p>}

            <TableOfContents chapters={chapters} heading={tocHeading} className="mb-8 md:hidden" />

            <BodyChapters chapters={chapters} />

            {(item.originPref || item.primaryStyle) && (
              <dl className="mb-8 text-sm">
                {item.originPref && (
                  <div className="flex gap-3 py-1">
                    <dt className="text-muted-foreground w-20 shrink-0">{t("origin")}</dt>
                    <dd>
                      {tp(item.originPref)}
                      {item.originCity ? ` / ${item.originCity}` : ""}
                    </dd>
                  </div>
                )}
                {item.primaryStyle && (
                  <div className="flex gap-3 py-1">
                    <dt className="text-muted-foreground w-20 shrink-0">{t("style")}</dt>
                    <dd>{ts(item.primaryStyle)}</dd>
                  </div>
                )}
              </dl>
            )}

            {/* 4. つながり（SP: 本文の下） */}
            <ItemConnections
              className="md:hidden"
              styleTitle={styleTitle}
              styleSiblings={styleSiblingCards}
              viewAllHref={viewAllHref}
              viewAllLabel={viewAllLabel}
              landTitle={landTitle}
              regionsTitle={regionsTitle}
              regions={regionPills}
              landItems={landCards}
              regionPageHref={regionPageHref}
              regionPageLabel={regionPageLabel}
            />
          </div>

          {/* PC: 右サイド sticky（目次+つながり） */}
          <aside className="hidden md:sticky md:top-[calc(var(--header-height)+1.5rem)] md:block md:space-y-8">
            <TableOfContents chapters={chapters} heading={tocHeading} />
            <ItemConnections
              styleTitle={styleTitle}
              styleSiblings={styleSiblingCards}
              viewAllHref={viewAllHref}
              viewAllLabel={viewAllLabel}
              landTitle={landTitle}
              regionsTitle={regionsTitle}
              regions={regionPills}
              landItems={landCards}
              regionPageHref={regionPageHref}
              regionPageLabel={regionPageLabel}
            />
          </aside>
        </div>

        {/* 5. 出典はDB内部の検証データ。UIには出さず、訂正導線だけを残す */}
        <p className="mt-10 px-4 text-center md:px-0">
          <Link href="/contact" className="text-brand-accent-dark text-xs underline">
            {t("correction")}
          </Link>
        </p>
      </article>

      <div className="px-4 md:px-0">
        <SiteFooter locale={locale} />
      </div>
    </main>
  );
}
