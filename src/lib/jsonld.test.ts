import { describe, expect, it } from "vitest";

import {
  articleJsonLd,
  breadcrumbJsonLd,
  foodItemJsonLd,
  itemListJsonLd,
  serializeJsonLd,
  websiteJsonLd,
} from "./jsonld";

const site = { siteUrl: "https://example.test", name: "Itadaki Atlas", description: "desc", locale: "ja" };

describe("websiteJsonLd", () => {
  it("WebSite と Organization を返し、publisher が Organization の @id を指す", () => {
    const [web, org] = websiteJsonLd(site);
    expect(web["@type"]).toBe("WebSite");
    expect(web.url).toBe("https://example.test/ja");
    expect(org["@type"]).toBe("Organization");
    expect((web.publisher as { "@id": string })["@id"]).toBe(org["@id"]);
  });
});

describe("breadcrumbJsonLd", () => {
  it("並び順どおりに position を振る", () => {
    const ld = breadcrumbJsonLd([
      { name: "Itadaki Atlas", url: "https://example.test/ja" },
      { name: "麺", url: "https://example.test/ja/noodles" },
      { name: "ラーメン", url: "https://example.test/ja/ramen" },
    ]);
    const els = ld.itemListElement as { position: number; name: string }[];
    expect(els.map((e) => e.position)).toEqual([1, 2, 3]);
    expect(els[2].name).toBe("ラーメン");
  });
});

describe("foodItemJsonLd", () => {
  const base = {
    url: "https://example.test/ja/ramen/sapporo",
    locale: "ja",
    headline: "札幌ラーメン",
    nameJa: "札幌ラーメン",
    nameRomaji: "Sapporo Ramen",
    nameEn: "miso broth sealed with lard",
    summary: "味噌ダレを炒めた野菜と合わせる。",
    sectionNames: ["麺", "ラーメン"],
    site,
  };

  it("発祥地があれば Place（住所と座標）を contentLocation に置く", () => {
    const ld = foodItemJsonLd({ ...base, origin: { pref: "北海道", city: "札幌市", lat: 43.0618, lng: 141.3545 } });
    expect(ld["@type"]).toBe("Article");
    const place = ld.contentLocation as { name: string; geo: { latitude: number }; address: { addressRegion: string } };
    expect(place.name).toBe("北海道 札幌市");
    expect(place.geo.latitude).toBe(43.0618);
    expect(place.address.addressRegion).toBe("北海道");
    const about = ld.about as { name: string; alternateName: string[] };
    expect(about.name).toBe("札幌ラーメン");
    expect(about.alternateName).toEqual(["Sapporo Ramen", "miso broth sealed with lard"]);
    expect(ld.keywords).toBe("麺, ラーメン");
  });

  it("図鑑枠（発祥地なし）では contentLocation を出さない", () => {
    const ld = foodItemJsonLd({ ...base, origin: null });
    expect(ld.contentLocation).toBeUndefined();
  });

  it("en では日本語名も alternateName に入り、見出しと同じ名は重複させない", () => {
    const ld = foodItemJsonLd({ ...base, locale: "en", headline: "Sapporo Ramen", origin: null });
    const about = ld.about as { alternateName: string[] };
    expect(about.alternateName).toEqual(["miso broth sealed with lard", "札幌ラーメン"]);
  });

  it("座標が無い発祥地は geo を出さない", () => {
    const ld = foodItemJsonLd({ ...base, origin: { pref: "東京都", city: null, lat: null, lng: null } });
    const place = ld.contentLocation as { geo?: unknown; address: { addressLocality?: string } };
    expect(place.geo).toBeUndefined();
    expect(place.address.addressLocality).toBeUndefined();
  });
});

describe("articleJsonLd / itemListJsonLd", () => {
  it("Article は見出し・言語・発行者を持つ", () => {
    const ld = articleJsonLd({ url: "https://example.test/en/guide/x", locale: "en", headline: "H", description: null, section: "manners", site });
    expect(ld.headline).toBe("H");
    expect(ld.description).toBeUndefined();
    expect(ld.articleSection).toBe("manners");
  });

  it("ItemList は件数を全件で持ち、要素は limit で切る", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ name: `n${i}`, url: `https://example.test/ja/x/${i}` }));
    const ld = itemListJsonLd({ url: "https://example.test/ja/x", name: "X", items, limit: 3 });
    expect(ld.numberOfItems).toBe(5);
    expect((ld.itemListElement as unknown[]).length).toBe(3);
  });
});

describe("serializeJsonLd", () => {
  it("< をエスケープして script の早期終了を防ぐ", () => {
    const s = serializeJsonLd({ "@type": "Thing", name: "</script><b>" });
    expect(s).not.toContain("</script>");
    expect(JSON.parse(s).name).toBe("</script><b>");
  });
});
