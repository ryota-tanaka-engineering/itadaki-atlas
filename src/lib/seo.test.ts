import { describe, expect, it } from "vitest";

import { absoluteUrl, localeAlternates } from "./seo";

describe("localeAlternates", () => {
  it("ja/en/x-default の hreflang を同じパスで並べる", () => {
    const alt = localeAlternates("/ramen/sapporo") as { languages: Record<string, string>; canonical?: string };
    expect(alt.languages).toEqual({ ja: "/ja/ramen/sapporo", en: "/en/ramen/sapporo", "x-default": "/ja/ramen/sapporo" });
    expect(alt.canonical).toBeUndefined();
  });

  it("ロケールを渡すと自ページの canonical を出す", () => {
    const alt = localeAlternates("/ramen/sapporo", "en") as { canonical: string };
    expect(alt.canonical).toBe("/en/ramen/sapporo");
  });

  it("ルートはロケールだけのパスになる（末尾スラッシュ無し）", () => {
    const alt = localeAlternates("/", "ja") as { canonical: string; languages: Record<string, string> };
    expect(alt.canonical).toBe("/ja");
    expect(alt.languages.en).toBe("/en");
  });
});

describe("absoluteUrl", () => {
  it("SITE_URL + ロケール + パス", () => {
    expect(absoluteUrl("ja", "/guide")).toMatch(/^https?:\/\/.+\/ja\/guide$/);
    expect(absoluteUrl("en", "/")).toMatch(/\/en$/);
  });
});
