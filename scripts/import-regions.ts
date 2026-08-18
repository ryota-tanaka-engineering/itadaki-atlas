/**
 * アイテムの地域リレーション（名産地・主要提供圏）のCSVインポート。
 *
 * 1行足すと、その県の地域ページにアイテムが合流する（.doc/20_data/01_models.md §3.6）。
 * 発祥地を1つに決められないアイテム（ネタ・食材）が、複数の土地と結びつくための仕組み。
 *
 * 使い方: node scripts/import-regions.ts --file data/sushi-regions.csv [--dry-run]
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { PREFECTURES } from "../src/lib/prefectures.ts";

const rowSchema = z.object({
  item_slug: z.string().trim().min(1),
  pref: z.string().trim().refine((v) => (PREFECTURES as readonly string[]).includes(v), {
    message: "都道府県名マスタに一致しません",
  }),
  city: z.string().trim().optional(),
  lat: z.coerce.number().min(20).max(46),
  lng: z.coerce.number().min(122).max(154),
  relation_type: z.enum(["発祥", "名産地", "主要提供圏"]),
});

async function main() {
  const i = process.argv.indexOf("--file");
  const file = i >= 0 ? process.argv[i + 1] : undefined;
  const dryRun = process.argv.includes("--dry-run");
  if (!file) {
    console.error("使い方: node scripts/import-regions.ts --file <csv> [--dry-run]");
    process.exit(1);
  }
  const [header, ...body] = readFileSync(file, "utf8").trim().split("\n").map((l) => l.split(","));
  const rows: z.infer<typeof rowSchema>[] = [];
  body.forEach((cells, idx) => {
    const obj = Object.fromEntries(header.map((h, j) => [h.trim(), cells[j]?.trim() ?? ""]));
    const r = rowSchema.safeParse(obj);
    if (!r.success) {
      console.error(`L${idx + 2}: ${r.error.issues.map((x) => `[${x.path}] ${x.message}`).join(", ")}`);
      process.exit(1);
    }
    rows.push(r.data);
  });
  console.log(`読み込み: ${body.length}行 / 検証通過: ${rows.length}件`);
  if (dryRun) {
    for (const r of rows) console.log(`  ${r.item_slug} ←[${r.relation_type}] ${r.pref}${r.city ?? ""}`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("環境変数が未設定です");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const slugs = [...new Set(rows.map((r) => r.item_slug))];
  const { data: items, error } = await db.from("food_items").select("id, slug").in("slug", slugs);
  if (error) throw new Error(error.message);
  const idOf = new Map((items ?? []).map((x) => [x.slug, x.id]));
  const missing = slugs.filter((s) => !idOf.has(s));
  if (missing.length) {
    console.error(`存在しない slug: ${missing.join(", ")}`);
    process.exit(1);
  }

  let ok = 0;
  for (const r of rows) {
    const foodItemId = idOf.get(r.item_slug)!;
    // 一意制約が無いため、同一 (item, pref, type) を消してから入れ直す（冪等）
    await db
      .from("food_item_regions")
      .delete()
      .eq("food_item_id", foodItemId)
      .eq("pref", r.pref)
      .eq("relation_type", r.relation_type);
    const { error: e } = await db.from("food_item_regions").insert({
      food_item_id: foodItemId,
      pref: r.pref,
      city: r.city || null,
      lat: r.lat,
      lng: r.lng,
      relation_type: r.relation_type,
    });
    if (e) {
      console.error(`  ✗ ${r.item_slug} ← ${r.pref}: ${e.message}`);
      continue;
    }
    ok++;
    console.log(`  ✓ ${r.item_slug} ←[${r.relation_type}] ${r.pref}${r.city ?? ""}`);
  }
  console.log(`完了: ${ok}/${rows.length}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
