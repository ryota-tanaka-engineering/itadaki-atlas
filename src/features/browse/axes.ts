import type { BrowseItem } from "@/features/map/queries";
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

/** 「地域」軸で originPref を持たないアイテム（部位・ネタ等）がまとまる群のキー。
 * IndexList.tsx の groupLabel（/en 表示）もこのキーで判定する。 */
export const NO_REGION_KEY = "地域なし";

export type Group = {
  key: string;
  label: string;
  items: BrowseItem[];
};

/**
 * ローマ字の頭文字から五十音の行を割り出す。
 *
 * 読み仮名のカラムを持たないため、`name_romaji` を読みの代理として使う
 * （三点セットの一部として全件必須なので欠けない）。
 * TODO: [仮名の読みが必要な精度になったら food_items に reading カラムを足す。
 *        ジャンル追加で漢字表記が増えたときに判断する]
 */
export const KANA_ROWS: { label: string; heads: string[] }[] = [
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

/**
 * 五十音グループの日本語キー（"あ行" 等）から、ローマ字頭文字の表示ラベルを引く
 * （/en の五十音グループ見出し用。CLAUDE.md「あわせて直す /en の残り」節）。
 * 該当しない（「その他」グループ）場合は null を返し、呼び出し側が英語の
 * フォールバック文言（browse.kanaOther）を出す。
 */
export function kanaRomajiLabel(key: string): string | null {
  const row = KANA_ROWS.find((r) => r.label === key);
  return row ? row.heads.map((h) => h.toUpperCase()).join("/") : null;
}

function byRomaji(a: BrowseItem, b: BrowseItem) {
  return a.nameRomaji.localeCompare(b.nameRomaji, "en");
}

/** 指定軸でグルーピングする。空のグループは返さない。 */
export function groupBy(items: BrowseItem[], axis: Axis): Group[] {
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
      const key = item.originPref ?? NO_REGION_KEY;
      if (!buckets.has(key)) {
        // 発祥地の物語を持たないアイテム（部位・ネタ等）の群見出し（実装部隊の報告
        // 「トップで牛肉の部位等を選ぶと0件」対応。ジャンルページの「図鑑」節と同じ語彙。
        // 座標も無いため地図には乗らないが、五十音タブには普通に並ぶ）。
        const label = key === NO_REGION_KEY ? "図鑑（土地なし）" : key;
        buckets.set(key, { key, label, items: [] });
      }
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
