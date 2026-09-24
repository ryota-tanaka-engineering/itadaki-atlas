/**
 * ガイドの「場面」マスタ（`kinds.ts` と同じ流儀のコード定数）。
 *
 * ラベルと一行説明（sceneIntro）は i18n 辞書側に持つ（`messages/ja.json` /
 * `messages/en.json` の `guide.scene.<slug>` / `guide.sceneIntro.<slug>`。
 * `guides.pref` の都道府県名辞書と同じ「マスタはコード・表示名は辞書」の二層方式）。
 *
 * `genres` はその場面でよく出会うジャンルの slug（`data/genres.csv` に実在するもの
 * だけ）。ジャンルページ・料理詳細ページから場面への逆引き、場面ページの
 * 「この場面の食べもの」節に使う。空配列の場面（駅・空港、食べ放題・飲み放題）は
 * その節を出さない。
 */
export const GUIDE_SCENES = [
  { slug: "ramen-shop", genres: ["ramen"] },
  { slug: "soba-udon-shop", genres: ["soba", "udon"] },
  { slug: "sushi-restaurant", genres: ["sushi", "sushi-neta"] },
  { slug: "izakaya", genres: ["yakitori", "nihonshu", "shochu"] },
  { slug: "teishoku-shokudo", genres: ["machi-chuka", "donburi", "fried", "yoshoku"] },
  { slug: "yakiniku-nabe", genres: ["wagyu", "beef-cuts", "pork-cuts", "jidori"] },
  { slug: "tabehodai", genres: [] },
  { slug: "kissa-kanmi", genres: ["wagashi", "nihoncha"] },
  { slug: "konbini-super", genres: ["gohan-no-otomo", "tsukemono", "nerimono"] },
  { slug: "depachika-bussanten", genres: ["wagashi", "tsukemono", "nihonshu"] },
  { slug: "station-airport", genres: [] },
  { slug: "market", genres: ["fish", "shellfish"] },
  { slug: "festival-yatai", genres: ["yakisoba", "konamono"] },
  { slug: "brewery-factory", genres: ["nihonshu", "shochu", "nihoncha"] },
] as const;

export type GuideScene = (typeof GUIDE_SCENES)[number];
export type GuideSceneSlug = GuideScene["slug"];

export const GUIDE_SCENE_SLUGS = GUIDE_SCENES.map((s) => s.slug);

export function isGuideSceneSlug(value: string): value is GuideSceneSlug {
  return (GUIDE_SCENE_SLUGS as readonly string[]).includes(value);
}

export function findGuideScene(slug: string): GuideScene | null {
  return GUIDE_SCENES.find((s) => s.slug === slug) ?? null;
}
