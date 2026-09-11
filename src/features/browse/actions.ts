"use server";

import { fetchItemExcerpts, type ItemExcerpt, type Locale } from "@/features/map/queries";

import { itemExcerptRequestSchema } from "./schemas";

export type FetchSelectedItemExcerptResult =
  | { ok: true; data: ItemExcerpt | null }
  | { ok: false; error: string };

/**
 * トップのピン選択カード用。summary/bodyExcerpt は BrowseItem に含まれない
 * （RSCペイロード削減。src/features/map/queries.ts の BrowseItem docコメント参照）ため、
 * ピンタップ・索引タップで選択が変わるたびにこの Server Action で1件だけ取る
 * （ia-nextjs-standards「データ取得はサーバー側」。クライアントから直接Supabaseは叩かない）。
 * 呼び出し側（BrowseShell）で slug 単位にキャッシュし、同じアイテムの再選択では呼ばない。
 */
export async function fetchSelectedItemExcerpt(input: unknown): Promise<FetchSelectedItemExcerptResult> {
  const parsed = itemExcerptRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }
  const { slug, locale } = parsed.data;
  const map = await fetchItemExcerpts([slug], locale as Locale);
  return { ok: true, data: map.get(slug) ?? null };
}
