/**
 * 部位図（CutDiagram）が読む、アイテムslug → 塗る領域の対応表。
 *
 * データ駆動（作業パッケージ「詳細ページ概念図」§1）: SVG側（CutDiagram.tsx）は
 * 領域id を持つ図形を描くだけで、「どのslugでどの領域を塗るか」はここに集約する。
 * 領域idの実在チェックは cutDiagramData.test.ts が CutDiagram.tsx の
 * BEEF_REGION_IDS / PORK_REGION_IDS / CHICKEN_REGION_IDS（SVG側の実体）と突き合わせる。
 */

export type Species = "beef" | "pork" | "chicken";

/** 該当領域の塗りの濃さ。指定なしは通常の橙塗り（solid）。 */
export type CutRegionRef = { id: string; intensity?: "light" };

export type CutDiagramEntry = {
  species: Species;
  regions: CutRegionRef[];
};

/**
 * ご当地焼き鳥（部位ではなく料理そのものの名前）は対象外
 * （作業パッケージ「詳細ページ概念図」§1）。この5件はここに載せない。
 */
export const YAKITORI_EXCLUDED_SLUGS = [
  "bibai",
  "higashimatsuyama",
  "imabari",
  "kurume",
  "muroran",
  "nagato-yakitori",
] as const;

export const CUT_DIAGRAM_DATA: Record<string, CutDiagramEntry> = {
  // ---- 牛（正肉） ----
  "beef-neck": { species: "beef", regions: [{ id: "beef-neck" }] },
  "beef-shank": { species: "beef", regions: [{ id: "beef-shank" }] },
  "beef-short-rib": { species: "beef", regions: [{ id: "beef-short-rib" }] },
  "beef-tenderloin": { species: "beef", regions: [{ id: "beef-tenderloin" }] },
  "bottom-flap": { species: "beef", regions: [{ id: "bottom-flap" }] },
  "chuck-flap": { species: "beef", regions: [{ id: "chuck-flap" }] },
  "chuck-roll": { species: "beef", regions: [{ id: "chuck-roll" }] },
  "gyu-kata": { species: "beef", regions: [{ id: "gyu-kata" }] },
  harami: { species: "beef", regions: [{ id: "harami" }] },
  sagari: { species: "beef", regions: [{ id: "sagari" }] },
  "hoho-niku": { species: "beef", regions: [{ id: "hoho-niku" }] },
  knuckle: { species: "beef", regions: [{ id: "knuckle" }] },
  oxtail: { species: "beef", regions: [{ id: "oxtail" }] },
  "rib-roast": { species: "beef", regions: [{ id: "rib-roast" }] },
  rump: { species: "beef", regions: [{ id: "rump" }] },
  sirloin: { species: "beef", regions: [{ id: "sirloin" }] },
  "top-blade": { species: "beef", regions: [{ id: "top-blade" }] },
  "top-sirloin-cap": { species: "beef", regions: [{ id: "top-sirloin-cap" }] },
  "tri-tip": { species: "beef", regions: [{ id: "tri-tip" }] },
  gyutan: { species: "beef", regions: [{ id: "gyutan" }] },

  // ---- 牛（内臓） ----
  giara: { species: "beef", regions: [{ id: "giara" }] },
  "gyu-hatsu": { species: "beef", regions: [{ id: "gyu-hatsu" }] },
  "gyu-kobukuro": { species: "beef", regions: [{ id: "gyu-kobukuro" }] },
  "gyu-mame": { species: "beef", regions: [{ id: "gyu-mame" }] },
  "gyu-reba": { species: "beef", regions: [{ id: "gyu-reba" }] },
  hachinosu: { species: "beef", regions: [{ id: "hachinosu" }] },
  marucho: { species: "beef", regions: [{ id: "marucho" }] },
  mino: { species: "beef", regions: [{ id: "mino" }] },
  senmai: { species: "beef", regions: [{ id: "senmai" }] },
  shimacho: { species: "beef", regions: [{ id: "shimacho" }] },

  // ---- 豚（正肉） ----
  kashira: { species: "pork", regions: [{ id: "kashira" }] },
  mimiga: { species: "pork", regions: [{ id: "mimiga" }] },
  "pork-belly": { species: "pork", regions: [{ id: "pork-belly" }] },
  "pork-leg": { species: "pork", regions: [{ id: "pork-leg" }] },
  "pork-loin": { species: "pork", regions: [{ id: "pork-loin" }] },
  "pork-outside-round": { species: "pork", regions: [{ id: "pork-outside-round" }] },
  "pork-shoulder": { species: "pork", regions: [{ id: "pork-shoulder" }] },
  "pork-shoulder-loin": { species: "pork", regions: [{ id: "pork-shoulder-loin" }] },
  "pork-tenderloin": { species: "pork", regions: [{ id: "pork-tenderloin" }] },
  "spare-rib": { species: "pork", regions: [{ id: "spare-rib" }] },
  tonsoku: { species: "pork", regions: [{ id: "tonsoku" }] },
  tontoro: { species: "pork", regions: [{ id: "tontoro" }] },
  "buta-tan": { species: "pork", regions: [{ id: "buta-tan" }] },

  // ---- 豚（内臓） ----
  "buta-daicho": { species: "pork", regions: [{ id: "buta-daicho" }] },
  "buta-hatsu": { species: "pork", regions: [{ id: "buta-hatsu" }] },
  "buta-kobukuro": { species: "pork", regions: [{ id: "buta-kobukuro" }] },
  "buta-mame": { species: "pork", regions: [{ id: "buta-mame" }] },
  "buta-reba": { species: "pork", regions: [{ id: "buta-reba" }] },
  "buta-shocho": { species: "pork", regions: [{ id: "buta-shocho" }] },
  gatsu: { species: "pork", regions: [{ id: "gatsu" }] },

  // ---- 鶏（焼き鳥の部位のみ。ご当地焼き鳥5件は対象外） ----
  bonjiri: { species: "chicken", regions: [{ id: "bonjiri" }] },
  furisode: { species: "chicken", regions: [{ id: "furisode" }] },
  hatsumoto: { species: "chicken", regions: [{ id: "hatsumoto" }] },
  "hiza-nankotsu": { species: "chicken", regions: [{ id: "hiza-nankotsu" }] },
  kawa: { species: "chicken", regions: [{ id: "kawa" }] },
  // ねぎま = もも肉+ねぎ。ねぎは部位ではないので「もも」領域だけを塗る
  negima: { species: "chicken", regions: [{ id: "tori-momo" }] },
  reba: { species: "chicken", regions: [{ id: "reba" }] },
  sasami: { species: "chicken", regions: [{ id: "sasami" }] },
  seseri: { species: "chicken", regions: [{ id: "seseri" }] },
  sunagimo: { species: "chicken", regions: [{ id: "sunagimo" }] },
  tebamoto: { species: "chicken", regions: [{ id: "tebamoto" }] },
  tebanaka: { species: "chicken", regions: [{ id: "tebanaka" }] },
  tebasaki: { species: "chicken", regions: [{ id: "tebasaki" }] },
  "tori-hatsu": { species: "chicken", regions: [{ id: "tori-hatsu" }] },
  "tori-momo": { species: "chicken", regions: [{ id: "tori-momo" }] },
  "tori-mune": { species: "chicken", regions: [{ id: "tori-mune" }] },
  // つくね = 挽肉（むね・もも両方が使われうる）なので両領域を淡く塗る
  tsukune: {
    species: "chicken",
    regions: [
      { id: "tori-mune", intensity: "light" },
      { id: "tori-momo", intensity: "light" },
    ],
  },
  "yagen-nankotsu": { species: "chicken", regions: [{ id: "yagen-nankotsu" }] },
};

/** genre セグメントから対象 species を判定する（yakitori はご当地焼き鳥を除く）。 */
export function speciesForGenre(genreSlug: string | null, slug: string): Species | null {
  if (genreSlug === "beef-cuts") return "beef";
  if (genreSlug === "pork-cuts") return "pork";
  if (genreSlug === "yakitori") {
    if ((YAKITORI_EXCLUDED_SLUGS as readonly string[]).includes(slug)) return null;
    return "chicken";
  }
  return null;
}
