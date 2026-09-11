import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAll";

import { pickGuideTranslation, type Locale } from "./i18n";
import { GUIDE_KINDS, type GuideKind } from "./kinds";
import { pickOtherGuides, type OtherGuides } from "./related";
import type { GuideDetail, GuideLink, GuideSummary } from "./types";

export type { Locale } from "./i18n";
export type { GuideKind } from "./kinds";
export type { OtherGuides } from "./related";
export type { GuideDetail, GuideLink, GuideSummary } from "./types";

type TranslationRow = { locale: string; title: string; summary: string | null; body_md?: string | null };

function toSummary(
  guide: { slug: string; kind: string; sort_order: number },
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
        .select("slug, kind, sort_order, guide_translations ( locale, title, summary )")
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
      `slug, kind, sort_order,
       guide_translations ( locale, title, summary, body_md ),
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

  const names = new Map<string, { nameJa: string; nameEn: string }>();
  const keyOf = (kind: string, slug: string) => `${kind}:${slug}`;

  if (genreSlugs.length > 0) {
    const { data, error } = await db.from("genres").select("slug, name_ja, name_en").in("slug", genreSlugs);
    if (error) throw new Error(`resolveGuideLinks(genre) failed: ${error.message}`);
    for (const g of data ?? []) names.set(keyOf("genre", g.slug), { nameJa: g.name_ja, nameEn: g.name_en });
  }
  if (shelfSlugs.length > 0) {
    const { data, error } = await db.from("shelves").select("slug, name_ja, name_en").in("slug", shelfSlugs);
    if (error) throw new Error(`resolveGuideLinks(shelf) failed: ${error.message}`);
    for (const s of data ?? []) names.set(keyOf("shelf", s.slug), { nameJa: s.name_ja, nameEn: s.name_en });
  }
  if (tagSlugs.length > 0) {
    const { data, error } = await db.from("tags").select("slug, name_ja, name_en").in("slug", tagSlugs);
    if (error) throw new Error(`resolveGuideLinks(tag) failed: ${error.message}`);
    for (const tag of data ?? []) names.set(keyOf("tag", tag.slug), { nameJa: tag.name_ja, nameEn: tag.name_en });
  }

  const links: GuideLink[] = [];
  for (const l of rawLinks) {
    const kind = l.target_kind as GuideLink["kind"];
    const entry = names.get(keyOf(kind, l.target_slug));
    if (!entry) continue;
    links.push({ kind, slug: l.target_slug, name: locale === "ja" ? entry.nameJa : entry.nameEn });
  }
  return links;
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
       guides!inner ( slug, kind, sort_order, guide_translations ( locale, title, summary ) )`,
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
