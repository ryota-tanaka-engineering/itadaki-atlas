// cookieを使わない読み取り専用クライアント。理由は src/features/map/queries.ts と同じ
// （県ページの`export const revalidate`＝ISRを効かせるため。cookies()呼び出しは
// Next.jsを動的レンダリングへ固定してしまう）。
import { createStaticClient as createClient } from "@/lib/supabase/static";
import { fetchAllRows } from "@/lib/supabase/fetchAll";
import { prefFromSlug, PREF_SLUGS, type Prefecture } from "@/lib/prefectures";

import jaMessages from "../../../messages/ja.json";
import enMessages from "../../../messages/en.json";

import { pickGuideTranslation, type Locale } from "./i18n";
import { GUIDE_KINDS, type GuideKind } from "./kinds";
import { pickOtherGuides, type OtherGuides } from "./related";
import type { GuideDetail, GuideLink, GuideSummary } from "./types";

export type { Locale } from "./i18n";
export type { GuideKind } from "./kinds";
export type { OtherGuides } from "./related";
export type { GuideDetail, GuideLink, GuideSummary } from "./types";

type TranslationRow = {
  locale: string;
  title: string;
  summary: string | null;
  body_md?: string | null;
  when_note?: string | null;
};
type GuideRow = { slug: string; kind: string; sort_order: number; pref?: string | null; city?: string | null };

// prefecture 表示名の辞書（messages/*.json の "prefecture" 名前空間。next-intl の
// t() をサーバーコンポーネント外（このデータ層）から呼べないため、静的importで直接引く。
// キーは PREFECTURES と同じ日本語名。ja は恒等・en は英訳（src/features/map/MapView.tsx 参照）
const PREF_DISPLAY: Record<Locale, Record<string, string>> = {
  ja: jaMessages.prefecture,
  en: enMessages.prefecture,
};

function toSummary(
  guide: GuideRow,
  translations: TranslationRow[],
  locale: Locale,
): GuideSummary | null {
  const t = pickGuideTranslation(translations, locale);
  if (!t) return null;
  return {
    slug: guide.slug,
    kind: guide.kind as GuideKind,
    sortOrder: guide.sort_order,
    title: t.title,
    summary: t.summary ?? null,
    pref: guide.pref ?? null,
    city: guide.city ?? null,
    whenNote: t.when_note ?? null,
  };
}

/**
 * `/guide` 一覧用。kind → sort_order の順で返す（呼び出し側でkind別にグルーピングする。
 * `/tags` の kind グルーピングと同じ方針）。未翻訳（title欠落）のガイドは黙って除く。
 */
export async function fetchGuides(locale: Locale): Promise<GuideSummary[]> {
  const db = await createClient();
  const data = await fetchAllRows(
    (from, to) =>
      db
        .from("guides")
        .select("slug, kind, sort_order, pref, city, guide_translations ( locale, title, summary, when_note )")
        .order("kind")
        .order("sort_order")
        .range(from, to),
    "fetchGuides",
  );

  return data
    .map((g) => toSummary(g, (g.guide_translations ?? []) as TranslationRow[], locale))
    .filter((g): g is GuideSummary => g !== null);
}

/**
 * ガイド詳細ページ（`/guide/[slug]`）用。slug 未一致は null を返し、
 * 呼び出し側で notFound() する（`fetchChainBySlug` と同じ方針）。
 */
export async function fetchGuideBySlug(slug: string, locale: Locale): Promise<GuideDetail | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("guides")
    .select(
      `slug, kind, sort_order, pref, city, lat, lng,
       guide_translations ( locale, title, summary, body_md, when_note ),
       guide_links ( target_kind, target_slug )`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`fetchGuideBySlug failed: ${error.message}`);
  if (!data) return null;

  const t = pickGuideTranslation((data.guide_translations ?? []) as TranslationRow[], locale);
  if (!t) return null;

  const links = await resolveGuideLinks(
    (data.guide_links ?? []) as { target_kind: string; target_slug: string }[],
    locale,
  );

  return {
    slug: data.slug,
    kind: data.kind as GuideKind,
    sortOrder: data.sort_order,
    title: t.title,
    summary: t.summary ?? null,
    bodyMd: t.body_md ?? null,
    pref: data.pref ?? null,
    city: data.city ?? null,
    whenNote: t.when_note ?? null,
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    links,
  };
}

/**
 * guide_links（target_kind/target_slug への疎な参照）を、表示用の名前付きリンクへ解決する。
 * 参照先が未投入・削除済みで見つからない場合はそのリンクを黙って落とす
 * （行き止まりリンクを出さないため。壊れた参照はデータ側の問題として投入スクリプト側で検証する）。
 */
async function resolveGuideLinks(
  rawLinks: { target_kind: string; target_slug: string }[],
  locale: Locale,
): Promise<GuideLink[]> {
  if (rawLinks.length === 0) return [];
  const db = await createClient();

  const genreSlugs = rawLinks.filter((l) => l.target_kind === "genre").map((l) => l.target_slug);
  const shelfSlugs = rawLinks.filter((l) => l.target_kind === "shelf").map((l) => l.target_slug);
  const tagSlugs = rawLinks.filter((l) => l.target_kind === "tag").map((l) => l.target_slug);
  // pref/item は2026-09-12「体験と場所」で追加
  const prefSlugs = rawLinks.filter((l) => l.target_kind === "pref").map((l) => l.target_slug);
  const itemSlugs = rawLinks.filter((l) => l.target_kind === "item").map((l) => l.target_slug);

  const entries = new Map<string, { nameJa: string; nameEn: string; href: string }>();
  const keyOf = (kind: string, slug: string) => `${kind}:${slug}`;

  if (genreSlugs.length > 0) {
    const { data, error } = await db.from("genres").select("slug, name_ja, name_en").in("slug", genreSlugs);
    if (error) throw new Error(`resolveGuideLinks(genre) failed: ${error.message}`);
    for (const g of data ?? [])
      entries.set(keyOf("genre", g.slug), { nameJa: g.name_ja, nameEn: g.name_en, href: `/${g.slug}` });
  }
  if (shelfSlugs.length > 0) {
    const { data, error } = await db.from("shelves").select("slug, name_ja, name_en").in("slug", shelfSlugs);
    if (error) throw new Error(`resolveGuideLinks(shelf) failed: ${error.message}`);
    for (const s of data ?? [])
      entries.set(keyOf("shelf", s.slug), { nameJa: s.name_ja, nameEn: s.name_en, href: `/${s.slug}` });
  }
  if (tagSlugs.length > 0) {
    const { data, error } = await db.from("tags").select("slug, name_ja, name_en").in("slug", tagSlugs);
    if (error) throw new Error(`resolveGuideLinks(tag) failed: ${error.message}`);
    for (const tag of data ?? [])
      entries.set(keyOf("tag", tag.slug), { nameJa: tag.name_ja, nameEn: tag.name_en, href: `/tag/${tag.slug}` });
  }
  if (prefSlugs.length > 0) {
    // 都道府県はDBテーブルを持たない静的マスタ（src/lib/prefectures.ts）。
    // スラッグ→日本語名→表示名(messages/*.json の prefecture 辞書)で解決する
    for (const slug of prefSlugs) {
      const prefName = prefFromSlug(slug);
      if (!prefName) continue;
      entries.set(keyOf("pref", slug), {
        nameJa: PREF_DISPLAY.ja[prefName] ?? prefName,
        nameEn: PREF_DISPLAY.en[prefName] ?? prefName,
        href: `/region/${slug}`,
      });
    }
  }
  if (itemSlugs.length > 0) {
    const { data, error } = await db
      .from("food_items")
      .select("slug, name_romaji, shelf_slug, genres ( slug ), food_item_translations ( locale, name )")
      .in("slug", itemSlugs);
    if (error) throw new Error(`resolveGuideLinks(item) failed: ${error.message}`);
    for (const item of data ?? []) {
      const translations = (item.food_item_translations ?? []) as { locale: string; name: string }[];
      const nameJa = translations.find((t) => t.locale === "ja")?.name ?? item.name_romaji;
      const genre = Array.isArray(item.genres) ? item.genres[0] : item.genres;
      // 英語表示は名前ではなくローマ字見出しにする方針（.doc/00_concept/05_brand.md §5。
      // 詳細ページ [genre]/[slug]/page.tsx と同じ規約）。href はジャンルがあればジャンル配下、
      // 無ければ棚内「その他」の到達経路（棚slug配下）を使う（同ページの resolveItem と同じ規約）
      entries.set(keyOf("item", item.slug), {
        nameJa,
        nameEn: item.name_romaji,
        href: `/${genre?.slug ?? item.shelf_slug}/${item.slug}`,
      });
    }
  }

  const links: GuideLink[] = [];
  for (const l of rawLinks) {
    const kind = l.target_kind as GuideLink["kind"];
    const entry = entries.get(keyOf(kind, l.target_slug));
    if (!entry) continue;
    links.push({
      kind,
      slug: l.target_slug,
      name: locale === "ja" ? entry.nameJa : entry.nameEn,
      href: entry.href,
    });
  }
  return links;
}

/**
 * 県ページ（`/region/[pref]`）「この土地の食体験」節用（逆引き）。
 * `guide_links.target_kind='pref'`（スラッグで結ばれたもの）と、ガイド自身の `pref`列
 * （日本語県名。food_items.origin_pref と同じ規約）の両方から、その県に紐づく
 * 体験ガイド（食の街・市場・祭り・ビアガーデン・酒蔵見学・工場見学等）を集める。
 * 1件も無ければ空配列（呼び出し側で節ごと非表示にする。CLAUDE.md 体験原則6）。
 */
export async function fetchGuidesForPref(
  pref: Prefecture,
  locale: Locale,
  limit = 6,
): Promise<GuideSummary[]> {
  const prefSlug = PREF_SLUGS[pref];
  const db = await createClient();

  const [own, viaLinks] = await Promise.all([
    db
      .from("guides")
      .select("slug, kind, sort_order, pref, city, guide_translations ( locale, title, summary, when_note )")
      .eq("pref", pref)
      .order("sort_order"),
    db
      .from("guide_links")
      .select(
        `guide_id,
         guides!inner ( slug, kind, sort_order, pref, city, guide_translations ( locale, title, summary, when_note ) )`,
      )
      .eq("target_kind", "pref")
      .eq("target_slug", prefSlug),
  ]);
  if (own.error) throw new Error(`fetchGuidesForPref failed: ${own.error.message}`);
  if (viaLinks.error) throw new Error(`fetchGuidesForPref failed: ${viaLinks.error.message}`);

  const seen = new Set<string>();
  const guides: GuideSummary[] = [];
  const tryAdd = (g: GuideRow, translations: TranslationRow[]) => {
    if (seen.has(g.slug)) return;
    const summary = toSummary(g, translations, locale);
    if (!summary) return;
    seen.add(g.slug);
    guides.push(summary);
  };

  for (const g of own.data ?? []) tryAdd(g, (g.guide_translations ?? []) as TranslationRow[]);
  for (const row of viaLinks.data ?? []) {
    const g = Array.isArray(row.guides) ? row.guides[0] : row.guides;
    if (!g) continue;
    tryAdd(g, (g.guide_translations ?? []) as TranslationRow[]);
  }

  guides.sort((a, b) => a.sortOrder - b.sortOrder);
  return guides.slice(0, limit);
}

/**
 * 詳細ページ「他のガイド」用。全ガイド（一覧と同じ並び）を取り、純関数 `pickOtherGuides` で
 * 同kindの他ガイド + 次kindの先頭を選ぶ（データ件数が少ないため取得後にアプリ層で絞る）。
 */
export async function fetchOtherGuides(
  kind: GuideKind,
  currentSlug: string,
  locale: Locale,
): Promise<OtherGuides> {
  const all = await fetchGuides(locale);
  return pickOtherGuides(all, kind, currentSlug);
}

export type ItemGuideTargets = {
  genreSlug: string | null;
  shelfSlug: string;
  tagSlugs: string[];
};

/**
 * 詳細ページ「食べに行く前に」節用（逆引き）。アイテムの genre/shelf/tags のいずれかに
 * guide_links で結ばれたガイドを最大 `limit` 件、sort_order順で返す。
 * 1件も無ければ空配列（呼び出し側で節ごと非表示にする）。
 */
export async function fetchGuidesForItem(
  targets: ItemGuideTargets,
  locale: Locale,
  limit = 3,
): Promise<GuideSummary[]> {
  const orParts: string[] = [];
  if (targets.genreSlug) orParts.push(`and(target_kind.eq.genre,target_slug.eq.${targets.genreSlug})`);
  orParts.push(`and(target_kind.eq.shelf,target_slug.eq.${targets.shelfSlug})`);
  for (const slug of targets.tagSlugs) {
    orParts.push(`and(target_kind.eq.tag,target_slug.eq.${slug})`);
  }
  if (orParts.length === 0) return [];

  const db = await createClient();
  const { data, error } = await db
    .from("guide_links")
    .select(
      `guide_id,
       guides!inner ( slug, kind, sort_order, pref, city, guide_translations ( locale, title, summary, when_note ) )`,
    )
    .or(orParts.join(","));
  if (error) throw new Error(`fetchGuidesForItem failed: ${error.message}`);

  const seen = new Set<string>();
  const guides: GuideSummary[] = [];
  for (const row of data ?? []) {
    const g = Array.isArray(row.guides) ? row.guides[0] : row.guides;
    if (!g || seen.has(g.slug)) continue;
    const summary = toSummary(g, (g.guide_translations ?? []) as TranslationRow[], locale);
    if (!summary) continue;
    seen.add(g.slug);
    guides.push(summary);
  }
  guides.sort((a, b) => a.sortOrder - b.sortOrder);
  return guides.slice(0, limit);
}

/** sitemap用。全ガイドのslug。 */
export async function fetchAllGuideSlugs(): Promise<string[]> {
  const db = await createClient();
  const data = await fetchAllRows(
    (from, to) => db.from("guides").select("slug").order("kind").order("sort_order").range(from, to),
    "fetchAllGuideSlugs",
  );
  return data.map((g) => g.slug);
}

export { GUIDE_KINDS };
