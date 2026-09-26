import { describe, expect, it } from "vitest";

import { matchesSearchQuery, normalizeSearchText } from "./search";

describe("normalizeSearchText", () => {
  it("全角スペース・半角スペースを除去する", () => {
    expect(normalizeSearchText("博多 ラーメン")).toBe(normalizeSearchText("博多ラーメン"));
    expect(normalizeSearchText("博多　ラーメン")).toBe(normalizeSearchText("博多ラーメン"));
  });

  it("大文字小文字を無視する", () => {
    expect(normalizeSearchText("Ramen")).toBe(normalizeSearchText("ramen"));
  });

  it("全角英数字をNFKCで半角に揃える", () => {
    expect(normalizeSearchText("ｒａｍｅｎ")).toBe(normalizeSearchText("ramen"));
  });

  it("カタカナをひらがなへ揃える", () => {
    expect(normalizeSearchText("ラーメン")).toBe(normalizeSearchText("らーめん"));
  });

  it("半角カタカナもNFKC正規化後にひらがなへ揃う", () => {
    expect(normalizeSearchText("ラーメン")).toBe(normalizeSearchText("ﾗｰﾒﾝ"));
  });
});

describe("matchesSearchQuery", () => {
  it("空クエリは常に一致する", () => {
    expect(matchesSearchQuery("", "博多ラーメン")).toBe(true);
    expect(matchesSearchQuery("   ", "博多ラーメン")).toBe(true);
  });

  it("部分一致する", () => {
    expect(matchesSearchQuery("多ラー", "博多ラーメン", null, "Hakata Ramen")).toBe(true);
    expect(matchesSearchQuery("ramen", "博多ラーメン", null, "Hakata Ramen")).toBe(true);
  });

  it("ひらがな⇄カタカナが相互に一致する", () => {
    expect(matchesSearchQuery("らーめん", "博多ラーメン")).toBe(true);
    expect(matchesSearchQuery("ラーメン", "博多らーめん")).toBe(true);
  });

  it("大文字小文字・全角半角スペースを無視して一致する", () => {
    expect(matchesSearchQuery("RAMEN", null, "Hakata Ramen")).toBe(true);
    expect(matchesSearchQuery("博多 ラーメン", "博多ラーメン")).toBe(true);
  });

  it("土地（県名・市名）にも一致する", () => {
    expect(matchesSearchQuery("福島", "喜多方ラーメン", null, "Kitakata Ramen", "福島県", "喜多方市")).toBe(
      true,
    );
  });

  it("どの対象にも一致しなければ false", () => {
    expect(matchesSearchQuery("存在しない語", "博多ラーメン", null, "Hakata Ramen")).toBe(false);
  });

  it("null/undefined の対象は無視して他の対象と比較する", () => {
    expect(matchesSearchQuery("博多", null, undefined, "博多ラーメン")).toBe(true);
  });
});
