/**
 * タグ語彙のJSONインポート。
 * data/tags.json は tags-proposal.json（悉皆調査の帰納的抽出）から
 * slug/kind/name_ja/name_en/definition/synonyms のみを抜粋したもの。
 * examples/estimated_count等の調査メタはDBに持たない。
 *
 * アイテムへのタグ付け（food_item_tags への投入）はスコープ外。ここでは語彙のみ投入する。
 *
 * 使い方: npx tsx scripts/import-tags.ts --file data/tags.json [--dry-run]
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const rowSchema = z.object({
  slug: z.string().trim().min(1).regex(/^[a-z0-9_-]+$/, "英小文字・数字・ハイフン・アンダースコアのみ"),
  kind: z.enum(["味・特性", "素材", "調理", "形状・食べ方", "場面", "系譜"]),
  name_ja: z.string().trim().min(1),
  name_en: z.string().trim().min(1),
  definition: z.string().trim().min(1),
  synonyms: z.array(z.string()).default([]),
});

async function main() {
  const i = process.argv.indexOf("--file");
  const file = i >= 0 ? process.argv[i + 1] : "data/tags.json";
  const dryRun = process.argv.includes("--dry-run");

  const raw = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(raw)) {
    console.error("data/tags.json はタグの配列である必要があります。");
    process.exit(1);
  }

  const rows: z.infer<typeof rowSchema>[] = [];
  const errors: string[] = [];
  const seenSlugs = new Set<string>();

  raw.forEach((entry, idx) => {
    const r = rowSchema.safeParse(entry);
    if (!r.success) {
      errors.push(`  [${idx}] ${r.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join(", ")}`);
      return;
    }
    if (seenSlugs.has(r.data.slug)) {
      errors.push(`  [${idx}] ファイル内で重複: ${r.data.slug}`);
      return;
    }
    seenSlugs.add(r.data.slug);
    rows.push(r.data);
  });

  console.log(`読み込み: ${raw.length}件 / 検証通過: ${rows.length}件`);
  if (errors.length > 0) {
    console.error(`\nバリデーションエラー ${errors.length}件:`);
    console.error(errors.join("\n"));
    console.error("\n1件でも不正なら投入しない。修正して再実行してください。");
    process.exit(1);
  }

  if (dryRun) {
    console.log("\n--dry-run のため投入しません。");
    for (const r of rows) {
      console.log(`\n  ${r.slug}  [${r.kind}]`);
      console.log(`    ja: ${r.name_ja}`);
      console.log(`    en: ${r.name_en}`);
      console.log(`    def: ${r.definition}`);
      console.log(`    synonyms: ${r.synonyms.join(", ") || "(なし)"}`);
    }
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("環境変数が未設定です");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  let ok = 0;
  for (const r of rows) {
    const { error } = await db.from("tags").upsert(r, { onConflict: "slug" });
    if (error) console.error(`  ✗ ${r.slug}: ${error.message}`);
    else {
      ok++;
      console.log(`  ✓ ${r.slug}`);
    }
  }
  console.log(`\n完了: ${ok}/${rows.length}件を投入しました。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
