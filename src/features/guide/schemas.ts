import { z } from "zod";

import { GUIDE_KINDS } from "./kinds.ts";
import { PREFECTURES } from "../../lib/prefectures.ts";

/**
 * `data/guides.json` → `scripts/import-guides.ts` の入力検証スキーマ。
 * DB側（migration）と同じ制約をアプリ境界でも zod で二重に守る（ia-nextjs-standards §7）。
 */
export const guideKindSchema = z.enum(GUIDE_KINDS);

const slugSchema = z
  .string()
  .trim()
  .min(1, "必須")
  .regex(/^[a-z0-9-]+$/, "英小文字・数字・ハイフンのみ");

// guide_translations.locale の check 制約と同じ並び（多言語追加時に増やす）
const localeSchema = z.enum(["ja", "en", "zh-Hant", "ko"]);

export const guideTranslationSchema = z.object({
  title: z.string().trim().min(1, "必須"),
  summary: z.string().trim().min(1).optional(),
  body_md: z.string().trim().min(1).optional(),
  // 開催・営業時期のメモ（多言語。2026-09-12追加）。具体的な日取りは書かない
  // 文体規約（ia-atlas-content Skill §2・CLAUDE.md体験原則3）はスキーマでは強制できないため、
  // 投入前レビューで担保する
  when_note: z.string().trim().min(1).optional(),
});

export const guideSourceSchema = z.object({
  title: z.string().trim().min(1, "必須"),
  url: z.string().trim().min(1).optional(),
  publisher: z.string().trim().min(1).optional(),
  accessed_at: z.string().trim().min(1).optional(),
});

// タグの slug はアンダースコアを含む（例 souvenir_non_confection）ので、link 側だけ緩める
const linkSlugSchema = z
  .string()
  .trim()
  .min(1, "必須")
  .regex(/^[a-z0-9_-]+$/, "英小文字・数字・ハイフン・アンダースコアのみ");

// pref/item は2026-09-12「体験と場所」で追加。pref は src/lib/prefectures.ts の
// PREF_SLUGS の値（都道府県マスタにDBテーブルが無いため、存在検証は import 側で
// PREF_SLUGS 集合との突合で行う）。item は food_items.slug（既存 genre/shelf/tag と
// 同じくDBに存在検証を委ねる）
export const guideLinkSchema = z.object({
  kind: z.enum(["genre", "shelf", "tag", "pref", "item"]),
  slug: linkSlugSchema,
});

// 緯度経度の妥当範囲（日本国内の代表地点を想定した緩いガード。厳密な国内判定はしない）
const latSchema = z.number().min(-90).max(90);
const lngSchema = z.number().min(-180).max(180);

// guides.pref は food_items.origin_pref と同じ規約（都道府県マスタの日本語名。
// import-content.ts の prefField と同じ検証）。region/[pref] ページの `tp(pref)` 表示・
// `PREF_SLUGS[pref]` によるURL組み立てをそのまま使い回すため
const prefNameSchema = z.string().trim().refine((v) => (PREFECTURES as readonly string[]).includes(v), {
  message: "都道府県名マスタに一致しません",
});

export const guideSchema = z.object({
  slug: slugSchema,
  kind: guideKindSchema,
  sort_order: z.number().int().default(0),
  status: z.enum(["draft", "published"]).default("draft"),
  // 場所を持つガイド（PLACE_GUIDE_KINDS）向けの任意項目。2026-09-12追加。
  // 読み物系ガイド（ordering等）はいずれも省略してよい
  pref: prefNameSchema.optional(),
  city: z.string().trim().min(1).optional(),
  lat: latSchema.optional(),
  lng: lngSchema.optional(),
  // z.record は enum キーの全件必須になるため partialRecord を使う（任意の言語部分集合を許す）
  translations: z.partialRecord(localeSchema, guideTranslationSchema).refine(
    (translations) => Object.keys(translations).length > 0,
    { message: "少なくとも1言語の翻訳が必要" },
  ),
  sources: z.array(guideSourceSchema).default([]),
  links: z.array(guideLinkSchema).default([]),
});

export const guidesFileSchema = z.object({ guides: z.array(guideSchema) });

export type GuideImportRow = z.infer<typeof guideSchema>;
