/**
 * ご当地グルメCSVインポート
 *
 * 仕様: .doc/20_data/02_migrations.md §3
 *
 * - status='draft' で投入し、確認後に published へ上げる
 * - **出典なし・三点セット（日本語名/ローマ字/英訳）欠けは通さない。**
 *   後から埋める運用にすると必ず抜けるため、投入時点で弾く（.doc/00_concept/05_brand.md §5）
 * - 冪等: slug をキーに upsert する。再実行しても重複しない
 *
 * 使い方:
 *   node scripts/import-food-items.ts --file data/ramen.csv --genre ramen [--dry-run] [--publish]
 *
 * 接続先は .env.local の NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY。
 * service_role key は RLS をバイパスするため、サーバー側でのみ使う（.doc/10_system/06_security.md）。
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// 都道府県マスタはアプリと共有する（二重に持たない）
import { PREFECTURES } from "../src/lib/prefectures.ts";

const PRIMARY_STYLES = ["醤油", "味噌", "塩", "豚骨", "その他"] as const;

// -----------------------------------------------------------------------------
// 行スキーマ
// -----------------------------------------------------------------------------
const optionalText = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const coordinate = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v === "" ? undefined : Number(v)))
  .refine((v) => v === undefined || Number.isFinite(v), {
    message: "数値として解釈できません",
  });

const rowSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1, "必須")
      .regex(/^[a-z0-9-]+$/, "英小文字・数字・ハイフンのみ"),
    // 三点セット: 3つとも必須
    name_ja: z.string().trim().min(1, "必須（三点セット）"),
    name_romaji: z.string().trim().min(1, "必須（三点セット）"),
    name_en: z.string().trim().min(1, "必須（三点セット・説明訳）"),

    origin_pref: optionalText,
    origin_city: optionalText,
    lat: coordinate,
    lng: coordinate,
    primary_style: z.enum(PRIMARY_STYLES),
    summary_ja: z.string().trim().min(1, "必須"),
    summary_en: z.string().trim().min(1, "必須"),

    // 出典（1件以上必須）
    source_title: z.string().trim().min(1, "出典は1件以上必須"),
    source_url: optionalText,
    source_publisher: optionalText,
    source_accessed_at: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式"),
  })
  .superRefine((row, ctx) => {
    // 座標は両方あるか両方無いか（DBのCHECK制約と揃える）
    if ((row.lat === undefined) !== (row.lng === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "lat と lng は両方入れるか両方空にする",
        path: ["lat"],
      });
    }
    // 日本国内の妥当性
    if (row.lat !== undefined && (row.lat < 20 || row.lat > 46)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "緯度が日本の範囲外(20〜46)", path: ["lat"] });
    }
    if (row.lng !== undefined && (row.lng < 122 || row.lng > 154)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "経度が日本の範囲外(122〜154)", path: ["lng"] });
    }
    if (row.origin_pref !== undefined && !PREFECTURES.includes(row.origin_pref as never)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `都道府県名マスタに一致しません: ${row.origin_pref}`,
        path: ["origin_pref"],
      });
    }
  });

type Row = z.infer<typeof rowSchema>;

// -----------------------------------------------------------------------------
// CSV パース（RFC4180: 引用符・埋め込みカンマ・改行に対応）
// -----------------------------------------------------------------------------
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
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// -----------------------------------------------------------------------------
// 引数
// -----------------------------------------------------------------------------
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

// -----------------------------------------------------------------------------
// メイン
// -----------------------------------------------------------------------------
async function main() {
  const file = arg("file");
  const genreSlug = arg("genre");
  const dryRun = hasFlag("dry-run");
  const publish = hasFlag("publish");

  if (!file || !genreSlug) {
    console.error(
      "使い方: node scripts/import-food-items.ts --file <csv> --genre <genre-slug> [--dry-run] [--publish]",
    );
    process.exit(1);
  }

  // --- CSV 読み込みとバリデーション（DB接続前に全件検証する） ---
  const parsed = parseCsv(readFileSync(file, "utf8"));
  const [header, ...body] = parsed;
  const rows: Row[] = [];
  const errors: string[] = [];
  const seenSlugs = new Set<string>();

  body.forEach((cells, idx) => {
    const lineNo = idx + 2; // ヘッダ分
    const obj = Object.fromEntries(header.map((h, i) => [h.trim(), cells[i] ?? ""]));
    const result = rowSchema.safeParse(obj);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(`  L${lineNo} [${issue.path.join(".") || "-"}] ${issue.message}`);
      }
      return;
    }
    if (seenSlugs.has(result.data.slug)) {
      errors.push(`  L${lineNo} [slug] ファイル内で重複: ${result.data.slug}`);
      return;
    }
    seenSlugs.add(result.data.slug);
    rows.push(result.data);
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
    // 三点セットは全項目を出す。表示しない項目は壊れていても気づけないため。
    for (const r of rows) {
      const loc = r.origin_pref ? `${r.origin_pref}${r.origin_city ?? ""}` : "（地域性なし）";
      const coord = r.lat !== undefined ? `${r.lat},${r.lng}` : "座標なし";
      console.log(`\n  ${r.slug}  [${r.primary_style}] ${loc} (${coord})`);
      console.log(`    ja: ${r.name_ja}`);
      console.log(`    ro: ${r.name_romaji}`);
      console.log(`    en: ${r.name_en}`);
      console.log(`    出典: ${r.source_title} / ${r.source_publisher ?? "-"} / ${r.source_accessed_at}`);
    }
    return;
  }

  // --- DB 接続 ---
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です。");
    process.exit(1);
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: genre, error: genreErr } = await db
    .from("genres")
    .select("id")
    .eq("slug", genreSlug)
    .single();
  if (genreErr || !genre) {
    console.error(`ジャンル '${genreSlug}' が見つかりません。先に genres に登録してください。`);
    process.exit(1);
  }

  const status = publish ? "published" : "draft";
  let ok = 0;

  for (const r of rows) {
    const { data: item, error } = await db
      .from("food_items")
      .upsert(
        {
          slug: r.slug,
          type: "dish",
          genre_id: genre.id,
          name_romaji: r.name_romaji,
          origin_pref: r.origin_pref ?? null,
          origin_city: r.origin_city ?? null,
          lat: r.lat ?? null,
          lng: r.lng ?? null,
          status,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (error || !item) {
      console.error(`  ✗ ${r.slug}: ${error?.message}`);
      continue;
    }

    const { error: trErr } = await db.from("food_item_translations").upsert(
      [
        { food_item_id: item.id, locale: "ja", name: r.name_ja, summary: r.summary_ja },
        { food_item_id: item.id, locale: "en", name: r.name_en, summary: r.summary_en },
      ],
      { onConflict: "food_item_id,locale" },
    );
    if (trErr) {
      console.error(`  ✗ ${r.slug} (翻訳): ${trErr.message}`);
      continue;
    }

    // 出典は一意制約が無いため、再実行時の重複を避けて入れ直す
    await db.from("food_item_sources").delete().eq("food_item_id", item.id);
    const { error: srcErr } = await db.from("food_item_sources").insert({
      food_item_id: item.id,
      title: r.source_title,
      url: r.source_url ?? null,
      publisher: r.source_publisher ?? null,
      accessed_at: r.source_accessed_at,
    });
    if (srcErr) {
      console.error(`  ✗ ${r.slug} (出典): ${srcErr.message}`);
      continue;
    }

    const { error: ddErr } = await db
      .from("dish_details")
      .upsert({ food_item_id: item.id, primary_style: r.primary_style }, { onConflict: "food_item_id" });
    if (ddErr) {
      console.error(`  ✗ ${r.slug} (詳細): ${ddErr.message}`);
      continue;
    }

    ok++;
    console.log(`  ✓ ${r.slug} (${status})`);
  }

  console.log(`\n完了: ${ok}/${rows.length}件を ${status} で投入しました。`);
  if (!publish) {
    console.log("確認後に published へ上げるには --publish を付けて再実行してください。");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
