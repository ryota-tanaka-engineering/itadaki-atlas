import type { Shelf } from "@/features/map/queries";

/**
 * 県絞り込みの一行文脈（PREF_FILTER_IMPL_BRIEF.md §設計4）。
 *
 * 県には DB の総論が無いため、visibleItems（origin_pref が一致する発祥アイテム）
 * から機械的に3群を数える。分け方は地域ページ（src/app/[locale]/region/[pref]/page.tsx）
 * の GRP_ORDER と同じ shelves.grp（dish/ingredient/preparation）を流用する
 * （棚データを二重に定義しない）。本場（regionRelation）はここでは扱わない
 * （visibleItems は既に origin_pref === prefFilter の発祥アイテムに絞られている）。
 */
export type PrefContextCounts = {
  dish: number;
  ingredient: number;
  preparation: number;
};

export function countPrefContext(
  items: { shelfSlug: string }[],
  shelves: Pick<Shelf, "slug" | "grp">[],
): PrefContextCounts {
  const grpOfShelf = new Map(shelves.map((s) => [s.slug, s.grp]));
  const counts: PrefContextCounts = { dish: 0, ingredient: 0, preparation: 0 };
  for (const item of items) {
    const grp = grpOfShelf.get(item.shelfSlug);
    if (grp === "dish" || grp === "ingredient" || grp === "preparation") {
      counts[grp] += 1;
    }
  }
  return counts;
}
