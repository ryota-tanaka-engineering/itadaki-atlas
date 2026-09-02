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

/**
 * 位置帯の「東京から◯◯km」一行が起点にする東京駅の座標
 * （作業パッケージ「位置帯 全国ミニ地図化」で確定）。
 */
export const TOKYO_STATION = { lat: 35.681, lng: 139.767 } as const;

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 2点間の距離（km・ハバースイン公式）。 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(a));
}

/** 起点から見た終点の方位角（0=北・時計回り360度未満）。 */
function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

export const COMPASS_DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type CompassDirection = (typeof COMPASS_DIRECTIONS)[number];

function toCompassDirection(bearing: number): CompassDirection {
  const index = Math.round(bearing / 45) % COMPASS_DIRECTIONS.length;
  return COMPASS_DIRECTIONS[index];
}

/** これ未満の距離（東京都内相当）は「東京から◯◯km」の行を出さない閾値。 */
const TOKYO_LOCAL_RADIUS_KM = 30;

export type DistanceFromTokyo = {
  /** 10km単位に丸めた距離 */
  km: number;
  direction: CompassDirection;
};

/**
 * 位置帯に出す「東京から{方位}へ約{km}km」の元データ。
 * 東京都内相当（30km未満）は null（帯ごと距離行を出さない）。
 */
export function distanceFromTokyo(lat: number, lng: number): DistanceFromTokyo | null {
  const km = haversineKm(TOKYO_STATION.lat, TOKYO_STATION.lng, lat, lng);
  if (km < TOKYO_LOCAL_RADIUS_KM) return null;

  return {
    km: Math.round(km / 10) * 10,
    direction: toCompassDirection(bearingDeg(TOKYO_STATION.lat, TOKYO_STATION.lng, lat, lng)),
  };
}
