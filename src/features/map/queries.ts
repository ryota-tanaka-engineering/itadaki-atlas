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
function pickTranslation(
  translations: { locale: string; name: string; summary: string | null }[],
  locale: Locale,
) {
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
      `slug, name_romaji, origin_pref, origin_city, lat, lng,
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
    };
  });
}

/** 詳細ページが読む1件分。出典を含む。 */
export type ItemDetail = MapItem & {
  genreSlug: string;
  sources: {
    title: string;
    url: string | null;
    publisher: string | null;
    accessedAt: string | null;
  }[];
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
      `slug, name_romaji, origin_pref, origin_city, lat, lng,
       genres!inner ( slug ),
       food_item_translations ( locale, name, summary ),
       food_item_sources ( title, url, publisher, accessed_at ),
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
    genreSlug: toOne(data.genres)?.slug ?? genreSlug,
    sources: (data.food_item_sources ?? []).map((s) => ({
      title: s.title,
      url: s.url,
      publisher: s.publisher,
      accessedAt: s.accessed_at,
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
