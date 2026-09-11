import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAll";

import { excerptChapterSentence, excerptFirstSentence } from "./markdown";
import type { PlaceNameMap } from "./placeNames";

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
  /** 座標なし（部位・ネタ等、発祥地の物語を持たないアイテム）は null（実装部隊の報告
   * 「トップで牛肉の部位等を選ぶと0件」対応）。地図ピン・県クラスタ・距離計算など
   * 座標が要る箇所は利用側で `lat != null` に絞る（MapPin 参照）。 */
  lat: number | null;
  lng: number | null;
  primaryStyle: string | null;
  /** 記号（CLAUDE.md「記号」節）: dish=●料理 / ingredient=■食材。地図ピンの形に使う。 */
  itemType: "dish" | "ingredient";
  /** 詳細ページへのリンク組み立て用（棚内「その他」= genre_id null のアイテムは null） */
  genreSlug: string | null;
  /** 棚slug。genreSlug が null のアイテムへのリンク組み立てに使う（/[shelfSlug]/[slug]）。 */
  shelfSlug: string;
};

/**
 * 地図ピン用データ（2026-09 本場ピン対応）。MapItem に kind を足しただけの型で、
 * 発祥ピン（kind='origin'。MapItem を素通しできる形）と本場ピン
 * （kind='honba'。food_item_regions の1行=1ピンで、同じアイテムが複数都市に
 * ピンを持ちうる）を同じ配列に合流させて MapView に渡す。
 *
 * originPref/originCity/lat/lng は honba ピンでは「アイテムの発祥地」ではなく
 * 「そのピンの所在地（本場の都市）」を表す（MapView が既存の
 * originPref ベースの集計・寄せロジックをそのまま使い回せるようにするため）。
 */
export type MapPin = MapItem & { kind: "origin" | "honba"; lat: number; lng: number };

/**
 * トップの地図・索引・絞り込みが読む最小項目（実装部隊の報告「トップのHTMLが約1MB」
 * 対応。2026-09 収録1,867件到達で顕在化）。
 *
 * MapItem を継承しない独自の薄い型にしている（summary を含まない）。旧 BrowseItem は
 * summary / bodyExcerpt（1章冒頭1文） / bodyExcerptCh3（3章冒頭1文）を全件分持たせて
 * おり、これが RSC ペイロードとして HTML に直接埋め込まれていた（1,000件で720KB、
 * 全件なら1.5MB超）。この3つの本文由来の長い文字列は落とし、代わりに `hasBody`
 * （「今日の一皿」「土地の物語から」の母集団判定に使う。dailyPicks.ts 参照）だけを持つ。
 *
 * 実際の抜粋・summary が要る箇所（ピン選択カード・「今日の一皿」・「土地の物語から」）は
 * 選ばれた数件だけを `fetchItemExcerpts` で別途取る。タグの表示名（nameJa/nameEn）も
 * 同じ理由で持たせず、`tagSlugs` から呼び出し側が `allTags`（/tags と同じ全件取得。
 * 1回分で全アイテム共有できる）経由で引く（server-dedup-props: 同じ文字列をアイテム数
 * 分重複させない）。
 */
export type BrowseItem = {
  slug: string;
  nameJa: string;
  nameEn: string | null;
  nameRomaji: string;
  originPref: string | null;
  originCity: string | null;
  lat: number | null;
  lng: number | null;
  primaryStyle: string | null;
  itemType: "dish" | "ingredient";
  genreSlug: string | null;
  shelfSlug: string;
  /** タグ絞り込み用の全タグslug（絞り込み判定は全件で行う。作業パッケージ「トップ導線修正」A節）。
   * 表示名が要る箇所は allTags（TagWithCount）から引く。 */
  tagSlugs: string[];
  /** 本文（body_md）を持つか。summary/bodyExcerpt 等の文字列本体は持たない
   * （fetchItemExcerpts 参照）。 */
  hasBody: boolean;
};

// ピン選択の一意キー（mapPinKey）は ./pinKey.ts に置く。
// ここ（queries.ts）は @/lib/supabase/server（next/headers 依存）を import しているため、
// クライアントコンポーネント（MapView / BrowseShell）が値としてここから何かを import すると
// サーバー専用コードがクライアントバンドルに巻き込まれてビルドが壊れる
// （型のみの import は erasure されるため問題ない。関数だけ分離する）。

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

/**
 * トップの地図・索引・絞り込みが読む。summary/本文は持たない（BrowseItem のdocコメント
 * 参照）。dish_details.primary_style で系統凡例、food_item_tags.tag_slug でタグ絞り込みを
 * まかなう（tags(slug,name_ja,name_en) への埋め込みJOINはもう不要）。
 */
export async function fetchMapItems(locale: Locale = "ja"): Promise<BrowseItem[]> {
  const db = await createClient();

  // PostgREST の既定上限（1,000行）を越えて全件を取る（実装部隊の報告
  // 「トップで牛肉の部位を選ぶと30件のはずが19件」対応。fetchAllRows 参照）。
  const data = await fetchAllRows(
    (from, to) =>
      db
        .from("food_items")
        .select(
          `slug, name_romaji, origin_pref, origin_city, lat, lng, type, shelf_slug,
           genres ( slug ),
           food_item_translations ( locale, name, body_md ),
           dish_details ( primary_style ),
           food_item_tags ( tag_slug )`,
        )
        // 座標なし（部位・ネタ等）も含める（実装部隊の報告「トップで牛肉の部位等を選ぶと
        // 0件」対応）。地図ピンにするかどうかは呼び出し側（BrowseShell）が lat != null で絞る。
        .order("slug")
        .range(from, to),
    "fetchMapItems",
  );

  return data.map((row) => {
    const translations = row.food_item_translations ?? [];
    const t = pickTranslation(translations, locale);
    const ja = translations.find((x) => x.locale === "ja");
    const en = translations.find((x) => x.locale === "en");

    return {
      slug: row.slug,
      nameJa: ja?.name ?? row.name_romaji,
      nameEn: en?.name ?? null,
      nameRomaji: row.name_romaji,
      originPref: row.origin_pref,
      originCity: row.origin_city,
      lat: row.lat,
      lng: row.lng,
      // PostgREST は 1:1 でも配列で返すため先頭を取る
      primaryStyle: (toOne(row.dish_details)?.primary_style ?? null) as string | null,
      itemType: row.type as "dish" | "ingredient",
      genreSlug: toOne(row.genres)?.slug ?? null,
      shelfSlug: row.shelf_slug,
      tagSlugs: (row.food_item_tags ?? []).map((tr) => tr.tag_slug),
      hasBody: Boolean(t?.body_md),
    };
  });
}

export type ItemExcerpt = {
  slug: string;
  summary: string | null;
  /** 1章目「何でできているか」冒頭の1文。 */
  bodyExcerpt: string | null;
  /** 3章目「なぜこの形になったのか」冒頭の1文（トップ「土地の物語から」用）。 */
  bodyExcerptCh3: string | null;
};

/**
 * ピン選択カード・「今日の一皿」・「土地の物語から」用。BrowseItem から落とした
 * summary/bodyExcerpt/bodyExcerptCh3 を、選ばれた数件（daily picks は最大4件、
 * ピン選択は1件）だけ別クエリで取る（作業指示「トップのHTMLが約1MB」対応）。
 * 呼び出し件数が少数固定のため `.in()` に上限ページングは不要。
 */
export async function fetchItemExcerpts(slugs: string[], locale: Locale): Promise<Map<string, ItemExcerpt>> {
  const map = new Map<string, ItemExcerpt>();
  if (slugs.length === 0) return map;

  const db = await createClient();
  const { data, error } = await db
    .from("food_items")
    .select("slug, food_item_translations ( locale, name, summary, body_md )")
    .in("slug", slugs);
  if (error) throw new Error(`fetchItemExcerpts failed: ${error.message}`);

  for (const row of data ?? []) {
    const translations = row.food_item_translations ?? [];
    const t = pickTranslation(translations, locale);
    map.set(row.slug, {
      slug: row.slug,
      summary: t?.summary ?? null,
      bodyExcerpt: t?.body_md ? excerptFirstSentence(t.body_md) : null,
      bodyExcerptCh3: t?.body_md ? excerptChapterSentence(t.body_md, 2) : null,
    });
  }
  return map;
}

/** 詳細ページが読む1件分。出典を含む。 */
export type ItemRegion = {
  pref: string;
  city: string | null;
  relationType: string;
  /** 本場（relationType='本場'）の「構造的理由の一文」。名産地でも使ってよい。 */
  noteJa: string | null;
  noteEn: string | null;
};

export type ItemDetail = MapItem & {
  /** カバーのパンくず的表記（棚名 ── ジャンル名）用。棚slug+アイテムで解決した
   * その他アイテム（genre_id null）は genreSlug が null になり、カバーは棚名のみになる。 */
  genreNameJa: string | null;
  genreNameEn: string | null;
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
  /** タグ一元語彙からの付与（.doc/20_data/01_models.md §3）。カバー内チップ表示用。 */
  tags: ItemTag[];
};

export type ItemTag = {
  slug: string;
  nameJa: string;
  nameEn: string;
};

/** PostgREST の埋め込み結果 `food_item_tags ( tags ( ... ) )` からタグ配列を組み立てる。 */
function toItemTags(
  rows:
    | { tags: { slug: string; name_ja: string; name_en: string } | { slug: string; name_ja: string; name_en: string }[] | null }[]
    | null
    | undefined,
): ItemTag[] {
  return (rows ?? [])
    .map((row) => toOne(row.tags))
    .filter((t): t is { slug: string; name_ja: string; name_en: string } => t !== null)
    .map((t) => ({ slug: t.slug, nameJa: t.name_ja, nameEn: t.name_en }));
}

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
       food_item_regions ( pref, city, relation_type, note_ja, note_en ),
       food_item_tags ( tags ( slug, name_ja, name_en ) ),
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
    lat: data.lat,
    lng: data.lng,
    primaryStyle: (toOne(data.dish_details)?.primary_style ?? null) as string | null,
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
      noteJa: r.note_ja,
      noteEn: r.note_en,
    })),
    tags: toItemTags(data.food_item_tags),
  };
}

/**
 * 詳細ページ「棚slug+アイテム」経路（CLAUDE.md 参照。棚内「その他」= genre_id null の
 * アイテム専用）。genre_id が付いているアイテムは常に genres 経由の正規URLを持つため、
 * ここは genre_id is null に限定して二重の正規URLを作らない。
 */
export async function fetchItemByShelfSlug(
  shelfSlug: string,
  slug: string,
  locale: Locale,
): Promise<ItemDetail | null> {
  const db = await createClient();

  const { data, error } = await db
    .from("food_items")
    .select(
      `slug, name_romaji, origin_pref, origin_city, lat, lng, type, shelf_slug,
       genres ( slug, name_ja, name_en ),
       shelves!inner ( slug, name_ja, name_en ),
       food_item_translations ( locale, name, summary, body_md ),
       food_item_sources ( title, url, publisher, accessed_at ),
       food_item_regions ( pref, city, relation_type, note_ja, note_en ),
       food_item_tags ( tags ( slug, name_ja, name_en ) ),
       dish_details ( primary_style )`,
    )
    .eq("slug", slug)
    .eq("shelves.slug", shelfSlug)
    .is("genre_id", null)
    .maybeSingle();

  if (error) throw new Error(`fetchItemByShelfSlug failed: ${error.message}`);
  if (!data) return null;

  const translations = data.food_item_translations ?? [];
  const t = pickTranslation(translations, locale);
  const ja = translations.find((x) => x.locale === "ja");
  const en = translations.find((x) => x.locale === "en");
  const shelf = toOne(data.shelves);

  return {
    slug: data.slug,
    nameJa: ja?.name ?? data.name_romaji,
    nameEn: en?.name ?? null,
    nameRomaji: data.name_romaji,
    summary: t?.summary ?? null,
    originPref: data.origin_pref,
    originCity: data.origin_city,
    lat: data.lat,
    lng: data.lng,
    primaryStyle: (toOne(data.dish_details)?.primary_style ?? null) as string | null,
    itemType: data.type as "dish" | "ingredient",
    genreSlug: null,
    genreNameJa: null,
    genreNameEn: null,
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
      noteJa: r.note_ja,
      noteEn: r.note_en,
    })),
    tags: toItemTags(data.food_item_tags),
  };
}

/** sitemap と静的生成が使う、公開済みアイテムのパス一覧。
 * genre_id があるアイテムはジャンルURL、無いアイテム（棚内「その他」）は
 * 棚URLがそれぞれの唯一の正規パスになる（二重URLを作らない）。 */
export async function fetchPublishedPaths(): Promise<
  { genreSlug: string; slug: string }[]
> {
  const db = await createClient();
  const data = await fetchAllRows(
    (from, to) =>
      db
        .from("food_items")
        .select("slug, shelf_slug, genres ( slug )")
        .order("slug")
        .range(from, to),
    "fetchPublishedPaths",
  );

  return data.map((row) => ({
    slug: row.slug,
    genreSlug: toOne(row.genres)?.slug ?? row.shelf_slug,
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
  shelf_slug: string;
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
    lat: row.lat,
    lng: row.lng,
    primaryStyle: (toOne(row.dish_details)?.primary_style ?? null) as string | null,
    itemType: row.type as "dish" | "ingredient",
    genreSlug: toOne(row.genres ?? null)?.slug ?? null,
    shelfSlug: row.shelf_slug,
  };
}

const ITEM_SELECT = `slug, name_romaji, origin_pref, origin_city, lat, lng, type, shelf_slug,
  genres ( slug ),
  food_item_translations ( locale, name, summary ),
  dish_details ( primary_style )`;

// ジャンル絞り込み用。ITEM_SELECT と同一だが genres を inner join にする
// （実行時の文字列置換だと Supabase の型推論が壊れるため、別定数で持つ）
const ITEM_SELECT_GENRE_INNER = `slug, name_romaji, origin_pref, origin_city, lat, lng, type, shelf_slug,
  genres!inner ( slug ),
  food_item_translations ( locale, name, summary ),
  dish_details ( primary_style )`;

export type Genre = {
  slug: string;
  nameJa: string;
  nameEn: string;
  type: "dish" | "ingredient" | "cut";
  /** 所属する棚のslug（ジャンルページ末尾「この棚の仲間」チップ用）。 */
  shelfSlug: string;
  /** 国民食型ジャンルの総論（未投入なら null。ヒーロー直下に段落として出す）。 */
  introJa: string | null;
  introEn: string | null;
};

/** トップのチップとジャンルページが読む。genres に行を足すだけで増える。 */
export async function fetchGenres(): Promise<Genre[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("genres")
    .select("slug, name_ja, name_en, type, shelf_slug, intro_ja, intro_en")
    .order("sort_order");
  if (error) throw new Error(`fetchGenres failed: ${error.message}`);
  return (data ?? []).map((g) => ({
    slug: g.slug,
    nameJa: g.name_ja,
    nameEn: g.name_en,
    type: g.type as "dish" | "ingredient" | "cut",
    shelfSlug: g.shelf_slug,
    introJa: g.intro_ja,
    introEn: g.intro_en,
  }));
}

export async function fetchGenre(genreSlug: string): Promise<Genre | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("genres")
    .select("slug, name_ja, name_en, type, shelf_slug, intro_ja, intro_en")
    .eq("slug", genreSlug)
    .maybeSingle();
  if (error) throw new Error(`fetchGenre failed: ${error.message}`);
  return data
    ? {
        slug: data.slug,
        nameJa: data.name_ja,
        nameEn: data.name_en,
        type: data.type as "dish" | "ingredient" | "cut",
        shelfSlug: data.shelf_slug,
        introJa: data.intro_ja,
        introEn: data.intro_en,
      }
    : null;
}

/**
 * ジャンルの全アイテム。**座標なし（部位等の地域性なしアイテム）も含む**。
 * 地図には lat 有りだけが乗り、無いものはジャンルページの図鑑セクションに出る。
 */
export async function fetchGenreItems(genreSlug: string, locale: Locale) {
  const db = await createClient();
  // 現状は1ジャンル最大110件だが、収録が進めば1,000件を超えうるため
  // 迷わずページングする（作業指示「トップで牛肉の部位が19件」対応と同じ方針）。
  const data = await fetchAllRows(
    (from, to) =>
      db
        .from("food_items")
        .select(ITEM_SELECT_GENRE_INNER)
        .eq("genres.slug", genreSlug)
        .order("slug")
        .range(from, to),
    "fetchGenreItems",
  );
  return data.map((r) => rowToItem(r, locale));
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
      .select(`relation_type, note_ja, note_en, food_items!inner ( ${ITEM_SELECT} )`)
      .eq("pref", pref),
  ]);
  if (own.error) throw new Error(`fetchItemsByPref failed: ${own.error.message}`);
  if (via.error) throw new Error(`fetchItemsByPref failed: ${via.error.message}`);

  const items = (own.data ?? []).map((r) => ({
    ...rowToItem(r, locale),
    regionRelation: null as string | null,
    // 本場（relation_type='本場'）の理由の一文。発祥（own側）には付かない
    regionNoteJa: null as string | null,
    regionNoteEn: null as string | null,
  }));
  const bySlug = new Map(items.map((i) => [i.slug, i]));
  for (const row of via.data ?? []) {
    const item = toOne(row.food_items as unknown as ItemRow | ItemRow[] | null);
    if (!item) continue;
    const mapped = rowToItem(item, locale);
    const existing = bySlug.get(mapped.slug);
    if (existing) {
      // 発祥として既に載っている場合はそちらを優先。
      // 同一県・同一種別で複数都市（例: 北海道の本場=釧路・小樽・函館）の場合は
      // 理由の一文を1エントリにまとめる（行ごとに同じアイテムを並べない）
      if (existing.regionRelation === row.relation_type) {
        existing.regionNoteJa =
          [existing.regionNoteJa, row.note_ja].filter(Boolean).join("\n") || null;
        existing.regionNoteEn =
          [existing.regionNoteEn, row.note_en].filter(Boolean).join("\n") || null;
      }
      continue;
    }
    const entry = {
      ...mapped,
      regionRelation: row.relation_type,
      regionNoteJa: row.note_ja,
      regionNoteEn: row.note_en,
    };
    bySlug.set(mapped.slug, entry);
    items.push(entry);
  }
  return items;
}

/**
 * 本場（food_item_regions.relation_type='本場'）の座標付き行を地図ピンに変換する
 * （2026-09 本場ピン対応。CLAUDE.md「デザイン」節・作業パッケージ「本場ピン」）。
 *
 * 名産地・主要提供圏はスコープ外（今回は地図に出さない）。
 * 1行=1ピン。同じアイテムが複数都市の本場を持つ場合はその数だけピンが増える
 * （例: 海鮮丼＝釧路・小樽・函館・金沢の4ピン）。
 */
export async function fetchHonbaPins(locale: Locale = "ja"): Promise<MapPin[]> {
  const db = await createClient();
  const data = await fetchAllRows(
    (from, to) =>
      db
        .from("food_item_regions")
        .select(`pref, city, lat, lng, food_items!inner ( ${ITEM_SELECT} )`)
        .eq("relation_type", "本場")
        .not("lat", "is", null)
        .order("pref")
        .range(from, to),
    "fetchHonbaPins",
  );

  return data
    .map((row): MapPin | null => {
      const item = toOne(row.food_items as unknown as ItemRow | ItemRow[] | null);
      if (!item || row.lat == null || row.lng == null) return null;
      return {
        ...rowToItem(item, locale),
        // 本場ピンはアイテム自身の発祥ではなく、その本場の所在地を使う
        // （MapPin の doc コメント参照）。
        originPref: row.pref,
        originCity: row.city,
        lat: row.lat,
        lng: row.lng,
        kind: "honba",
      };
    })
    .filter((p): p is MapPin => p !== null);
}

export type HonbaCity = { pref: string; city: string | null };

/**
 * トップ「本場をたどる」用データ（2026-09 トップページ情報モジュール §2）。
 * fetchHonbaPins が1行=1ピン（地図用）であるのに対し、こちらは1アイテム=1グループに
 * 集約して返す（アイテムごとに複数都市のチップを並べるため）。
 * 地図に乗せないため座標フィルタは掛けない（座標が無い本場行があっても拾う）。
 */
export type HonbaGroup = {
  slug: string;
  nameJa: string;
  nameEn: string | null;
  nameRomaji: string;
  genreSlug: string | null;
  shelfSlug: string;
  /** 棚種別をまたいだ選定（トップ「本場をたどる」ローテーション）で料理を優先するために使う。
   * 作業パッケージ「トップ導線修正」追加指示2。 */
  itemType: "dish" | "ingredient";
  cities: HonbaCity[];
};

type HonbaFoodItemRow = {
  slug: string;
  name_romaji: string;
  shelf_slug: string;
  type: string;
  genres?: { slug: string }[] | { slug: string } | null;
  food_item_translations: { locale: string; name: string }[] | null;
};

export async function fetchHonbaGroups(): Promise<HonbaGroup[]> {
  const db = await createClient();
  const data = await fetchAllRows(
    (from, to) =>
      db
        .from("food_item_regions")
        .select(
          `pref, city,
           food_items!inner ( slug, name_romaji, shelf_slug, type, genres ( slug ), food_item_translations ( locale, name ) )`,
        )
        .eq("relation_type", "本場")
        .order("pref")
        .range(from, to),
    "fetchHonbaGroups",
  );

  const groups = new Map<string, HonbaGroup>();
  for (const row of data) {
    const item = toOne(row.food_items as unknown as HonbaFoodItemRow | HonbaFoodItemRow[] | null);
    if (!item) continue;

    let group = groups.get(item.slug);
    if (!group) {
      const translations = item.food_item_translations ?? [];
      const ja = translations.find((x) => x.locale === "ja");
      const en = translations.find((x) => x.locale === "en");
      group = {
        slug: item.slug,
        nameJa: ja?.name ?? item.name_romaji,
        nameEn: en?.name ?? null,
        nameRomaji: item.name_romaji,
        genreSlug: toOne(item.genres ?? null)?.slug ?? null,
        shelfSlug: item.shelf_slug,
        itemType: item.type as "dish" | "ingredient",
        cities: [],
      };
      groups.set(item.slug, group);
    }
    group.cities.push({ pref: row.pref, city: row.city });
  }

  return [...groups.values()];
}

/** データが存在する県の一覧（sitemap と「地域から探す」が読む）。regions 経由も含む。 */
export async function fetchPrefsWithItems(): Promise<string[]> {
  const db = await createClient();
  const [own, via] = await Promise.all([
    fetchAllRows(
      (from, to) =>
        db.from("food_items").select("origin_pref").not("origin_pref", "is", null).range(from, to),
      "fetchPrefsWithItems",
    ),
    fetchAllRows((from, to) => db.from("food_item_regions").select("pref").range(from, to), "fetchPrefsWithItems"),
  ]);
  return [...new Set([...own.map((r) => r.origin_pref as string), ...via.map((r) => r.pref as string)])];
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
  primaryStyle: string | null,
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
 * 棚内「その他」（genre_id null）に属するアイテムは同じ棚の他アイテムを見せる
 * （ジャンルを持つ相手は /[genreSlug]/[slug] へ、持たない相手は /[shelfSlug]/[slug] へ。
 * どちらも棚slug+アイテム経路の追加で到達可能になっている）。
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

// -----------------------------------------------------------------------------
// 棚ページ用のクエリ群。
// -----------------------------------------------------------------------------

export type Shelf = {
  slug: string;
  nameJa: string;
  nameEn: string;
  grp: "dish" | "ingredient" | "preparation";
};

export async function fetchShelf(shelfSlug: string): Promise<Shelf | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("shelves")
    .select("slug, name_ja, name_en, grp")
    .eq("slug", shelfSlug)
    .maybeSingle();
  if (error) throw new Error(`fetchShelf failed: ${error.message}`);
  return data
    ? {
        slug: data.slug,
        nameJa: data.name_ja,
        nameEn: data.name_en,
        grp: data.grp as Shelf["grp"],
      }
    : null;
}

/** 棚一覧（sitemap・地域ページの3群判定・棚ページの「関連する他の棚」チップが読む）。 */
export async function fetchShelves(): Promise<Shelf[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("shelves")
    .select("slug, name_ja, name_en, grp")
    .order("sort_order");
  if (error) throw new Error(`fetchShelves failed: ${error.message}`);
  return (data ?? []).map((s) => ({
    slug: s.slug,
    nameJa: s.name_ja,
    nameEn: s.name_en,
    grp: s.grp as Shelf["grp"],
  }));
}

export type ShelfGenre = Genre & { itemCount: number };

/** 棚ページ「主要ジャンルのカード」用。この棚に属する genres と、それぞれの件数。 */
export async function fetchShelfGenres(shelfSlug: string): Promise<ShelfGenre[]> {
  const db = await createClient();
  const [{ data: genres, error: gErr }, items] = await Promise.all([
    db
      .from("genres")
      .select("id, slug, name_ja, name_en, type, intro_ja, intro_en")
      .eq("shelf_slug", shelfSlug)
      .order("sort_order"),
    fetchAllRows(
      (from, to) =>
        db
          .from("food_items")
          .select("genre_id")
          .eq("shelf_slug", shelfSlug)
          .not("genre_id", "is", null)
          .range(from, to),
      "fetchShelfGenres",
    ),
  ]);
  if (gErr) throw new Error(`fetchShelfGenres failed: ${gErr.message}`);

  const counts = new Map<string, number>();
  for (const row of items) {
    if (!row.genre_id) continue;
    counts.set(row.genre_id, (counts.get(row.genre_id) ?? 0) + 1);
  }

  return (genres ?? []).map((g) => ({
    slug: g.slug,
    nameJa: g.name_ja,
    nameEn: g.name_en,
    type: g.type as "dish" | "ingredient" | "cut",
    shelfSlug,
    introJa: g.intro_ja,
    introEn: g.intro_en,
    itemCount: counts.get(g.id) ?? 0,
  }));
}

/**
 * 棚ページ「まだ数の少ない仲間たち」用。genre_id が null（棚内「その他」）のアイテム一覧。
 * ジャンル昇格制（ia-atlas-content Skill §4）で、同型20件以上になれば genres へ移る。
 */
export async function fetchShelfOtherItems(shelfSlug: string, locale: Locale) {
  const db = await createClient();
  // 「その他」は棚単位で数百件規模まで育つ想定（CLAUDE.md「その他1127件」）のため
  // 1,000件超えに備えてページングする。
  const data = await fetchAllRows(
    (from, to) =>
      db
        .from("food_items")
        .select(ITEM_SELECT)
        .eq("shelf_slug", shelfSlug)
        .is("genre_id", null)
        .order("slug")
        .range(from, to),
    "fetchShelfOtherItems",
  );
  return data.map((r) => rowToItem(r, locale));
}

// -----------------------------------------------------------------------------
// タグページ用のクエリ群。
// -----------------------------------------------------------------------------

export type Tag = {
  slug: string;
  kind: string;
  nameJa: string;
  nameEn: string;
  definition: string;
};

export async function fetchTag(tagSlug: string): Promise<Tag | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("tags")
    .select("slug, kind, name_ja, name_en, definition")
    .eq("slug", tagSlug)
    .maybeSingle();
  if (error) throw new Error(`fetchTag failed: ${error.message}`);
  return data
    ? {
        slug: data.slug,
        kind: data.kind,
        nameJa: data.name_ja,
        nameEn: data.name_en,
        definition: data.definition,
      }
    : null;
}

export type TagWithCount = Tag & { itemCount: number };

/** `/tags` 一覧と「近いタグ」チップが読む。件数は published アイテムへの付与数（RLS越し）。 */
export async function fetchTagsWithCounts(): Promise<TagWithCount[]> {
  const db = await createClient();
  // food_item_tags は現状1,700件超（アイテム1,867件×平均複数タグ）で既に
  // 既定上限1,000行を超えている。tags 側も収録増に備えてページングする。
  const [tags, links] = await Promise.all([
    fetchAllRows(
      (from, to) => db.from("tags").select("slug, kind, name_ja, name_en, definition").range(from, to),
      "fetchTagsWithCounts",
    ),
    fetchAllRows((from, to) => db.from("food_item_tags").select("tag_slug").range(from, to), "fetchTagsWithCounts"),
  ]);

  const counts = new Map<string, number>();
  for (const row of links) {
    counts.set(row.tag_slug, (counts.get(row.tag_slug) ?? 0) + 1);
  }

  return tags
    .map((t) => ({
      slug: t.slug,
      kind: t.kind,
      nameJa: t.name_ja,
      nameEn: t.name_en,
      definition: t.definition,
      itemCount: counts.get(t.slug) ?? 0,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export type TagItem = MapItem & { genreNameJa: string | null; genreNameEn: string | null };

/**
 * タグ詳細ページの該当アイテム一覧。タグは棚を跨ぐため、各行に棚/ジャンル表記を
 * 添えられるようジャンル名も一緒に返す。
 */
export async function fetchTagItems(tagSlug: string, locale: Locale): Promise<TagItem[]> {
  const db = await createClient();
  // 現状は最大タグ（儀礼系）でも数百件だが、収録が進めば1,000件を超えうるため
  // fetchGenreItems と同じ方針でページングする。
  const data = await fetchAllRows(
    (from, to) =>
      db
        .from("food_item_tags")
        .select(
          `food_items!inner ( slug, name_romaji, origin_pref, origin_city, lat, lng, type, shelf_slug,
             genres ( slug, name_ja, name_en ),
             food_item_translations ( locale, name, summary ),
             dish_details ( primary_style ) )`,
        )
        .eq("tag_slug", tagSlug)
        .range(from, to),
    "fetchTagItems",
  );

  type Row = ItemRow & { genres?: { slug: string; name_ja: string; name_en: string }[] | { slug: string; name_ja: string; name_en: string } | null };

  return data
    .map((row) => toOne(row.food_items as unknown as Row | Row[] | null))
    .filter((r): r is Row => r !== null)
    .map((r) => {
      const genre = toOne(r.genres ?? null);
      return {
        ...rowToItem(r, locale),
        genreNameJa: genre?.name_ja ?? null,
        genreNameEn: genre?.name_en ?? null,
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/** タグ詳細ページ「近いタグ」用。同じ kind の他タグで、件数>0のものだけ。 */
export async function fetchRelatedTags(tagSlug: string, kind: string): Promise<TagWithCount[]> {
  const all = await fetchTagsWithCounts();
  return all.filter((t) => t.kind === kind && t.slug !== tagSlug && t.itemCount > 0);
}

// -----------------------------------------------------------------------------
// チェーン橋渡し用のクエリ群（「チェーンから、ご当地へ」セクション）。
// 誰もが知るチェーンを入口に、系統・ご当地へ渡す（North Star「広く」軸）。
// -----------------------------------------------------------------------------

export type ChainRecommendation = {
  key: string;
  slug: string;
  /** 詳細ページへのリンク組み立て用。genreSlug が無いアイテムは shelfSlug 経由（既存フォールバックと同じ規約）。 */
  genreSlug: string | null;
  shelfSlug: string;
  nameJa: string;
  nameEn: string | null;
  nameRomaji: string;
};

export type Chain = {
  slug: string;
  nameJa: string;
  nameEn: string;
  bridgeJa: string;
  bridgeEn: string;
  recommendations: ChainRecommendation[];
};

type ChainRecFoodItem = {
  slug: string;
  name_romaji: string;
  shelf_slug: string;
  genres?: { slug: string }[] | { slug: string } | null;
  food_item_translations: { locale: string; name: string }[] | null;
};
type ChainRecRow = { sort_order: number; food_items: ChainRecFoodItem[] | ChainRecFoodItem | null };

const CHAIN_RECOMMENDATION_SELECT = `
  sort_order,
  food_items (
    slug, name_romaji, shelf_slug,
    genres ( slug ),
    food_item_translations ( locale, name )
  )
` as const;

/** chain_recommendations の埋め込み行 → 表示用 ChainRecommendation[]（fetchChainsForGenre / fetchChainBySlug 共通）。 */
function mapChainRecommendations(rows: ChainRecRow[]): ChainRecommendation[] {
  return rows
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((rec): ChainRecommendation | null => {
      const item = toOne(rec.food_items);
      if (!item) return null;
      const translations = item.food_item_translations ?? [];
      const ja = translations.find((x) => x.locale === "ja");
      const en = translations.find((x) => x.locale === "en");
      return {
        key: item.slug,
        slug: item.slug,
        genreSlug: toOne(item.genres ?? null)?.slug ?? null,
        shelfSlug: item.shelf_slug,
        nameJa: ja?.name ?? item.name_romaji,
        nameEn: en?.name ?? null,
        nameRomaji: item.name_romaji,
      };
    })
    .filter((r): r is ChainRecommendation => r !== null);
}

/**
 * ジャンルページ「チェーンから、ご当地へ」用。chains.genre_slug が一致するチェーンが
 * 無ければ空配列を返す（呼び出し側はデータ駆動でセクションごと非表示にする。
 * 特定ジャンルのハードコードはしない）。
 * ja/en両方の表示名を返すため（呼び出し側が locale で出し分ける）、locale 引数は取らない。
 */
export async function fetchChainsForGenre(genreSlug: string): Promise<Chain[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("chains")
    .select(
      `slug, name_ja, name_en, bridge_ja, bridge_en, sort_order,
       chain_recommendations ( ${CHAIN_RECOMMENDATION_SELECT} )`,
    )
    .eq("genre_slug", genreSlug)
    .order("sort_order");
  if (error) throw new Error(`fetchChainsForGenre failed: ${error.message}`);

  return (data ?? []).map((c) => ({
    slug: c.slug,
    nameJa: c.name_ja,
    nameEn: c.name_en,
    bridgeJa: c.bridge_ja,
    bridgeEn: c.bridge_en,
    recommendations: mapChainRecommendations((c.chain_recommendations ?? []) as ChainRecRow[]),
  }));
}

/**
 * トップ「チェーンから、ご当地へ」用（2026-09 トップページ情報モジュール §3）。
 * fetchChainsForGenre と異なりジャンル非依存で**全チェーン**を返す
 * （現状はラーメンのみだが、データ駆動で他ジャンルのチェーンが増えても自動的に乗る）。
 * ジャンルページと同じ ChainBridgeSection にそのまま渡せる形で返す。
 */
export async function fetchAllChains(): Promise<Chain[]> {
  const db = await createClient();
  const data = await fetchAllRows(
    (from, to) =>
      db
        .from("chains")
        .select(
          `slug, name_ja, name_en, bridge_ja, bridge_en, sort_order,
           chain_recommendations ( ${CHAIN_RECOMMENDATION_SELECT} )`,
        )
        .order("sort_order")
        .range(from, to),
    "fetchAllChains",
  );

  return data.map((c) => ({
    slug: c.slug,
    nameJa: c.name_ja,
    nameEn: c.name_en,
    bridgeJa: c.bridge_ja,
    bridgeEn: c.bridge_en,
    recommendations: mapChainRecommendations((c.chain_recommendations ?? []) as ChainRecRow[]),
  }));
}

export type ChainDetail = Chain & {
  styleJa: string | null;
  styleEn: string | null;
  /** 創業の事実（年・場所等）。日本語のみのカラム（英訳列なし）。 */
  foundedNote: string | null;
  genreSlug: string;
};

/**
 * チェーン独立ページ（/chain/[slug]）用。1チェーン=1URLの流入起点（検索ボリュームの
 * 大きいチェーン名を入口にする。North Star「広く」軸）。slug 未一致は null を返し、
 * 呼び出し側で notFound() する（詳細ページの resolveItem と同じ方針）。
 */
export async function fetchChainBySlug(slug: string): Promise<ChainDetail | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("chains")
    .select(
      `slug, name_ja, name_en, style_ja, style_en, founded_note, bridge_ja, bridge_en, genre_slug,
       chain_recommendations ( ${CHAIN_RECOMMENDATION_SELECT} )`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`fetchChainBySlug failed: ${error.message}`);
  if (!data) return null;

  return {
    slug: data.slug,
    nameJa: data.name_ja,
    nameEn: data.name_en,
    styleJa: data.style_ja,
    styleEn: data.style_en,
    foundedNote: data.founded_note,
    bridgeJa: data.bridge_ja,
    bridgeEn: data.bridge_en,
    genreSlug: data.genre_slug,
    recommendations: mapChainRecommendations((data.chain_recommendations ?? []) as ChainRecRow[]),
  };
}

export type ChainSummary = { slug: string; nameJa: string; nameEn: string };

/**
 * チェーン独立ページ「他のチェーンも見る」用。同じ genre_slug の他チェーン
 * （行き止まり禁止。genre_slug 一致だけで並ぶデータ駆動のため特定チェーンのハードコードをしない）。
 */
export async function fetchOtherChainsInGenre(
  genreSlug: string,
  excludeSlug: string,
): Promise<ChainSummary[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("chains")
    .select("slug, name_ja, name_en")
    .eq("genre_slug", genreSlug)
    .neq("slug", excludeSlug)
    .order("sort_order");
  if (error) throw new Error(`fetchOtherChainsInGenre failed: ${error.message}`);
  return (data ?? []).map((c) => ({ slug: c.slug, nameJa: c.name_ja, nameEn: c.name_en }));
}

/** sitemap用。全チェーンのslug。 */
export async function fetchAllChainSlugs(): Promise<string[]> {
  const db = await createClient();
  const data = await fetchAllRows(
    (from, to) => db.from("chains").select("slug").order("sort_order").range(from, to),
    "fetchAllChainSlugs",
  );
  return data.map((c) => c.slug);
}

// -----------------------------------------------------------------------------
// 市区町村名の他言語表記（place_names）。
// 実装部隊の報告「/en の本場・産地チップに市区町村名が日本語のまま」対応。
// -----------------------------------------------------------------------------

/**
 * 指定ロケールの市区町村名マップを1クエリでまとめて取得する（N+1回避）。
 * `${pref}::${city}` をキーにした Record を返し、純粋関数 translateCityName
 * （src/features/map/placeNames.ts）と組み合わせて使う。
 * ja は翻訳不要（呼び出し側で空オブジェクトのまま渡してよい）。
 */
export async function fetchPlaceNames(locale: "en" = "en"): Promise<PlaceNameMap> {
  const db = await createClient();
  const data = await fetchAllRows(
    (from, to) =>
      db.from("place_names").select("pref, city, name").eq("locale", locale).range(from, to),
    "fetchPlaceNames",
  );

  const map: PlaceNameMap = {};
  for (const row of data) {
    map[`${row.pref}::${row.city}`] = row.name;
  }
  return map;
}
