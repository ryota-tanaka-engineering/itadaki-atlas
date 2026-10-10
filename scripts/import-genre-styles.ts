/**
 * ジャンルの系統ごとの一文（genre_styles）の JSON インポート（2026-10-10）。
 *
 * data/genre-styles.json: [{ "genre": "ramen", "style": "醤油", "intro_ja": "…", "intro_en": "…" }]
 * (genre_slug, style, locale) で upsert する。style は dish_details.primary_style の日本語の値そのもの。
 *
 * 使い方: node --env-file=.env.local scripts/import-genre-styles.ts --file data/genre-styles.json [--dry-run]
 *   本番: bash scripts/prod-env.sh node scripts/import-genre-styles.ts --file data/genre-styles.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const BANNED_WORDS = ["有名", "人気", "一番", "三大", "No.1", "ご当地", "宝庫", "王国"];

export const genreStyleSchema = z.object({
  genre: z.string().trim().regex(/^[a-z0-9-]+$/),
  style: z.string().trim().min(1).max(20),
  intro_ja: z.string().trim().min(1).max(400),
  intro_en: z.string().trim().min(1).max(400),
});

export const genreStyleFileSchema = z.array(genreStyleSchema).superRefine((rows, ctx) => {
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const k = `${r.genre}::${r.style}`;
    if (seen.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `重複: ${k}`, path: [i] });
    seen.add(k);
  });
});

export type GenreStyleRow = z.infer<typeof genreStyleSchema>;

/** DB の行（ロケールごと）に展開する。 */
export function toDbRows(rows: GenreStyleRow[]) {
  return rows.flatMap((r) => [
    { genre_slug: r.genre, style: r.style, locale: "ja", intro: r.intro_ja },
    { genre_slug: r.genre, style: r.style, locale: "en", intro: r.intro_en },
  ]);
}

async function main() {
  const i = process.argv.indexOf("--file");
  const file = i >= 0 ? process.argv[i + 1] : "data/genre-styles.json";
  const dryRun = process.argv.includes("--dry-run");
  const parsed = genreStyleFileSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) {
    console.error(parsed.error.issues.map((x) => `[${x.path.join(".")}] ${x.message}`).join("\n"));
    process.exit(1);
  }
  const rows = parsed.data;
  const banned = rows.filter((r) => BANNED_WORDS.some((w) => r.intro_ja.includes(w)));
  if (banned.length) {
    console.error(`使わない語: ${banned.map((r) => `${r.genre}/${r.style}`).join(", ")}`);
    process.exit(1);
  }
  console.log(`読み込み: ${rows.length}系統（${new Set(rows.map((r) => r.genre)).size}ジャンル）`);
  if (dryRun) {
    for (const r of rows) console.log(`  ${r.genre}/${r.style}: ${r.intro_ja}`);
    return;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("環境変数が未設定です");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await db.from("genre_styles").upsert(toDbRows(rows), { onConflict: "genre_slug,style,locale" });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  console.log(`完了: ${rows.length}系統`);
}

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href : false;
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
