import en from "../../messages/en.json";
import ja from "../../messages/ja.json";

/**
 * OGP 画像生成用の辞書の引き方（2026-10-10）。
 *
 * OG 画像ルートは next-intl のサーバー API を使わない（chain/guide の opengraph-image.tsx と同じ方針）ため、
 * 辞書 JSON を直接読む。既存ルートのように小さな表をハードコードすると辞書と二重管理になるので、
 * 県名・場面名はここで辞書から引く。
 */
const dict = { ja, en } as const;
type Loc = keyof typeof dict;

function pick(locale: string): (typeof dict)[Loc] {
  return locale === "en" ? dict.en : dict.ja;
}

/** 都道府県の表示名（en は "Ishikawa" 等）。辞書に無ければ日本語名のまま。 */
export function prefLabel(locale: string, pref: string): string {
  return (pick(locale).prefecture as Record<string, string>)[pref] ?? pref;
}

/** 場面の表示名と一行説明。未知の場面は slug のまま。 */
export function sceneLabel(locale: string, scene: string): { name: string; intro: string | null } {
  const g = pick(locale).guide as { scene: Record<string, string>; sceneIntro?: Record<string, string> };
  return { name: g.scene[scene] ?? scene, intro: g.sceneIntro?.[scene] ?? null };
}

/** OG カードの補助文を、改行と長さで崩れないよう短く切る（satori は自動省略しない）。 */
export function clip(text: string | null | undefined, max: number): string | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
