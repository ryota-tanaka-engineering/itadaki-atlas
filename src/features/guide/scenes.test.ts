import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseCsv } from "../../../scripts/import-content.ts";
import enMessages from "../../../messages/en.json";
import jaMessages from "../../../messages/ja.json";

import { GUIDE_SCENES } from "./scenes";

/**
 * 場面マスタ（GUIDE_SCENES）の整合性検証:
 * - 全 slug に ja/en の guide.scene / guide.sceneIntro キーがある
 * - genres の slug が data/genres.csv に実在する
 */
describe("GUIDE_SCENES", () => {
  const genreSlugs = (() => {
    const csvPath = join(process.cwd(), "data/genres.csv");
    const [header, ...rows] = parseCsv(readFileSync(csvPath, "utf8"));
    const slugIdx = header.indexOf("slug");
    return new Set(rows.filter((r) => r.length > 1).map((r) => r[slugIdx]));
  })();

  const jaScene = (jaMessages.guide as Record<string, unknown>).scene as Record<string, string>;
  const enScene = (enMessages.guide as Record<string, unknown>).scene as Record<string, string>;
  const jaSceneIntro = (jaMessages.guide as Record<string, unknown>).sceneIntro as Record<string, string>;
  const enSceneIntro = (enMessages.guide as Record<string, unknown>).sceneIntro as Record<string, string>;

  it.each(GUIDE_SCENES)("$slug: ja/en の scene ラベルを持つ", ({ slug }) => {
    expect(jaScene?.[slug], `ja scene.${slug}`).toBeTruthy();
    expect(enScene?.[slug], `en scene.${slug}`).toBeTruthy();
  });

  it.each(GUIDE_SCENES)("$slug: ja/en の sceneIntro を持つ", ({ slug }) => {
    expect(jaSceneIntro?.[slug], `ja sceneIntro.${slug}`).toBeTruthy();
    expect(enSceneIntro?.[slug], `en sceneIntro.${slug}`).toBeTruthy();
  });

  it.each(GUIDE_SCENES)("$slug: genres が genres.csv に実在する", ({ genres }) => {
    for (const genreSlug of genres) {
      expect(genreSlugs.has(genreSlug), `genres.csv に ${genreSlug} が無い`).toBe(true);
    }
  });

  it("slug の重複が無い", () => {
    const slugs = GUIDE_SCENES.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
