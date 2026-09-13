import type { GuideKind } from "./kinds";

/** 一覧・カード表示に必要な最小情報。 */
export type GuideSummary = {
  slug: string;
  kind: GuideKind;
  sortOrder: number;
  title: string;
  summary: string | null;
  /** 場所を持つガイド（PLACE_GUIDE_KINDS）の都道府県・市区町村・時期メモ。無いガイドは null（2026-09-12追加） */
  pref: string | null;
  city: string | null;
  whenNote: string | null;
};

/**
 * guide_links の解決済み表示形（アプリ層で名前・locale・遷移先を解決したもの）。
 * `href` は種別ごとに組み立て方が違う（item は相手自身の genre/shelf 配下）ため、
 * ページ側で kind から都度組み立てず、データ層で確定させて渡す（2026-09-12追加）。
 */
export type GuideLink = {
  kind: "genre" | "shelf" | "tag" | "pref" | "item";
  slug: string;
  name: string;
  href: string;
};

export type GuideDetail = GuideSummary & {
  bodyMd: string | null;
  links: GuideLink[];
  /** 代表地点の座標。両方揃っている場合のみ PositionBand を表示する（2026-09-12追加） */
  lat: number | null;
  lng: number | null;
};
