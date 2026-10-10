// @vitest-environment node
import { describe, expect, it } from "vitest";

import { bannedWordHits, buildIntroFile, internalLinks, prefIntroFileSchema } from "./import-prefecture-intros.ts";

const src = [{ title: "うちの郷土料理（石川県）", url: "https://www.maff.go.jp/x", publisher: "農林水産省", accessed_at: "2026-10-10" }];

function row(over: Record<string, unknown> = {}) {
  return { pref: "石川県", translations: { ja: { intro: "海と城下町の食。" }, en: { intro: "Sea and castle town." } }, sources: src, ...over };
}

describe("prefIntroFileSchema", () => {
  it("最小構成が通る", () => {
    expect(prefIntroFileSchema.safeParse([row()]).success).toBe(true);
  });

  it("都道府県名マスタに無い名前は弾く", () => {
    expect(prefIntroFileSchema.safeParse([row({ pref: "石川" })]).success).toBe(false);
  });

  it("同じ県が2回あれば弾く", () => {
    expect(prefIntroFileSchema.safeParse([row(), row()]).success).toBe(false);
  });

  it("出典が無ければ弾く", () => {
    expect(prefIntroFileSchema.safeParse([row({ sources: [] })]).success).toBe(false);
  });

  it("読み物は ja と en の両方に要る", () => {
    const r = row({ translations: { ja: { intro: "a", body_md: "## 海\n本文" }, en: { intro: "b" } } });
    expect(prefIntroFileSchema.safeParse([r]).success).toBe(false);
  });
});

describe("bannedWordHits / internalLinks", () => {
  it("使わない語を拾う", () => {
    const rows = prefIntroFileSchema.parse([row({ translations: { ja: { intro: "日本三大の人気の味。" }, en: { intro: "x" } } })]);
    expect(bannedWordHits(rows)).toEqual(["石川県: 人気・三大"]);
  });

  it("読み物の内部リンクのパスを集める（外部 URL は除く）", () => {
    const rows = prefIntroFileSchema.parse([
      row({
        translations: {
          ja: { intro: "a", body_md: "## 海\n[かぶら寿し](/sushi/kaburazushi)と[外](https://x.example)" },
          en: { intro: "b", body_md: "## Sea\n[Kabura-zushi](/sushi/kaburazushi)" },
        },
      }),
    ]);
    expect(internalLinks(rows)).toEqual(["/sushi/kaburazushi"]);
  });
});

describe("buildIntroFile", () => {
  it("部隊の intros と essays を県ごとに合流し、北から南へ並べる", () => {
    const out = buildIntroFile([
      { intros: [{ pref: "石川県", intro_ja: "石川", intro_en: "Ishikawa", sources: src }] },
      { intros: [{ pref: "北海道", intro_ja: "北海道", intro_en: "Hokkaido", sources: src }] },
      { essays: [{ pref: "石川県", body_ja: "## 海\n本文", body_en: "## Sea\nBody" }] },
    ]);
    expect(out.map((r) => r.pref)).toEqual(["北海道", "石川県"]);
    expect(out[1].translations.ja.body_md).toBe("## 海\n本文");
    expect(prefIntroFileSchema.safeParse(out).success).toBe(true);
  });

  it("一行の無い県の地の文はエラー", () => {
    expect(() => buildIntroFile([{ essays: [{ pref: "石川県", body_ja: "a", body_en: "b" }] }])).toThrow();
  });
});
