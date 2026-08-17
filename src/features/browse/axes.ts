import type { MapItem } from "@/features/map/queries";
import { PRIMARY_STYLES } from "@/features/map/styles";
import { prefectureOrder } from "@/lib/prefectures";

/**
 * 索引の3軸（.doc/30_features/01_requirements.md F-03）。
 *
 * 索引は地図の付属品ではなく**対等なビュー**であり、スクリーンリーダー向けの
 * 主要動線でもある（F-07）。地図と同じデータから生成する。
 */
export const AXES = ["kana", "region", "style"] as const;
export type Axis = (typeof AXES)[number];

// 軸のラベルは messages/*.json（browse.axis）が持つ。ここには置かない。

export type Group = {
  key: string;
  label: string;
  items: MapItem[];
};

/**
 * ローマ字の頭文字から五十音の行を割り出す。
 *
 * 読み仮名のカラムを持たないため、`name_romaji` を読みの代理として使う
 * （三点セットの一部として全件必須なので欠けない）。
 * TODO: [仮名の読みが必要な精度になったら food_items に reading カラムを足す。
 *        ジャンル追加で漢字表記が増えたときに判断する]
 */
const KANA_ROWS: { label: string; heads: string[] }[] = [
  { label: "あ行", heads: ["a", "i", "u", "e", "o"] },
  { label: "か行", heads: ["k", "g"] },
  { label: "さ行", heads: ["s", "z", "j"] },
  { label: "た行", heads: ["t", "d", "c"] },
  { label: "な行", heads: ["n"] },
  { label: "は行", heads: ["h", "f", "b", "p"] },
  { label: "ま行", heads: ["m"] },
  { label: "や行", heads: ["y"] },
  { label: "ら行", heads: ["r", "l"] },
  { label: "わ行", heads: ["w"] },
];

function kanaRow(romaji: string): { key: string; label: string } {
  const head = romaji.trim().charAt(0).toLowerCase();
  const row = KANA_ROWS.find((r) => r.heads.includes(head));
  return row ? { key: row.label, label: row.label } : { key: "その他", label: "その他" };
}

function byRomaji(a: MapItem, b: MapItem) {
  return a.nameRomaji.localeCompare(b.nameRomaji, "en");
}

/** 指定軸でグルーピングする。空のグループは返さない。 */
export function groupBy(items: MapItem[], axis: Axis): Group[] {
  if (axis === "kana") {
    const buckets = new Map<string, Group>();
    for (const item of items) {
      const { key, label } = kanaRow(item.nameRomaji);
      if (!buckets.has(key)) buckets.set(key, { key, label, items: [] });
      buckets.get(key)!.items.push(item);
    }
    const order = [...KANA_ROWS.map((r) => r.label), "その他"];
    return [...buckets.values()]
      .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
      .map((g) => ({ ...g, items: [...g.items].sort(byRomaji) }));
  }

  if (axis === "region") {
    const buckets = new Map<string, Group>();
    for (const item of items) {
      const key = item.originPref ?? "地域なし";
      if (!buckets.has(key)) buckets.set(key, { key, label: key, items: [] });
      buckets.get(key)!.items.push(item);
    }
    // 都道府県はJISコード順（北→南）。マスタに無いものは末尾。
    return [...buckets.values()]
      .sort((a, b) => prefectureOrder(a.key) - prefectureOrder(b.key) || a.key.localeCompare(b.key, "ja"))
      .map((g) => ({ ...g, items: [...g.items].sort(byRomaji) }));
  }

  // style
  const buckets = new Map<string, Group>();
  for (const item of items) {
    const key = item.primaryStyle ?? "系統不明";
    if (!buckets.has(key)) buckets.set(key, { key, label: key, items: [] });
    buckets.get(key)!.items.push(item);
  }
  const order: string[] = [...PRIMARY_STYLES, "系統不明"];
  return [...buckets.values()]
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    .map((g) => ({ ...g, items: [...g.items].sort(byRomaji) }));
}
