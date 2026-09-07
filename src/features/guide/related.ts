import { GUIDE_KINDS, type GuideKind } from "./kinds";
import type { GuideSummary } from "./types";

export type OtherGuides = {
  /** 同じ kind の他ガイド（現在ページを除く）。 */
  sameKind: GuideSummary[];
  /**
   * 次の kind の先頭ガイド。kind の並び（GUIDE_KINDS）を現在位置から一周し、
   * 1件以上あるkindの先頭を返す（行き止まり禁止。CLAUDE.md体験原則6）。
   * 全ガイドが同じkind1件しかない等、他に出せるガイドが無ければ null。
   */
  nextKindFirst: GuideSummary | null;
};

/**
 * 詳細ページ「他のガイド」用（純関数。DB非依存でテストできる）。
 * `all` は `/guide` 一覧と同じ並び（kind → sort_order）を渡す想定。
 */
export function pickOtherGuides(
  all: GuideSummary[],
  kind: GuideKind,
  currentSlug: string,
): OtherGuides {
  const sameKind = all.filter((g) => g.kind === kind && g.slug !== currentSlug);

  const startIdx = GUIDE_KINDS.indexOf(kind);
  let nextKindFirst: GuideSummary | null = null;
  for (let i = 1; i <= GUIDE_KINDS.length; i++) {
    const k = GUIDE_KINDS[(startIdx + i) % GUIDE_KINDS.length];
    if (k === kind) break; // 一周した
    const candidates = all.filter((g) => g.kind === k);
    if (candidates.length > 0) {
      nextKindFirst = candidates[0];
      break;
    }
  }

  return { sameKind, nextKindFirst };
}
