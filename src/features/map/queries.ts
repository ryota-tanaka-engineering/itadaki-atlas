import { createClient } from "@/lib/supabase/server";

import type { PrimaryStyle } from "./styles";

/**
 * 地図・索引が読むアイテム一覧。
 *
 * 取得はサーバー側で行う（ia-nextjs-standards / Platform 01_architecture.md §3）。
 * RLS により published のみが返る（.doc/10_system/06_security.md §2）。
 */
export type MapItem = {
  slug: string;
  nameJa: string;
  nameEn: string | null;
  nameRomaji: string;
  summary: string | null;
  originPref: string | null;
  originCity: string | null;
  lat: number;
  lng: number;
  primaryStyle: PrimaryStyle | null;
  /** 記号（CLAUDE.md「記号」節）: dish=●料理 / ingredient=■食材。地図ピンの形に使う。 */
  itemType: "dish" | "ingredient";
  /** 詳細ページへのリンク組み立て用（棚内「その他」= genre_id null のアイテムは null） */
  genreSlug: string | null;
};

export type Locale = "ja" | "en";

/** PostgREST の埋め込みリレーションは配列/単体の両方があり得るので揃える。 */
function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/**
 * 指定ロケールの表示名を返す。未翻訳は en → ja でフォールバックする
 * （Platform 10_growth_infra.md §3.3。DBに重複行を作らずアプリ層で処理する）。
 */
function pickTranslation<T extends { locale: string }>(translations: T[], locale: Locale): T | null {
  return (
    translations.find((t) => t.locale === locale) ??
    translations.find((t) => t.locale === "ja") ??
    null
  );
}

export async function fetchMapItems(locale: Locale = "ja"): Promise<MapItem[]> {
  const db = await createClient();

  const { data, error } = await db
    .from("food_items")
    .select(
      `slug, name_romaji, origin_pref, origin_city, lat, lng, type,
       genres ( slug ),
       food_item_translations ( locale, name, summary ),
       dish_details ( primary_style )`,
    )
    .not("lat", "is", null)
    .order("slug");

  if (error) {
    // 空配列で握りつぶさない。地図が空になった原因を追えなくなるため
    // （ia-nextjs-standards のエラー可視化ルール）。
    throw new Error(`fetchMapItems failed: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const translations = row.food_item_translations ?? [];
    const t = pickTranslation(translations, locale);
    const ja = translations.find((x) => x.locale === "ja");
    const en = translations.find((x) => x.locale === "en");

    return {
      slug: row.slug,
      nameJa: ja?.name ?? row.name_romaji,
      nameEn: en?.name ?? null,
      nameRomaji: row.name_romaji,
      summary: t?.summary ?? null,
      originPref: row.origin_pref,
      originCity: row.origin_city,
      lat: row.lat as number,
      lng: row.lng as number,
      // PostgREST は 1:1 でも配列で返すため先頭を取る
      primaryStyle: (toOne(row.dish_details)?.primary_style ?? null) as PrimaryStyle | null,
      itemType: row.type as "dish" | "ingredient",
      genreSlug: toOne(row.genres)?.slug ?? null,
    };
  });
}

/** 詳細ページが読む1件分。出典を含む。 */
export type ItemRegion = {
  pref: string;
  city: string | null;
  relationType: string;
};

export type ItemDetail = MapItem & {
  genreSlug: string;
  /** カバーのパンくず的表記（棚名 ── ジャンル名）用。ジャンルは常にある
   * （このページのルートが genres!inner を要求するため）が、将来 棚のみ
   * ルーティングが増えた場合に備え null も許容する。 */
  genreNameJa: string | null;
  genreNameEn: string | null;
  shelfSlug: string;
  shelfNameJa: string;
  shelfNameEn: string;
  /** 本文Markdown（Tier2以上のみ。無ければ目次ごと非表示） */
  bodyMd: string | null;
  sources: {
    title: string;
    url: string | null;
    publisher: string | null;
    accessedAt: string | null;
  }[];
  /** 名産地・主要提供圏など。発祥を1つに決められないアイテムが複数の土地と結びつく */
  regions: ItemRegion[];
};

export async function fetchItemBySlug(
  genreSlug: string,
  slug: string,
  locale: Locale,
): Promise<ItemDetail | null> {
  const db = await createClient();

  const { data, error } = await db
    .from("food_items")
    .select(
      `slug, name_romaji, origin_pref, origin_city, lat, lng, type, shelf_slug,
       genres!inner ( slug, name_ja, name_en ),
       shelves ( slug, name_ja, name_en ),
       food_item_translations ( locale, name, summary, body_md ),
       food_item_sources ( title, url, publisher, accessed_at ),
       food_item_regions ( pref, city, relation_type ),
       dish_details ( primary_style )`,
    )
    .eq("slug", slug)
    .eq("genres.slug", genreSlug)
    .maybeSingle();

  if (error) throw new Error(`fetchItemBySlug failed: ${error.message}`);
  if (!data) return null;

  const translations = data.food_item_translations ?? [];
  const t = pickTranslation(translations, locale);
  const ja = translations.find((x) => x.locale === "ja");
  const en = translations.find((x) => x.locale === "en");
  const genre = toOne(data.genres);
  const shelf = toOne(data.shelves);

  return {
    slug: data.slug,
    nameJa: ja?.name ?? data.name_romaji,
    nameEn: en?.name ?? null,
    nameRomaji: data.name_romaji,
    summary: t?.summary ?? null,
    originPref: data.origin_pref,
    originCity: data.origin_city,
    lat: data.lat as number,
    lng: data.lng as number,
    primaryStyle: (toOne(data.dish_details)?.primary_style ?? null) as PrimaryStyle | null,
    itemType: data.type as "dish" | "ingredient",
    genreSlug: genre?.slug ?? genreSlug,
    genreNameJa: genre?.name_ja ?? null,
    genreNameEn: genre?.name_en ?? null,
    shelfSlug: shelf?.slug ?? data.shelf_slug,
    shelfNameJa: shelf?.name_ja ?? data.shelf_slug,
    shelfNameEn: shelf?.name_en ?? data.shelf_slug,
    bodyMd: (t?.body_md ?? null) as string | null,
    sources: (data.food_item_sources ?? []).map((s) => ({
      title: s.title,
      url: s.url,
      publisher: s.publisher,
      accessedAt: s.accessed_at,
    })),
    regions: (data.food_item_regions ?? []).map((r) => ({
      pref: r.pref,
      city: r.city,
      relationType: r.relation_type,
    })),
  };
}

/** sitemap と静的生成が使う、公開済みアイテムのパス一覧。 */
export async function fetchPublishedPaths(): Promise<
  { genreSlug: string; slug: string }[]
> {
  const db = await createClient();
  const { data, error } = await db
    .from("food_items")
    .select("slug, genres!inner ( slug )")
    .order("slug");

  if (error) throw new Error(`fetchPublishedPaths failed: ${error.message}`);

  return (data ?? []).map((row) => ({
    slug: row.slug,
    genreSlug: toOne(row.genres)?.slug ?? "",
  }));
}

// -----------------------------------------------------------------------------
// データ駆動ページ用のクエリ群。
// 行を足すだけでページ・リンクが増える機械（.doc/30_features/01_requirements.md）の
// 読み取り側。書き込みは scripts/ のインポートのみ。
// -----------------------------------------------------------------------------

type ItemRow = {
  slug: string;
  name_romaji: string;
  type: string;
  genres?: { slug: string }[] | { slug: string } | null;
  origin_pref: string | null;
  origin_city: string | null;
  lat: number | null;
  lng: number | null;
  food_item_translations: { locale: string; name: string; summary: string | null }[] | null;
  dish_details: { primary_style: string | null }[] | { primary_style: string | null } | null;
};

function rowToItem(
  row: ItemRow,
  locale: Locale,
): MapItem & { lat: number | null; lng: number | null; genreSlug: string | null } {
  const translations = row.food_item_translations ?? [];
  const t = pickTranslation(translations, locale);
  const ja = translations.find((x) => x.locale === "ja");
  const en = translations.find((x) => x.locale === "en");
  return {
    slug: row.slug,
    nameJa: ja?.name ?? row.name_romaji,
    nameEn: en?.name ?? null,
    nameRomaji: row.name_romaji,
    summary: t?.summary ?? null,
    originPref: row.origin_pref,
    originCity: row.origin_city,
    lat: row.lat as number,
    lng: row.lng as number,
    primaryStyle: (toOne(row.dish_details)?.primary_style ?? null) as PrimaryStyle | null,
    itemType: row.type as "dish" | "ingredient",
    genreSlug: toOne(row.genres ?? null)?.slug ?? null,
  };
}

const ITEM_SELECT = `slug, name_romaji, origin_pref, origin_city, lat, lng, type,
  genres ( slug ),
  food_item_translations ( locale, name, summary ),
  dish_details ( primary_style )`;

// ジャンル絞り込み用。ITEM_SELECT と同一だが genres を inner join にする
// （実行時の文字列置換だと Supabase の型推論が壊れるため、別定数で持つ）
const ITEM_SELECT_GENRE_INNER = `slug, name_romaji, origin_pref, origin_city, lat, lng, type,
  genres!inner ( slug ),
  food_item_translations ( locale, name, summary ),
  dish_details ( primary_style )`;

export type Genre = { slug: string; nameJa: string; nameEn: string; type: "dish" | "ingredient" };

/** トップのチップとジャンルページが読む。genres に行を足すだけで増える。 */
export async function fetchGenres(): Promise<Genre[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("genres")
    .select("slug, name_ja, name_en, type")
    .order("sort_order");
  if (error) throw new Error(`fetchGenres failed: ${error.message}`);
  return (data ?? []).map((g) => ({
    slug: g.slug,
    nameJa: g.name_ja,
    nameEn: g.name_en,
    type: g.type as "dish" | "ingredient",
  }));
}

export async function fetchGenre(genreSlug: string): Promise<Genre | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("genres")
    .select("slug, name_ja, name_en, type")
    .eq("slug", genreSlug)
    .maybeSingle();
  if (error) throw new Error(`fetchGenre failed: ${error.message}`);
  return data
    ? {
        slug: data.slug,
        nameJa: data.name_ja,
        nameEn: data.name_en,
        type: data.type as "dish" | "ingredient",
      }
    : null;
}

/**
 * ジャンルの全アイテム。**座標なし（部位等の地域性なしアイテム）も含む**。
 * 地図には lat 有りだけが乗り、無いものはジャンルページの図鑑セクションに出る。
 */
export async function fetchGenreItems(genreSlug: string, locale: Locale) {
  const db = await createClient();
  const { data, error } = await db
    .from("food_items")
    .select(ITEM_SELECT_GENRE_INNER)
    .eq("genres.slug", genreSlug)
    .order("slug");
  if (error) throw new Error(`fetchGenreItems failed: ${error.message}`);
  return (data ?? []).map((r) => rowToItem(r, locale));
}

/**
 * 地域ページ。origin_pref（発祥）のアイテムに加え、
 * food_item_regions（名産地等）で紐づくアイテムも**合流**する。
 * ネタ・食材が「その土地のページ」に現れるのはこの経路。
 */
export async function fetchItemsByPref(pref: string, locale: Locale) {
  const db = await createClient();
  const [own, via] = await Promise.all([
    db.from("food_items").select(ITEM_SELECT).eq("origin_pref", pref).order("slug"),
    db
      .from("food_item_regions")
      .select(`relation_type, food_items!inner ( ${ITEM_SELECT} )`)
      .eq("pref", pref),
  ]);
  if (own.error) throw new Error(`fetchItemsByPref failed: ${own.error.message}`);
  if (via.error) throw new Error(`fetchItemsByPref failed: ${via.error.message}`);

  const items = (own.data ?? []).map((r) => ({
    ...rowToItem(r, locale),
    regionRelation: null as string | null,
  }));
  const seen = new Set(items.map((i) => i.slug));
  for (const row of via.data ?? []) {
    const item = toOne(row.food_items as unknown as ItemRow | ItemRow[] | null);
    if (!item) continue;
    const mapped = rowToItem(item, locale);
    if (seen.has(mapped.slug)) continue; // 発祥として既に載っている場合はそちらを優先
    seen.add(mapped.slug);
    items.push({ ...mapped, regionRelation: row.relation_type });
  }
  return items;
}

/** データが存在する県の一覧（sitemap と「地域から探す」が読む）。regions 経由も含む。 */
export async function fetchPrefsWithItems(): Promise<string[]> {
  const db = await createClient();
  const [own, via] = await Promise.all([
    db.from("food_items").select("origin_pref").not("origin_pref", "is", null),
    db.from("food_item_regions").select("pref"),
  ]);
  if (own.error) throw new Error(`fetchPrefsWithItems failed: ${own.error.message}`);
  if (via.error) throw new Error(`fetchPrefsWithItems failed: ${via.error.message}`);
  return [
    ...new Set([
      ...(own.data ?? []).map((r) => r.origin_pref as string),
      ...(via.data ?? []).map((r) => r.pref as string),
    ]),
  ];
}

export type RelatedItem = {
  slug: string;
  nameJa: string;
  nameRomaji: string;
  summary: string | null;
  relationType: string;
  /** 相手が from 側（=相手が源流側）なら true。ラベルの向きに使う */
  otherIsFrom: boolean;
};

/**
 * 名前つきのつながり。food_item_relations に1行足すと
 * **両端の詳細ページに双方向で**このリンクが生える。
 */
export async function fetchRelated(slug: string, locale: Locale): Promise<RelatedItem[]> {
  const db = await createClient();
  const { data: me, error: meErr } = await db
    .from("food_items")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (meErr) throw new Error(`fetchRelated failed: ${meErr.message}`);
  if (!me) return [];

  const [asFrom, asTo] = await Promise.all([
    db
      .from("food_item_relations")
      .select(
        `relation_type,
         other:food_items!food_item_relations_to_id_fkey ( slug, name_romaji, food_item_translations ( locale, name, summary ) )`,
      )
      .eq("from_id", me.id),
    db
      .from("food_item_relations")
      .select(
        `relation_type,
         other:food_items!food_item_relations_from_id_fkey ( slug, name_romaji, food_item_translations ( locale, name, summary ) )`,
      )
      .eq("to_id", me.id),
  ]);
  if (asFrom.error) throw new Error(`fetchRelated failed: ${asFrom.error.message}`);
  if (asTo.error) throw new Error(`fetchRelated failed: ${asTo.error.message}`);

  const mapRow = (row: { relation_type: string; other: unknown }, otherIsFrom: boolean) => {
    const other = toOne(
      row.other as
        | { slug: string; name_romaji: string; food_item_translations: { locale: string; name: string; summary: string | null }[] | null }
        | null,
    );
    if (!other) return null;
    const translations = other.food_item_translations ?? [];
    const t = pickTranslation(translations, locale);
    const ja = translations.find((x) => x.locale === "ja");
    return {
      slug: other.slug,
      nameJa: ja?.name ?? other.name_romaji,
      nameRomaji: other.name_romaji,
      summary: t?.summary ?? null,
      relationType: row.relation_type,
      otherIsFrom,
    };
  };

  return [
    ...(asFrom.data ?? []).map((r) => mapRow(r, false)),
    ...(asTo.data ?? []).map((r) => mapRow(r, true)),
  ].filter((x): x is RelatedItem => x !== null);
}

/** 同じ県の他アイテム。データを足すだけで双方向に増える、コストゼロの回遊。 */
export async function fetchSamePref(slug: string, pref: string, locale: Locale, limit = 6) {
  const db = await createClient();
  const { data, error } = await db
    .from("food_items")
    .select(ITEM_SELECT)
    .eq("origin_pref", pref)
    .neq("slug", slug)
    .order("slug")
    .limit(limit);
  if (error) throw new Error(`fetchSamePref failed: ${error.message}`);
  return (data ?? []).map((r) => rowToItem(r, locale));
}

/**
 * 詳細ページ「●同じ系統を、もっと」用（CLAUDE.md「詳細ページの確定構造」4節）。
 * 同ジャンル内で、系統（primaryStyle）が一致するものを優先して並べる
 * （系統を持たないジャンルでは単純に同ジャンルの他アイテムになる）。
 */
export async function fetchStyleSiblings(
  genreSlug: string,
  slug: string,
  primaryStyle: PrimaryStyle | null,
  locale: Locale,
  limit = 2,
) {
  const items = await fetchGenreItems(genreSlug, locale);
  const others = items.filter((i) => i.slug !== slug);
  const sameStyle = primaryStyle ? others.filter((i) => i.primaryStyle === primaryStyle) : [];
  const sameStyleSlugs = new Set(sameStyle.map((i) => i.slug));
  const rest = others.filter((i) => !sameStyleSlugs.has(i.slug));
  return [...sameStyle, ...rest].slice(0, limit);
}

/**
 * 詳細ページ「●同じ系統を、もっと」用（ジャンルなしアイテムの分岐）。
 * 棚内「その他」（genre_id null）に属するアイテムは同じ棚の他アイテムを見せる。
 * 現行ルーティングでは genre_id null のアイテムに到達する経路が無いため
 * （棚一覧ページは次部隊）、今は将来のための防御的な実装に留まる。
 */
export async function fetchShelfSiblings(shelfSlug: string, slug: string, locale: Locale, limit = 2) {
  const db = await createClient();
  const { data, error } = await db
    .from("food_items")
    .select(ITEM_SELECT)
    .eq("shelf_slug", shelfSlug)
    .neq("slug", slug)
    .order("slug")
    .limit(limit);
  if (error) throw new Error(`fetchShelfSiblings failed: ${error.message}`);
  return (data ?? []).map((r) => rowToItem(r, locale));
}
