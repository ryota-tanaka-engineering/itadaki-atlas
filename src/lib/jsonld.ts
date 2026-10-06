/**
 * JSON-LD（schema.org）構造化データの組み立て（2026-10-06。要件 F-08「構造化データ」の実装）。
 *
 * 検索のリッチリザルトと、AI 検索に正しく引用されること（AIO）の両方に効く。
 * ここは**純関数だけ**（URL は呼び出し側が絶対URLにして渡す）。描画は
 * `src/components/JsonLd.tsx` が担う。
 *
 * 方針:
 * - 事実だけを載せる（名前の三点セット・概要・発祥地の座標・パンくず・一覧）。本文や伝承は載せない
 * - 料理・食材は `Article` の `about` に `Thing` を置く（schema.org に「料理の型」の専用型は無く、
 *   `Recipe` は調理手順を要求するため使わない）。発祥地は `contentLocation` の `Place`
 * - ガイドは `Article`（`HowTo` は Google のリッチリザルト対象外になったため使わない）
 * - ランキング的な値（rating・review）は入れない（CLAUDE.md「禁止の継続」）
 */
export type JsonLdObject = Record<string, unknown>;

const CONTEXT = "https://schema.org";

export type SiteInfo = {
  siteUrl: string;
  name: string;
  description: string;
  locale: string;
};

/** サイト全体（layout）。WebSite + 発行者 Organization。 */
export function websiteJsonLd(site: SiteInfo): JsonLdObject[] {
  const org = organizationRef(site);
  return [
    {
      "@context": CONTEXT,
      "@type": "WebSite",
      "@id": `${site.siteUrl}/#website`,
      url: `${site.siteUrl}/${site.locale}`,
      name: site.name,
      description: site.description,
      inLanguage: site.locale,
      publisher: { "@id": org["@id"] },
    },
    { "@context": CONTEXT, ...org },
  ];
}

function organizationRef(site: Pick<SiteInfo, "siteUrl" | "name">): JsonLdObject {
  return {
    "@type": "Organization",
    "@id": `${site.siteUrl}/#organization`,
    name: site.name,
    url: site.siteUrl,
  };
}

export type BreadcrumbItem = { name: string; url: string };

/** パンくず（トップ → 棚 → ジャンル → 料理 など）。並び順がそのまま position になる。 */
export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdObject {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export type FoodItemLd = {
  url: string;
  locale: string;
  /** 見出し（ja は日本語名、en はローマ字） */
  headline: string;
  nameJa: string;
  nameRomaji: string;
  nameEn: string | null;
  summary: string | null;
  /** 発祥地（無ければ null＝図鑑枠） */
  origin: { pref: string; city: string | null; lat: number | null; lng: number | null } | null;
  /** 「ジャンル」「棚」など、属する区分の名前（keywords 用） */
  sectionNames: string[];
  site: Pick<SiteInfo, "siteUrl" | "name">;
};

/** 料理・食材の詳細ページ。Article + about(Thing) + contentLocation(Place)。 */
export function foodItemJsonLd(item: FoodItemLd): JsonLdObject {
  const alternate = [item.nameRomaji, item.nameEn, item.locale === "ja" ? null : item.nameJa].filter(
    (v): v is string => !!v && v !== item.headline,
  );
  const about: JsonLdObject = {
    "@type": "Thing",
    name: item.headline,
    ...(alternate.length ? { alternateName: alternate } : {}),
    ...(item.summary ? { description: item.summary } : {}),
  };
  const place: JsonLdObject | null = item.origin
    ? {
        "@type": "Place",
        name: [item.origin.pref, item.origin.city].filter(Boolean).join(" "),
        address: {
          "@type": "PostalAddress",
          addressCountry: "JP",
          addressRegion: item.origin.pref,
          ...(item.origin.city ? { addressLocality: item.origin.city } : {}),
        },
        ...(item.origin.lat != null && item.origin.lng != null
          ? { geo: { "@type": "GeoCoordinates", latitude: item.origin.lat, longitude: item.origin.lng } }
          : {}),
      }
    : null;

  return {
    "@context": CONTEXT,
    "@type": "Article",
    "@id": item.url,
    mainEntityOfPage: item.url,
    url: item.url,
    headline: item.headline,
    ...(item.summary ? { description: item.summary } : {}),
    inLanguage: item.locale,
    ...(item.sectionNames.length ? { keywords: item.sectionNames.join(", ") } : {}),
    about,
    ...(place ? { contentLocation: place } : {}),
    publisher: { "@id": `${item.site.siteUrl}/#organization` },
  };
}

export type ArticleLd = {
  url: string;
  locale: string;
  headline: string;
  description: string | null;
  /** ガイドの種別やジャンル名など */
  section?: string | null;
  site: Pick<SiteInfo, "siteUrl" | "name">;
};

/** ガイド・チェーンなど、読み物ページの汎用 Article。 */
export function articleJsonLd(a: ArticleLd): JsonLdObject {
  return {
    "@context": CONTEXT,
    "@type": "Article",
    "@id": a.url,
    mainEntityOfPage: a.url,
    url: a.url,
    headline: a.headline,
    ...(a.description ? { description: a.description } : {}),
    inLanguage: a.locale,
    ...(a.section ? { articleSection: a.section } : {}),
    publisher: { "@id": `${a.site.siteUrl}/#organization` },
  };
}

export type ItemListLd = {
  url: string;
  name: string;
  description?: string | null;
  items: { name: string; url: string }[];
  /** 長大な一覧を切る上限（既定 200。sitemap が全件を担うので一覧は代表でよい） */
  limit?: number;
};

/** ジャンル・棚・県・タグの一覧ページ。 */
export function itemListJsonLd(list: ItemListLd): JsonLdObject {
  const limit = list.limit ?? 200;
  return {
    "@context": CONTEXT,
    "@type": "ItemList",
    "@id": `${list.url}#list`,
    url: list.url,
    name: list.name,
    ...(list.description ? { description: list.description } : {}),
    numberOfItems: list.items.length,
    itemListElement: list.items.slice(0, limit).map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: it.url,
    })),
  };
}

/**
 * `<script type="application/ld+json">` に埋める文字列。`</script>` 挿入を防ぐため `<` を
 * エスケープする（JSON としては等価）。
 */
export function serializeJsonLd(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
