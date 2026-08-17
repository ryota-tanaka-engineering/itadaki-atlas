/**
 * 都道府県マスタ。**JISコード順（北→南）** で保持する。
 *
 * 索引の「地域別」の並び順と、CSVインポートのバリデーションの両方がこれを使う。
 * 2箇所に持つと必ず片方が腐るため、ここを唯一の定義とする。
 */
export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

export type Prefecture = (typeof PREFECTURES)[number];

/** 並び替え用の索引。マスタに無い値は末尾に送る。 */
export function prefectureOrder(pref: string | null | undefined): number {
  if (!pref) return PREFECTURES.length;
  const i = (PREFECTURES as readonly string[]).indexOf(pref);
  return i < 0 ? PREFECTURES.length : i;
}
