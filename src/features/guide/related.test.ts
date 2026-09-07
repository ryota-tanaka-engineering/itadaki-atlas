import { describe, expect, it } from "vitest";

import { pickOtherGuides } from "./related";
import type { GuideSummary } from "./types";

const g = (slug: string, kind: GuideSummary["kind"], sortOrder = 0): GuideSummary => ({
  slug,
  kind,
  sortOrder,
  title: slug,
  summary: null,
});

describe("pickOtherGuides", () => {
  it("同じkindの他ガイドを、自分自身を除いて返す", () => {
    const all = [g("a", "ordering"), g("b", "ordering"), g("c", "paying")];
    const { sameKind } = pickOtherGuides(all, "ordering", "a");
    expect(sameKind.map((x) => x.slug)).toEqual(["b"]);
  });

  it("次のkindに1件でもあれば先頭を返す", () => {
    const all = [g("a", "ordering"), g("b", "paying"), g("c", "paying")];
    const { nextKindFirst } = pickOtherGuides(all, "ordering", "a");
    expect(nextKindFirst?.slug).toBe("b");
  });

  it("次のkindが空でも、その次のkindまで一周して探す", () => {
    // paying(空) を飛ばして manners の先頭を拾う
    const all = [g("a", "ordering"), g("m1", "manners")];
    const { nextKindFirst } = pickOtherGuides(all, "ordering", "a");
    expect(nextKindFirst?.slug).toBe("m1");
  });

  it("他に出せるガイドが無ければ null（行き止まりだが機械的に検出できる）", () => {
    const all = [g("a", "ordering")];
    const { sameKind, nextKindFirst } = pickOtherGuides(all, "ordering", "a");
    expect(sameKind).toEqual([]);
    expect(nextKindFirst).toBeNull();
  });

  it("kindの並びを一周して自分のkindに戻ってきたら止まる（無限ループしない）", () => {
    const all = [g("a", "ordering"), g("b", "ordering")];
    const { nextKindFirst } = pickOtherGuides(all, "ordering", "a");
    // 他kindには何も無いので null（bはsameKind側で既に出ている）
    expect(nextKindFirst).toBeNull();
  });
});
