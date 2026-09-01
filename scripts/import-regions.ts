/**
 * アイテムの地域リレーション（名産地・主要提供圏・本場）のCSVインポート。
 *
 * 1行足すと、その県の地域ページにアイテムが合流する（.doc/20_data/01_models.md §3.6）。
 * 発祥地を1つに決められないアイテム（ネタ・食材）が、複数の土地と結びつくための仕組み。
 * 本場（どこでも食べられるが、ここのは特別）は note_ja/note_en に構造的理由の一文が必須で、
 * source_url を持つ行はアイテムの内部出典（food_item_sources）にも記録される。
 *
 * 使い方: node scripts/import-regions.ts --file data/sushi-regions.csv [--dry-run]
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { PREFECTURES } from "../src/lib/prefectures.ts";

// 空欄を許す数値列（本場は座標なしで県にだけ紐づけられる）
const optionalCoord = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), {
      message: `数値（${min}〜${max}）か空欄にしてください`,
    });

const rowSchema = z
  .object({
    item_slug: z.string().trim().min(1),
    pref: z.string().trim().refine((v) => (PREFECTURES as readonly string[]).includes(v), {
      message: "都道府県名マスタに一致しません",
    }),
    city: z.string().trim().optional(),
    lat: optionalCoord(20, 46),
    lng: optionalCoord(122, 154),
    relation_type: z.enum(["発祥", "名産地", "主要提供圏", "本場"]),
    note_ja: z.string().trim().optional(),
    note_en: z.string().trim().optional(),
    source_url: z.string().trim().url().optional().or(z.literal("")),
    source_title: z.string().trim().optional(),
    source_publisher: z.string().trim().optional(),
    source_accessed_at: z.string().trim().optional(),
  })
  .refine((r) => (r.lat === null) === (r.lng === null), {
    message: "lat/lng は両方入れるか両方空欄にしてください",
  })
  .refine((r) => r.relation_type !== "本場" || (!!r.note_ja && !!r.note_en), {
    message: "本場には note_ja/note_en（構造的理由の一文）が必須です",
  })
  .refine((r) => r.relation_type !== "本場" || !!r.source_url, {
    message: "本場には source_url が必須です",
  });

// RFC4180: 引用符・埋め込みカンマ・改行に対応（import-food-items.ts と同一実装）
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

async function main() {
  const i = process.argv.indexOf("--file");
  const file = i >= 0 ? process.argv[i + 1] : undefined;
  const dryRun = process.argv.includes("--dry-run");
  if (!file) {
    console.error("使い方: node scripts/import-regions.ts --file <csv> [--dry-run]");
    process.exit(1);
  }
  const [header, ...body] = parseCsv(readFileSync(file, "utf8"));
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

  // 一意制約が無いため、同一 (item, pref, type) を消してから入れ直す（冪等）。
  // 同一県に複数都市の行があるため、削除は行ごとではなく組ごとに先に済ませる
  // （行ごとに消すと同じ県の先行行を後続行が上書きしてしまう）。
  const combos = new Map<string, { foodItemId: string; pref: string; relationType: string }>();
  for (const r of rows) {
    const foodItemId = idOf.get(r.item_slug)!;
    combos.set(`${foodItemId}|${r.pref}|${r.relation_type}`, {
      foodItemId,
      pref: r.pref,
      relationType: r.relation_type,
    });
  }
  for (const c of combos.values()) {
    await db
      .from("food_item_regions")
      .delete()
      .eq("food_item_id", c.foodItemId)
      .eq("pref", c.pref)
      .eq("relation_type", c.relationType);
  }

  let ok = 0;
  for (const r of rows) {
    const foodItemId = idOf.get(r.item_slug)!;
    const { error: e } = await db.from("food_item_regions").insert({
      food_item_id: foodItemId,
      pref: r.pref,
      city: r.city || null,
      lat: r.lat,
      lng: r.lng,
      relation_type: r.relation_type,
      note_ja: r.note_ja || null,
      note_en: r.note_en || null,
    });
    if (e) {
      console.error(`  ✗ ${r.item_slug} ← ${r.pref}: ${e.message}`);
      continue;
    }
    // 出典URL付きの行はアイテムの内部出典にも記録（同一URLは入れ直し＝冪等）
    if (r.source_url) {
      await db
        .from("food_item_sources")
        .delete()
        .eq("food_item_id", foodItemId)
        .eq("url", r.source_url);
      const { error: se } = await db.from("food_item_sources").insert({
        food_item_id: foodItemId,
        url: r.source_url,
        title: r.source_title || `${r.relation_type}: ${r.pref}${r.city ?? ""}`,
        publisher: r.source_publisher || null,
        accessed_at: r.source_accessed_at || null,
      });
      if (se) {
        console.error(`  ✗ 出典の記録に失敗 ${r.item_slug} ← ${r.pref}: ${se.message}`);
        continue;
      }
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
