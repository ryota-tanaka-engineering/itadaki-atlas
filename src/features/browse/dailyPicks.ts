import { differenceInCalendarDays } from "date-fns";

import type { BrowseItem, HonbaGroup } from "@/features/map/queries";

/**
 * トップ「今日の一皿」「土地の物語から」用の日替わり順繰り選定
 * （作業パッケージ「トップページ情報モジュール」§1・§4）。
 *
 * ランキング・「おすすめ」ではなく、日付だけで機械的に決まる中立な順繰り
 * （通算日 % 本文を持つアイテム数）。サーバー側（page.tsx）で日時を1回だけ確定させ、
 * 誰が見ても同じ結果になる（クライアント側の時計やランダム性に依存しない）。
 */
const EPOCH = new Date(2020, 0, 1);

function epochDay(today: Date): number {
  return differenceInCalendarDays(today, EPOCH);
}

/** 負の剰余を避けるための mod（JS の % は負数を返しうる）。 */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export type DailyPicks = {
  /** 本文を持つアイテムが1件も無ければ null（データ未投入時のフォールバック）。 */
  dish: BrowseItem | null;
  /** 「今日の一皿」と重複しない、最大 storyCount 件。 */
  stories: BrowseItem[];
};

/**
 * items から本文（body_md）を持つものだけを母集団にし、日付オフセットの順繰りで
 * 「今日の一皿」1件と「土地の物語から」storyCount 件を選ぶ。
 * 母集団の並び順は呼び出し側（fetchMapItems、slug順）に従うため、日付が変わらない限り
 * 同じ結果になる。
 */
export function pickDailyItems(items: BrowseItem[], today: Date, storyCount = 3): DailyPicks {
  const pool = items.filter((i) => i.hasBody);
  if (pool.length === 0) return { dish: null, stories: [] };

  const day = epochDay(today);
  const dishIndex = mod(day, pool.length);
  const dish = pool[dishIndex];

  const stories: BrowseItem[] = [];
  const maxStories = Math.min(storyCount, pool.length - 1);
  for (let offset = 1; stories.length < maxStories; offset++) {
    stories.push(pool[mod(dishIndex + offset, pool.length)]);
  }

  return { dish, stories };
}

/**
 * トップ「本場をたどる」の表示件数を絞る日替わり順繰り選定
 * （本番レビュー「本場を辿るはなんでこの仕分け？魚だけ？違和感しかない」対応）。
 *
 * 本場を持つアイテムは魚介棚（seafood）に偏りやすいため、全件をそのまま並べると
 * 魚介ばかりの一覧に見える。ランキングにはせず、pickDailyItems と同じ通算日ベースの
 * 順繰り（rotate）で母集団を回しつつ、次の2条件だけを制約として掛ける:
 *
 * - 料理（type=dish）を優先する（先に dish だけを rotate 順で拾い、枠が余れば食材等で埋める）
 * - 魚介（shelf=seafood）は seafoodCap 件まで
 *
 * どちらも「順位付け」ではなく「その日の巡回開始位置から見て何を出すか」を
 * 決めるだけなので、日付が変われば構成も入れ替わる中立な導線であり続ける。
 */
export function pickHonbaGroups(
  groups: HonbaGroup[],
  today: Date,
  max = 6,
  seafoodCap = 2,
): HonbaGroup[] {
  if (groups.length === 0) return [];

  const offset = mod(epochDay(today), groups.length);
  const rotated = [...groups.slice(offset), ...groups.slice(0, offset)];

  const picked: HonbaGroup[] = [];
  const pickedSlugs = new Set<string>();
  let seafoodCount = 0;

  const tryPick = (g: HonbaGroup) => {
    if (picked.length >= max || pickedSlugs.has(g.slug)) return;
    const isSeafood = g.shelfSlug === "seafood";
    if (isSeafood && seafoodCount >= seafoodCap) return;
    picked.push(g);
    pickedSlugs.add(g.slug);
    if (isSeafood) seafoodCount++;
  };

  // 「辿る」モジュールなので、本場が2箇所以上ある食べものを優先する
  // （本番レビュー「本場を辿るが一項目1箇所だけで意味をなしてない」対応）。
  // 1周目: 料理（dish）かつ2箇所以上 → 2周目: 2箇所以上 → 3周目: 料理 → 4周目: 残り
  const multi = (g: HonbaGroup) => g.cities.length >= 2;
  const passes: Array<(g: HonbaGroup) => boolean> = [
    (g) => g.itemType === "dish" && multi(g),
    multi,
    (g) => g.itemType === "dish",
    () => true,
  ];
  for (const pass of passes) {
    for (const g of rotated) {
      if (picked.length >= max) break;
      if (pass(g)) tryPick(g);
    }
  }

  return picked;
}
