import { differenceInCalendarDays } from "date-fns";

import type { BrowseItem } from "@/features/map/queries";

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
  const pool = items.filter((i) => i.bodyExcerpt !== null);
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
