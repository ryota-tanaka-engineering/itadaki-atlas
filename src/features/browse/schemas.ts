import { z } from "zod";

/**
 * ピン選択カード用の抜粋取得（actions.ts の fetchSelectedItemExcerpt）の入力スキーマ。
 * クライアントから渡る値は境界値として必ず safeParse する
 * （ia-nextjs-standards「外部境界の値はzodでparseしてから使う」）。
 */
export const itemExcerptRequestSchema = z.object({
  slug: z.string().min(1),
  locale: z.enum(["ja", "en"]),
});

export type ItemExcerptRequest = z.infer<typeof itemExcerptRequestSchema>;
