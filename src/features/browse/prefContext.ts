import type { Shelf } from "@/features/map/queries";

/**
 * 県絞り込みの一行文脈（PREF_FILTER_IMPL_BRIEF.md §設計4 / 体験検品フォローアップ§3）。
 *
 * 県には DB の総論が無いため、visibleItems（origin_pref が一致する発祥アイテム）
 * から機械的に3群を数える。分け方は地域ページ（src/app/[locale]/region/[pref]/page.tsx）
 * の GRP_ORDER と同じ shelves.grp（dish/ingredient/preparation）を流用する
 * （棚データを二重に定義しない）。本場（regionRelation）はここでは扱わない
 * （visibleItems は既に origin_pref === prefFilter の発祥アイテムに絞られている）。
 *
 * 「これは何か」が件数だけでは伝わらないという体験検品の指摘を受け、各群の代表
 * （visibleItems の並び順の先頭3件。ランキングにしない）の名前も添える。
 */
export type PrefContextItemName = {
  nameJa: string;
  /** /en 表示用。CLAUDE.md「名称表記」に合わせ、代表名は説明訳ではなくローマ字を使う。 */
  nameRomaji: string;
};

export type PrefContextGroup = {
  count: number;
  /** 代表3件（先頭固定。件数が3を超えるかどうかは呼び出し側が count > 3 で判定する）。 */
  representatives: PrefContextItemName[];
};

export type PrefContextCounts = {
  dish: PrefContextGroup;
  ingredient: PrefContextGroup;
  preparation: PrefContextGroup;
};

const REPRESENTATIVES_LIMIT = 3;

export function countPrefContext(
  items: (PrefContextItemName & { shelfSlug: string })[],
  shelves: Pick<Shelf, "slug" | "grp">[],
): PrefContextCounts {
  const grpOfShelf = new Map(shelves.map((s) => [s.slug, s.grp]));
  const dish: PrefContextGroup = { count: 0, representatives: [] };
  const ingredient: PrefContextGroup = { count: 0, representatives: [] };
  const preparation: PrefContextGroup = { count: 0, representatives: [] };
  const groups = { dish, ingredient, preparation };

  for (const item of items) {
    const grp = grpOfShelf.get(item.shelfSlug);
    if (grp !== "dish" && grp !== "ingredient" && grp !== "preparation") continue;
    const group = groups[grp];
    group.count += 1;
    if (group.representatives.length < REPRESENTATIVES_LIMIT) {
      group.representatives.push({ nameJa: item.nameJa, nameRomaji: item.nameRomaji });
    }
  }

  return groups;
}
