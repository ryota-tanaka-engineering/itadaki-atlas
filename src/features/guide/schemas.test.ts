import { describe, expect, it } from "vitest";

import { guideLinkSchema, guideSchema } from "./schemas";

/**
 * 2026-09-12「体験と場所」で追加した項目（新kind6種・pref/city/lat/lng・
 * translations.when_note・guide_links の pref/item）のスキーマ検証。
 */
describe("guideSchema", () => {
  const baseTranslations = {
    ja: { title: "見出し" },
  };

  it.each(["food-town", "market", "festival", "beer-garden", "brewery-tour", "factory-tour"] as const)(
    "新kind %s を受け付ける",
    (kind) => {
      const result = guideSchema.safeParse({
        slug: "test-guide",
        kind,
        translations: baseTranslations,
      });
      expect(result.success).toBe(true);
    },
  );

  it("pref/city/lat/lng と translations.when_note を省略できる（読み物系ガイド）", () => {
    const result = guideSchema.safeParse({
      slug: "ticket-machine",
      kind: "ordering",
      translations: baseTranslations,
    });
    expect(result.success).toBe(true);
  });

  it("pref/city/lat/lng と translations.when_note を持てる（場所を持つガイド）", () => {
    const result = guideSchema.safeParse({
      slug: "omicho-market",
      kind: "market",
      pref: "石川県",
      city: "金沢市",
      lat: 36.5701,
      lng: 136.6567,
      translations: {
        ja: { title: "近江町市場", when_note: "通年営業（店舗ごとに定休日あり）" },
      },
    });
    expect(result.success).toBe(true);
  });

  it("都道府県マスタに無い pref は拒否する", () => {
    const result = guideSchema.safeParse({
      slug: "invalid-pref-guide",
      kind: "market",
      pref: "存在しない県",
      translations: baseTranslations,
    });
    expect(result.success).toBe(false);
  });

  it("緯度経度の範囲外は拒否する", () => {
    const result = guideSchema.safeParse({
      slug: "invalid-latlng-guide",
      kind: "market",
      lat: 999,
      lng: 136.6567,
      translations: baseTranslations,
    });
    expect(result.success).toBe(false);
  });
});

describe("guideLinkSchema", () => {
  it("pref kind を受け付ける（都道府県slug）", () => {
    const result = guideLinkSchema.safeParse({ kind: "pref", slug: "ishikawa" });
    expect(result.success).toBe(true);
  });

  it("item kind を受け付ける（food_items.slug）", () => {
    const result = guideLinkSchema.safeParse({ kind: "item", slug: "jibuni" });
    expect(result.success).toBe(true);
  });

  it("未知の kind は拒否する", () => {
    const result = guideLinkSchema.safeParse({ kind: "unknown", slug: "x" });
    expect(result.success).toBe(false);
  });
});
