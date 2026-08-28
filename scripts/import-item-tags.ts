/**
 * アイテムへのタグ付け（food_item_tags）のCSVインポート。
 *
 * data/item-tags.csv は item_slug,tag_slug の2列（ia-atlas-content Skill §6 と同じ
 * CSVインポートの流儀）。タグ語彙自体（tags テーブル）は scripts/import-tags.ts が別途
 * 投入済みであることが前提（本スクリプトは付与のみ行う）。
 *
 * 冪等: food_item_tags の主キーは (food_item_id, tag_slug) なので upsert で安全に
 * 再実行できる（同じ行は何度投入しても増えない）。
 *
 * 使い方: npx tsx scripts/import-item-tags.ts --file data/item-tags.csv [--dry-run]
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const rowSchema = z.object({
  item_slug: z.string().trim().min(1),
  tag_slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9_-]+$/, "英小文字・数字・ハイフン・アンダースコアのみ"),
});

async function main() {
  const i = process.argv.indexOf("--file");
  const file = i >= 0 ? process.argv[i + 1] : "data/item-tags.csv";
  const dryRun = process.argv.includes("--dry-run");

  const [header, ...body] = readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((l) => l.split(","));

  const rows: z.infer<typeof rowSchema>[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  body.forEach((cells, idx) => {
    const obj = Object.fromEntries(header.map((h, j) => [h.trim(), cells[j]?.trim() ?? ""]));
    const r = rowSchema.safeParse(obj);
    if (!r.success) {
      errors.push(`  L${idx + 2}: ${r.error.issues.map((x) => `[${x.path}] ${x.message}`).join(", ")}`);
      return;
    }
    const key = `${r.data.item_slug}:${r.data.tag_slug}`;
    if (seen.has(key)) {
      errors.push(`  L${idx + 2}: ファイル内で重複: ${key}`);
      return;
    }
    seen.add(key);
    rows.push(r.data);
  });

  console.log(`読み込み: ${body.length}行 / 検証通過: ${rows.length}件`);
  if (errors.length > 0) {
    console.error(`\nバリデーションエラー ${errors.length}件:`);
    console.error(errors.join("\n"));
    console.error("\n1件でも不正なら投入しない。修正して再実行してください。");
    process.exit(1);
  }

  if (dryRun) {
    console.log("\n--dry-run のため投入しません。");
    for (const r of rows) console.log(`  ${r.item_slug} ←[tag]─ ${r.tag_slug}`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("環境変数が未設定です");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const itemSlugs = [...new Set(rows.map((r) => r.item_slug))];
  const tagSlugs = [...new Set(rows.map((r) => r.tag_slug))];

  const [{ data: items, error: itemsErr }, { data: tags, error: tagsErr }] = await Promise.all([
    db.from("food_items").select("id, slug").in("slug", itemSlugs),
    db.from("tags").select("slug").in("slug", tagSlugs),
  ]);
  if (itemsErr) throw new Error(itemsErr.message);
  if (tagsErr) throw new Error(tagsErr.message);

  const idOf = new Map((items ?? []).map((x) => [x.slug, x.id]));
  const validTagSlugs = new Set((tags ?? []).map((x) => x.slug));

  const missingItems = itemSlugs.filter((s) => !idOf.has(s));
  const missingTags = tagSlugs.filter((s) => !validTagSlugs.has(s));
  if (missingItems.length > 0 || missingTags.length > 0) {
    if (missingItems.length > 0) console.error(`存在しない item_slug: ${missingItems.join(", ")}`);
    if (missingTags.length > 0) console.error(`存在しない tag_slug: ${missingTags.join(", ")}`);
    process.exit(1);
  }

  const payload = rows.map((r) => ({
    food_item_id: idOf.get(r.item_slug)!,
    tag_slug: r.tag_slug,
  }));

  const { error } = await db
    .from("food_item_tags")
    .upsert(payload, { onConflict: "food_item_id,tag_slug" });
  if (error) {
    console.error(`投入に失敗しました: ${error.message}`);
    process.exit(1);
  }

  console.log(`\n完了: ${payload.length}件を投入しました。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
