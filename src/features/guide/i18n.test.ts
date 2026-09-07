import { describe, expect, it } from "vitest";

import { pickGuideTranslation } from "./i18n";

describe("pickGuideTranslation", () => {
  it("指定ロケールの翻訳があればそれを返す", () => {
    const rows = [
      { locale: "ja", title: "日本語" },
      { locale: "en", title: "English" },
    ];
    expect(pickGuideTranslation(rows, "en")?.title).toBe("English");
  });

  it("指定ロケールが無ければ en にフォールバックする", () => {
    const rows = [
      { locale: "ja", title: "日本語" },
      { locale: "en", title: "English" },
    ];
    expect(pickGuideTranslation(rows, "zh-Hant" as never)?.title).toBe("English");
  });

  it("en も無ければ ja にフォールバックする", () => {
    const rows = [{ locale: "ja", title: "日本語" }];
    expect(pickGuideTranslation(rows, "en")?.title).toBe("日本語");
  });

  it("どれも無ければ null を返す", () => {
    expect(pickGuideTranslation([], "ja")).toBeNull();
  });
});
