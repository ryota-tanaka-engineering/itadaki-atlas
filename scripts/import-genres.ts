/**
 * ジャンルのCSVインポート。1行足すと /[genre] ページ・トップのチップ・sitemap が生える。
 * 使い方: node scripts/import-genres.ts --file data/genres.csv
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const rowSchema = z.object({
  slug: z.string().trim().min(1).regex(/^[a-z0-9-]+$/),
  name_ja: z.string().trim().min(1),
  name_en: z.string().trim().min(1),
  type: z.enum(["dish", "ingredient"]),
  sort_order: z.coerce.number().int(),
  // 棚slug（排他・必須）。genres.shelf_slug に対応
  shelf: z.string().trim().min(1).regex(/^[a-z0-9-]+$/),
});

async function main() {
  const i = process.argv.indexOf("--file");
  const file = i >= 0 ? process.argv[i + 1] : undefined;
  if (!file) {
    console.error("使い方: node scripts/import-genres.ts --file <csv>");
    process.exit(1);
  }
  const [header, ...body] = readFileSync(file, "utf8").trim().split("\n").map((l) => l.split(","));
  const rows: z.infer<typeof rowSchema>[] = [];
  body.forEach((cells, idx) => {
    const obj = Object.fromEntries(header.map((h, j) => [h.trim(), cells[j]?.trim() ?? ""]));
    const r = rowSchema.safeParse(obj);
    if (!r.success) {
      console.error(`L${idx + 2}: ${r.error.issues.map((x) => x.message).join(", ")}`);
      process.exit(1);
    }
    rows.push(r.data);
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("環境変数が未設定です");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  for (const r of rows) {
    const { shelf, ...rest } = r;
    const { error } = await db
      .from("genres")
      .upsert({ ...rest, shelf_slug: shelf }, { onConflict: "slug" });
    if (error) console.error(`  ✗ ${r.slug}: ${error.message}`);
    else console.log(`  ✓ ${r.slug}`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
