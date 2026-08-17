/**
 * アイテム間リレーションのCSVインポート。
 *
 * 1行足すと、両端の詳細ページに双方向で「名前つきリンク」が生える
 * （.doc/20_data/01_models.md §3.7）。
 *
 * 使い方: node scripts/import-relations.ts --file data/ramen-relations.csv [--dry-run]
 *
 * 関係も事実の記述である。「派生」は出典で裏の取れるものだけ入れる。
 * 「対比」は事実の主張ではなく編集上の並置なので、その旨を理解した上で使う。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const RELATION_TYPES = ["派生", "対比", "代表ネタ", "使用食材"] as const;

const rowSchema = z.object({
  from_slug: z.string().trim().min(1),
  to_slug: z.string().trim().min(1),
  relation_type: z.enum(RELATION_TYPES),
});

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const file = arg("file");
  const dryRun = process.argv.includes("--dry-run");
  if (!file) {
    console.error("使い方: node scripts/import-relations.ts --file <csv> [--dry-run]");
    process.exit(1);
  }

  const [header, ...body] = readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((l) => l.split(","));
  const rows: z.infer<typeof rowSchema>[] = [];
  const errors: string[] = [];
  body.forEach((cells, idx) => {
    const obj = Object.fromEntries(header.map((h, i) => [h.trim(), cells[i]?.trim() ?? ""]));
    const r = rowSchema.safeParse(obj);
    if (!r.success) {
      errors.push(`  L${idx + 2}: ${r.error.issues.map((i) => i.message).join(", ")}`);
      return;
    }
    if (r.data.from_slug === r.data.to_slug) {
      errors.push(`  L${idx + 2}: from と to が同一`);
      return;
    }
    rows.push(r.data);
  });
  console.log(`読み込み: ${body.length}行 / 検証通過: ${rows.length}件`);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  if (dryRun) {
    for (const r of rows) console.log(`  ${r.from_slug} →[${r.relation_type}]→ ${r.to_slug}`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("環境変数が未設定です");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  // slug → id
  const slugs = [...new Set(rows.flatMap((r) => [r.from_slug, r.to_slug]))];
  const { data: items, error } = await db.from("food_items").select("id, slug").in("slug", slugs);
  if (error) throw new Error(error.message);
  const idOf = new Map((items ?? []).map((i) => [i.slug, i.id]));
  const missing = slugs.filter((s) => !idOf.has(s));
  if (missing.length) {
    console.error(`存在しない slug: ${missing.join(", ")}。先にアイテムを投入すること`);
    process.exit(1);
  }

  let ok = 0;
  for (const r of rows) {
    const { error: e } = await db.from("food_item_relations").upsert(
      {
        from_id: idOf.get(r.from_slug)!,
        to_id: idOf.get(r.to_slug)!,
        relation_type: r.relation_type,
      },
      { onConflict: "from_id,to_id,relation_type" },
    );
    if (e) {
      console.error(`  ✗ ${r.from_slug}→${r.to_slug}: ${e.message}`);
      continue;
    }
    ok++;
    console.log(`  ✓ ${r.from_slug} →[${r.relation_type}]→ ${r.to_slug}`);
  }
  console.log(`完了: ${ok}/${rows.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
