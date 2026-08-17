import type { Prefecture } from "@/lib/prefectures";

/**
 * ディフォルメ地図（選挙特番型）の格子配置。
 *
 * 縦画面で日本列島を俯瞰すると細長く斜めなため余白だらけになり、
 * 「どの県に何個あるか」が読み取れない。実座標を捨てて格子に並べ替えることで
 * **一覧性**を確保する（.doc/30_features/02_ui_ux.md §3）。
 *
 * 地理的な正確さではなく、隣接関係と大まかな方角が保たれていれば足りる。
 */
export type GridCell = {
  pref: Prefecture;
  /** 表示用の短縮名（格子が小さいので県・府を落とす） */
  short: string;
  col: number;
  row: number;
};

export const GRID_COLS = 12;
export const GRID_ROWS = 11;

export const GRID: GridCell[] = [
  { pref: "北海道", short: "北海道", col: 10, row: 0 },

  { pref: "青森県", short: "青森", col: 10, row: 2 },
  { pref: "秋田県", short: "秋田", col: 9, row: 3 },
  { pref: "岩手県", short: "岩手", col: 10, row: 3 },
  { pref: "山形県", short: "山形", col: 9, row: 4 },
  { pref: "宮城県", short: "宮城", col: 10, row: 4 },
  { pref: "新潟県", short: "新潟", col: 8, row: 5 },
  { pref: "福島県", short: "福島", col: 9, row: 5 },

  { pref: "石川県", short: "石川", col: 6, row: 5 },
  { pref: "富山県", short: "富山", col: 7, row: 5 },
  { pref: "群馬県", short: "群馬", col: 8, row: 6 },
  { pref: "栃木県", short: "栃木", col: 9, row: 6 },
  { pref: "茨城県", short: "茨城", col: 10, row: 6 },

  { pref: "福井県", short: "福井", col: 6, row: 6 },
  { pref: "岐阜県", short: "岐阜", col: 7, row: 6 },
  { pref: "長野県", short: "長野", col: 7, row: 7 },
  { pref: "埼玉県", short: "埼玉", col: 9, row: 7 },
  { pref: "千葉県", short: "千葉", col: 10, row: 7 },

  { pref: "鳥取県", short: "鳥取", col: 4, row: 6 },
  { pref: "島根県", short: "島根", col: 3, row: 6 },
  { pref: "京都府", short: "京都", col: 5, row: 6 },
  { pref: "滋賀県", short: "滋賀", col: 6, row: 7 },
  { pref: "愛知県", short: "愛知", col: 7, row: 8 },
  { pref: "山梨県", short: "山梨", col: 8, row: 7 },
  { pref: "東京都", short: "東京", col: 9, row: 8 },
  { pref: "神奈川県", short: "神奈川", col: 8, row: 8 },

  { pref: "山口県", short: "山口", col: 2, row: 7 },
  { pref: "広島県", short: "広島", col: 3, row: 7 },
  { pref: "岡山県", short: "岡山", col: 4, row: 7 },
  { pref: "兵庫県", short: "兵庫", col: 5, row: 7 },
  { pref: "大阪府", short: "大阪", col: 5, row: 8 },
  { pref: "奈良県", short: "奈良", col: 6, row: 8 },
  { pref: "三重県", short: "三重", col: 6, row: 9 },
  { pref: "静岡県", short: "静岡", col: 8, row: 9 },
  { pref: "和歌山県", short: "和歌山", col: 5, row: 9 },

  { pref: "香川県", short: "香川", col: 4, row: 8 },
  { pref: "徳島県", short: "徳島", col: 4, row: 9 },
  { pref: "愛媛県", short: "愛媛", col: 3, row: 8 },
  { pref: "高知県", short: "高知", col: 3, row: 9 },

  { pref: "福岡県", short: "福岡", col: 1, row: 7 },
  { pref: "佐賀県", short: "佐賀", col: 0, row: 7 },
  { pref: "長崎県", short: "長崎", col: 0, row: 8 },
  { pref: "大分県", short: "大分", col: 2, row: 8 },
  { pref: "熊本県", short: "熊本", col: 1, row: 8 },
  { pref: "宮崎県", short: "宮崎", col: 2, row: 9 },
  { pref: "鹿児島県", short: "鹿児島", col: 1, row: 9 },

  { pref: "沖縄県", short: "沖縄", col: 0, row: 10 },
];
