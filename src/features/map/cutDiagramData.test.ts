import { describe, expect, it } from "vitest";

import {
  BEEF_REGION_IDS,
  CHICKEN_REGION_IDS,
  PORK_REGION_IDS,
} from "./CutDiagram";
import { CUT_DIAGRAM_DATA, speciesForGenre, YAKITORI_EXCLUDED_SLUGS } from "./cutDiagramData";

/**
 * 対象ジャンルの全slug（作業パッケージ「詳細ページ概念図」§1の一覧）。
 * このテストは「全slugが対応表に存在するか」「対応表の領域idがSVG側に実在するか」
 * の2点を担保する。
 */
const BEEF_SLUGS = [
  // 正肉
  "beef-neck",
  "beef-shank",
  "beef-short-rib",
  "beef-tenderloin",
  "bottom-flap",
  "chuck-flap",
  "chuck-roll",
  "gyu-kata",
  "harami",
  "sagari",
  "hoho-niku",
  "knuckle",
  "oxtail",
  "rib-roast",
  "rump",
  "sirloin",
  "top-blade",
  "top-sirloin-cap",
  "tri-tip",
  "gyutan",
  // 内臓
  "giara",
  "gyu-hatsu",
  "gyu-kobukuro",
  "gyu-mame",
  "gyu-reba",
  "hachinosu",
  "marucho",
  "mino",
  "senmai",
  "shimacho",
];

const PORK_SLUGS = [
  // 正肉
  "kashira",
  "mimiga",
  "pork-belly",
  "pork-leg",
  "pork-loin",
  "pork-outside-round",
  "pork-shoulder",
  "pork-shoulder-loin",
  "pork-tenderloin",
  "spare-rib",
  "tonsoku",
  "tontoro",
  "buta-tan",
  // 内臓
  "buta-daicho",
  "buta-hatsu",
  "buta-kobukuro",
  "buta-mame",
  "buta-reba",
  "buta-shocho",
  "gatsu",
];

const CHICKEN_SLUGS = [
  "bonjiri",
  "furisode",
  "hatsumoto",
  "hiza-nankotsu",
  "kawa",
  "negima",
  "reba",
  "sasami",
  "seseri",
  "sunagimo",
  "tebamoto",
  "tebanaka",
  "tebasaki",
  "tori-hatsu",
  "tori-momo",
  "tori-mune",
  "tsukune",
  "yagen-nankotsu",
];

describe("CUT_DIAGRAM_DATA 全slugの網羅", () => {
  it.each(BEEF_SLUGS)("牛の部位slug %s が対応表に存在する", (slug) => {
    expect(CUT_DIAGRAM_DATA[slug]).toBeDefined();
    expect(CUT_DIAGRAM_DATA[slug]?.species).toBe("beef");
  });

  it.each(PORK_SLUGS)("豚の部位slug %s が対応表に存在する", (slug) => {
    expect(CUT_DIAGRAM_DATA[slug]).toBeDefined();
    expect(CUT_DIAGRAM_DATA[slug]?.species).toBe("pork");
  });

  it.each(CHICKEN_SLUGS)("鶏の部位slug %s が対応表に存在する", (slug) => {
    expect(CUT_DIAGRAM_DATA[slug]).toBeDefined();
    expect(CUT_DIAGRAM_DATA[slug]?.species).toBe("chicken");
  });

  it("ご当地焼き鳥5件は対応表に存在しない（部位ではなく料理そのものの名前のため）", () => {
    for (const slug of YAKITORI_EXCLUDED_SLUGS) {
      expect(CUT_DIAGRAM_DATA[slug]).toBeUndefined();
    }
  });
});

describe("CUT_DIAGRAM_DATA の領域idがSVG側に実在する", () => {
  const idsBySpecies = {
    beef: new Set(BEEF_REGION_IDS),
    pork: new Set(PORK_REGION_IDS),
    chicken: new Set(CHICKEN_REGION_IDS),
  };

  for (const [slug, entry] of Object.entries(CUT_DIAGRAM_DATA)) {
    it(`${slug} の領域idはすべて ${entry.species} のSVGに実在する`, () => {
      const known = idsBySpecies[entry.species];
      for (const region of entry.regions) {
        expect(known.has(region.id)).toBe(true);
      }
    });
  }
});

describe("speciesForGenre", () => {
  it("beef-cuts / pork-cuts はそのままの種で対象になる", () => {
    expect(speciesForGenre("beef-cuts", "sirloin")).toBe("beef");
    expect(speciesForGenre("pork-cuts", "gatsu")).toBe("pork");
  });

  it("yakitori は鶏の部位のみ対象（ご当地焼き鳥5件は除外）", () => {
    expect(speciesForGenre("yakitori", "tsukune")).toBe("chicken");
    for (const slug of YAKITORI_EXCLUDED_SLUGS) {
      expect(speciesForGenre("yakitori", slug)).toBeNull();
    }
  });

  it("対象外ジャンルは null", () => {
    expect(speciesForGenre("ramen", "shoyu")).toBeNull();
    expect(speciesForGenre(null, "something")).toBeNull();
  });
});
