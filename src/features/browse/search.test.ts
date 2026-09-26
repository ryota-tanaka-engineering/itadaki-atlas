import { describe, expect, it } from "vitest";

import { kanaToRomaji, matchesSearchQuery, normalizeSearchText } from "./search";

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

describe("kanaToRomaji", () => {
  it("単純なひらがなをヘボン式ローマ字に変換する", () => {
    expect(kanaToRomaji("はかた")).toEqual(["hakata"]);
  });

  it("お段＋「う」（長音相当）は無視する/そのまま書く の両方を候補に返す", () => {
    const result = kanaToRomaji("しょうゆ");
    expect(result).toContain("shoyu");
    expect(result).toContain("shouyu");
  });

  it("長音記号「ー」は前の母音を延ばす/無視する の両方を候補に返す", () => {
    const result = kanaToRomaji("らーめん");
    expect(result).toContain("ramen");
    expect(result).toContain("raamen");
  });

  it("カタカナも同じ結果になる（内部でひらがなへ変換）", () => {
    expect(kanaToRomaji("ラーメン")).toEqual(expect.arrayContaining(kanaToRomaji("らーめん")));
  });

  it("促音「っ」は次の子音を重ねる", () => {
    const result = kanaToRomaji("がっこう");
    expect(result).toContain("gakko");
    expect(result).toContain("gakkou");
  });

  it("撥音「ん」は常に n になる", () => {
    expect(kanaToRomaji("ほんや")).toEqual(["honya"]);
  });

  it("かな以外の文字はそのまま素通しする", () => {
    expect(kanaToRomaji("abc")).toEqual(["abc"]);
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

  it("かな入力はヘボン式ローマ字に変換してnameRomaji等にも一致する（読み仮名データを持たない）", () => {
    // 「はかた」はひらがなのままでは漢字表記「博多ラーメン」に一致しないが、
    // ヘボン式ローマ字"hakata"に変換され、nameRomaji "Hakata Ramen" に一致する。
    expect(matchesSearchQuery("はかた", null, "Hakata Ramen")).toBe(true);
    expect(matchesSearchQuery("はかた", "博多ラーメン")).toBe(false);
  });

  it("お段＋「う」・長音記号の候補のどちらでも一致する", () => {
    expect(matchesSearchQuery("しょうゆ", null, "Shoyu Ramen")).toBe(true);
    expect(matchesSearchQuery("らーめん", null, "Sapporo Ramen")).toBe(true);
  });
});
