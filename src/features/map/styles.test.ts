import { describe, expect, it } from "vitest";
import { localizedPlaceNameField, styleColor, PIN_BASE, RAMEN_STYLE_COLORS } from "./styles";

describe("localizedPlaceNameField", () => {
  it("ja では上書きしない（@protomaps/basemaps 既定の get_multiline_name を使う）", () => {
    expect(localizedPlaceNameField("ja")).toBeNull();
  });

  it("en では name:en → name:latin → pgf:name:en → name の順にフォールバックする", () => {
    // 本番レビュー2026-09-24「新潟市/郡山市は日本語のまま、Utsunomiyaは英語」対応。
    // MapLibre の is-supported-script が漢字を「サポート対象」と誤判定し、
    // @protomaps/basemaps 既定ロジックだと name:en へ落ちないケースがあるため、
    // en では自前の coalesce 式に差し替える。
    expect(localizedPlaceNameField("en")).toEqual([
      "coalesce",
      ["get", "name:en"],
      ["get", "name:latin"],
      ["get", "pgf:name:en"],
      ["get", "name"],
    ]);
  });

  it("ja/en以外のロケールでは上書きしない", () => {
    expect(localizedPlaceNameField("fr")).toBeNull();
  });
});

describe("styleColor（既存挙動の回帰確認）", () => {
  it("ラーメンの4系統は専用色を返す", () => {
    expect(styleColor("醤油")).toBe(RAMEN_STYLE_COLORS["醤油"]);
  });

  it("4系統以外・null・undefinedはブランド橙にフォールバックする", () => {
    expect(styleColor("その他")).toBe(PIN_BASE);
    expect(styleColor(null)).toBe(PIN_BASE);
    expect(styleColor(undefined)).toBe(PIN_BASE);
  });
});
