/**
 * 詳細ページの位置帯が読む座標表記（CLAUDE.md「詳細ページの確定構造」2節）。
 *
 * 「43°03′N 141°21′E」形式（度分。秒は出さない）。経緯線グリッドは禁止だが、
 * 座標を1行だけテキストで見せるのは確定デザインで明示的に許可されている。
 */
function toDegMin(value: number, positiveHemisphere: string, negativeHemisphere: string): string {
  const hemisphere = value >= 0 ? positiveHemisphere : negativeHemisphere;
  const abs = Math.abs(value);
  const degrees = Math.floor(abs);
  const minutesRaw = Math.round((abs - degrees) * 60);
  // 分の丸めで60分になったら度へ繰り上げる
  const carry = minutesRaw === 60;
  const degreesOut = carry ? degrees + 1 : degrees;
  const minutesOut = carry ? 0 : minutesRaw;
  return `${String(degreesOut).padStart(2, "0")}°${String(minutesOut).padStart(2, "0")}′${hemisphere}`;
}

export function formatDegMinCoord(lat: number, lng: number): string {
  return `${toDegMin(lat, "N", "S")} ${toDegMin(lng, "E", "W")}`;
}
