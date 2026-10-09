import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";

/**
 * /en に日本語の系統名が出ないことの機械検出（体験検品 2026-10-09）。
 * 系統（primary_style）は自由値のため、データ側に新しい値が入ると辞書の足し漏れが起きる。
 * DB の値は単体テストから使えないので、投入元の data/content/*.json を集める。
 */
const CONTENT_DIR = join(process.cwd(), "data", "content");

function collectContentStyles(): string[] {
  const styles = new Set<string>();
  for (const file of readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".json"))) {
    const bundle = JSON.parse(readFileSync(join(CONTENT_DIR, file), "utf-8")) as {
      items?: { primary_style?: string | null }[];
    };
    for (const item of bundle.items ?? []) {
      if (item.primary_style) styles.add(item.primary_style);
    }
  }
  return [...styles];
}

/** 魚介（魚・貝類ジャンル）の系統。data/content の束ではなく別経路で投入されたため、ローカルDB（2026-10-09）から列挙して固定。 */
const FISH_STYLES = ["赤身", "青魚", "白身", "川魚", "エビ・カニ", "貝", "イカ・タコ"];

const hasCjk = (s: string) => /[぀-ヿ㐀-鿿]/.test(s);

describe("styleNames（/en の系統名辞書）", () => {
  const styleNames = en.styleNames as Record<string, string>;
  const style = en.style as Record<string, string>;
  const all = [...new Set([...collectContentStyles(), ...FISH_STYLES])];

  it("データに現れる系統が1件以上読めている（読み込み失敗で空振りしない）", () => {
    expect(collectContentStyles().length).toBeGreaterThan(10);
  });

  it.each(all)("系統「%s」に英語名がある（styleNames か style）", (v) => {
    const label = styleNames[v] ?? style[v] ?? (v === "その他" ? en.styleOther.generic : undefined);
    expect(label, `${v} の英語名が messages/en.json に無い`).toBeTruthy();
    expect(hasCjk(label as string), `${v} の英語名に日本語が残っている`).toBe(false);
  });

  it("「その他」は ja/en とも分類名の「その他」「Other」を出さない", () => {
    expect(ja.style["その他"]).not.toContain("その他");
    expect(en.style["その他"]).not.toMatch(/^Other$/);
  });
});
