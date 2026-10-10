import { describe, expect, it } from "vitest";

import { canonicalHostRedirect } from "./hostRedirect";

const OLD = "https://itadaki-atlas.itadaki-atlas.workers.dev";

describe("canonicalHostRedirect", () => {
  it("SITE_URL が workers.dev のままなら転送しない（今の本番）", () => {
    expect(canonicalHostRedirect(`${OLD}/ja/ramen/sapporo`, OLD)).toBeNull();
  });

  it("SITE_URL が独自ドメインなら workers.dev の同じパスとクエリを転送する", () => {
    expect(canonicalHostRedirect(`${OLD}/en/ramen/sapporo?x=1`, "https://itadakiatlas.com")).toBe(
      "https://itadakiatlas.com/en/ramen/sapporo?x=1",
    );
    expect(canonicalHostRedirect(`${OLD}/sitemap.xml`, "https://itadakiatlas.com")).toBe("https://itadakiatlas.com/sitemap.xml");
  });

  it("独自ドメインへのリクエスト自身は転送しない", () => {
    expect(canonicalHostRedirect("https://itadakiatlas.com/ja", "https://itadakiatlas.com")).toBeNull();
  });

  it("workers.dev 以外（localhost・プレビュー）は転送しない", () => {
    expect(canonicalHostRedirect("http://localhost:3300/ja", "https://itadakiatlas.com")).toBeNull();
    expect(canonicalHostRedirect("https://preview.example.com/ja", "https://itadakiatlas.com")).toBeNull();
  });

  it("SITE_URL が localhost や http なら本番を飛ばさない", () => {
    expect(canonicalHostRedirect(`${OLD}/ja`, "http://localhost:3300")).toBeNull();
    expect(canonicalHostRedirect(`${OLD}/ja`, "http://itadakiatlas.com")).toBeNull();
  });

  it("壊れた URL は null", () => {
    expect(canonicalHostRedirect("not a url", "https://itadakiatlas.com")).toBeNull();
  });
});
