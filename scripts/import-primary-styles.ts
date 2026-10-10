/**
 * 既存アイテムの系統（dish_details.primary_style）だけを付ける・付け替える（2026-10-10、寿司の系統付与）。
 *
 * 系統はジャンルページの見出しの単位。系統ごとの一文と並び順は data/genre-styles.json
 * （import-genre-styles.ts）が持ち、ここはアイテム→系統の対応だけを持つ。
 * dish_details の他の列（麺・濃さ等）は触らない。
 *
 * 形式（data/styles/<genre>.json）:
 *   { "genre": "sushi", "items": [{ "slug": "nigiri-zushi", "style": "握り" }] }
 *
 * 使い方: node --env-file=.env.local scripts/import-primary-styles.ts --file data/styles/sushi.json [--dry-run]
 *   本番: bash scripts/prod-env.sh node scripts/import-primary-styles.ts --file data/styles/sushi.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const styleFileSchema = z
  .object({
    genre: z.string().trim().regex(/^[a-z0-9-]+$/),
    // DB の CHECK（20260912100000_primary_style_free_text.sql）と同じ 1〜20字
    items: z.array(z.object({ slug: z.string().trim().min(1), style: z.string().trim().min(1).max(20) })).min(1),
  })
  .superRefine((f, ctx) => {
    const seen = new Set<string>();
    f.items.forEach((it, i) => {
      if (seen.has(it.slug)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `slug が重複: ${it.slug}`, path: ["items", i] });
      seen.add(it.slug);
    });
  });

export type StyleFile = z.infer<typeof styleFileSchema>;

/** 系統ごとの件数（dry-run の表示と、genre-styles.json との突き合わせ用）。出現順。 */
export function countByStyle(file: StyleFile): [string, number][] {
  const m = new Map<string, number>();
  for (const it of file.items) m.set(it.style, (m.get(it.style) ?? 0) + 1);
  return [...m];
}

/** genre-styles.json にそのジャンルの一文が無い系統（見出しだけになる系統）を返す。 */
export function stylesWithoutIntro(file: StyleFile, genreStyles: { genre: string; style: string }[]): string[] {
  const have = new Set(genreStyles.filter((g) => g.genre === file.genre).map((g) => g.style));
  return countByStyle(file)
    .map(([s]) => s)
    .filter((s) => !have.has(s));
}

async function main() {
  const i = process.argv.indexOf("--file");
  if (i < 0) {
    console.error("使い方: node scripts/import-primary-styles.ts --file data/styles/<genre>.json [--dry-run]");
    process.exit(1);
  }
  const file = process.argv[i + 1];
  const dryRun = process.argv.includes("--dry-run");
  const parsed = styleFileSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) {
    console.error(parsed.error.issues.map((x) => `[${x.path.join(".")}] ${x.message}`).join("\n"));
    process.exit(1);
  }
  const f = parsed.data;
  console.log(`読み込み: ${f.genre} ${f.items.length}件 / ${countByStyle(f).map(([s, n]) => `${s} ${n}`).join("・")}`);
  const noIntro = stylesWithoutIntro(f, JSON.parse(readFileSync("data/genre-styles.json", "utf8")));
  if (noIntro.length) console.warn(`  注意: data/genre-styles.json に一文が無い系統: ${noIntro.join("・")}`);
  if (dryRun) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("環境変数が未設定です");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  // 対象はそのジャンルのアイテムだけ（別ジャンルの同名 slug を誤って書き換えない）
  const { data: g, error: ge } = await db.from("genres").select("id").eq("slug", f.genre).single();
  if (ge || !g) throw new Error(`ジャンルが見つかりません: ${f.genre}`);
  const slugs = f.items.map((x) => x.slug);
  const { data: found, error } = await db.from("food_items").select("id, slug").eq("genre_id", g.id).in("slug", slugs);
  if (error) throw new Error(error.message);
  const idOf = new Map((found ?? []).map((x) => [x.slug, x.id as string]));
  const missing = slugs.filter((s) => !idOf.has(s));
  if (missing.length) {
    console.error(`このジャンルに無い slug: ${missing.join(", ")}`);
    process.exit(1);
  }

  // food_item_id 主キーの upsert。送るのは primary_style だけなので他の列は保たれる
  const rows = f.items.map((it) => ({ food_item_id: idOf.get(it.slug)!, primary_style: it.style }));
  const { error: ue } = await db.from("dish_details").upsert(rows, { onConflict: "food_item_id" });
  if (ue) {
    console.error(ue.message);
    process.exit(1);
  }
  console.log(`完了: ${rows.length}件`);
}

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href : false;
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
