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

type PrefContextKey = "prefContextDish" | "prefContextIngredient" | "prefContextPrep" | "prefContextHonba";

/**
 * 県の一行文脈の文字列を組み立てる（トップの県絞り込みと県ページで共有。
 * 体験原則2「選択の直後に必ず文脈を出す」）。`t` は messages の `browse` 名前空間の翻訳関数。
 * 0件の群は出さない。代表（先頭最大3件）を括弧で添え、件数が代表数を超えるときだけ「ほか」を足す。
 * 全部0件なら null。
 */
export function formatPrefContextLine(
  counts: PrefContextCounts,
  honbaCount: number,
  locale: string,
  t: (key: PrefContextKey | "prefContextExamples" | "prefContextMore", values?: Record<string, string | number>) => string,
): string | null {
  const isJa = locale === "ja";
  const groupLine = (key: PrefContextKey, group: PrefContextGroup): string | null => {
    if (group.count === 0) return null;
    const names = group.representatives.map((r) => (isJa ? r.nameJa : r.nameRomaji));
    if (names.length === 0) return t(key, { count: group.count });
    const joined = names.join(isJa ? "、" : ", ");
    const withMore =
      group.count > names.length ? `${joined}${isJa ? " " : ", "}${t("prefContextMore")}` : joined;
    return `${t(key, { count: group.count })}${t("prefContextExamples", { names: withMore })}`;
  };
  const parts = [
    groupLine("prefContextDish", counts.dish),
    groupLine("prefContextIngredient", counts.ingredient),
    groupLine("prefContextPrep", counts.preparation),
    honbaCount > 0 ? t("prefContextHonba", { count: honbaCount }) : null,
  ].filter((s): s is string => s !== null);
  return parts.length === 0 ? null : parts.join(isJa ? "・" : " / ");
}
