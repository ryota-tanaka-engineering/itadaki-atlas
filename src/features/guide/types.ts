import type { GuideKind } from "./kinds";

/** 一覧・カード表示に必要な最小情報。 */
export type GuideSummary = {
  slug: string;
  kind: GuideKind;
  sortOrder: number;
  title: string;
  summary: string | null;
};

/** guide_links の解決済み表示形（アプリ層で名前・localeを解決したもの）。 */
export type GuideLink = {
  kind: "genre" | "shelf" | "tag";
  slug: string;
  name: string;
};

export type GuideDetail = GuideSummary & {
  bodyMd: string | null;
  links: GuideLink[];
};
