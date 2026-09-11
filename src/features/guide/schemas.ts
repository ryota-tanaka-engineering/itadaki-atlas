import { z } from "zod";

import { GUIDE_KINDS } from "./kinds.ts";

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

export const guideLinkSchema = z.object({
  kind: z.enum(["genre", "shelf", "tag"]),
  slug: linkSlugSchema,
});

export const guideSchema = z.object({
  slug: slugSchema,
  kind: guideKindSchema,
  sort_order: z.number().int().default(0),
  status: z.enum(["draft", "published"]).default("draft"),
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
