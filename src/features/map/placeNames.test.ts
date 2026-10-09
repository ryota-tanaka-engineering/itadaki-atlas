import { describe, expect, it } from "vitest";

import { disambiguateSameNameEn } from "./placeNames";

describe("disambiguateSameNameEn（県名と市名が同綴りの英語表記）", () => {
  it("福岡県福岡市は City を付けて区別する", () => {
    expect(disambiguateSameNameEn("Fukuoka", "福岡市", "Fukuoka")).toBe("Fukuoka City, Fukuoka");
  });
  it("京都府京都市も同様", () => {
    expect(disambiguateSameNameEn("Kyoto", "京都市", "Kyoto")).toBe("Kyoto City, Kyoto");
  });
  it("市以外で同綴りなら重複を1つにする", () => {
    expect(disambiguateSameNameEn("Tokyo", "東京", "Tokyo")).toBe("Tokyo");
  });
  it("同綴りでなければ null（呼び出し側が通常の連結にする）", () => {
    expect(disambiguateSameNameEn("Kanagawa", "横浜市", "Yokohama")).toBeNull();
  });
});
