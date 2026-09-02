/**
 * 詳細ページ本文（body_md ja/en）+ 出典 + 関係のバッチJSONインポート。
 *
 * research-fleet の執筆バッチ（ia-atlas-content Skill §7 の量産体制）が出力する
 * JSON を検証して投入する。形式:
 *   {"items": [{"slug", "body_ja", "body_en",
 *               "sources": [{"title","url","publisher","accessed_at"}],
 *               "relations": [{"from_slug","to_slug","relation_type","basis"}]}]}
 *
 * 使い方: node --env-file=.env.local scripts/import-bodies.ts --file <json> [--dry-run]
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// 章構成は ia-atlas-content Skill の3章固定。見出しが欠けたデータを黙って通さない
const JA_CHAPTERS = ["## 何でできているか", "## どう作るのか", "## なぜこの形になったのか"];
const EN_CHAPTERS = ["## What it's made of", "## How it's made", "## Why it took this shape"];

// CSVは編集用の日本語語彙、DBは4語彙（import-relations.ts と同じ変換）
const TYPE_TO_DB: Record<string, string> = {
  源流: "lineage",
  派生: "lineage",
  兄弟: "sibling",
  対比: "contrast",
  代表ネタ: "uses",
  使用食材: "uses",
};

const itemSchema = z.object({
  slug: z.string().trim().min(1),
  body_ja: z.string().refine((b) => JA_CHAPTERS.every((c) => b.includes(c)), {
    message: "ja本文に3章の見出しが揃っていません",
  }),
  body_en: z.string().refine((b) => EN_CHAPTERS.every((c) => b.includes(c)), {
    message: "en本文に3章の見出しが揃っていません",
  }),
  sources: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        url: z.string().trim().url(),
        publisher: z.string().trim().optional(),
        accessed_at: z.string().trim().optional(),
      }),
    )
    .min(1, "出典は最低1本（ia-atlas-content Skill §2）"),
  relations: z
    .array(
      z.object({
        from_slug: z.string().trim().min(1),
        to_slug: z.string().trim().min(1),
        relation_type: z.string().refine((t) => t in TYPE_TO_DB, { message: "未知の関係語彙" }),
        basis: z.string().optional(),
      }),
    )
    .default([]),
});

async function main() {
  const i = process.argv.indexOf("--file");
  const file = i >= 0 ? process.argv[i + 1] : undefined;
  const dryRun = process.argv.includes("--dry-run");
  if (!file) {
    console.error("使い方: node scripts/import-bodies.ts --file <json> [--dry-run]");
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(file, "utf8"));
  const parsed = z.object({ items: z.array(itemSchema).min(1) }).safeParse(raw);
  if (!parsed.success) {
    console.error(parsed.error.issues.map((x) => `[${x.path.join(".")}] ${x.message}`).join("\n"));
    process.exit(1);
  }
  const items = parsed.data.items;
  console.log(`読み込み: ${items.length}件`);
  if (dryRun) {
    for (const it of items)
      console.log(
        `  ${it.slug}: ja ${it.body_ja.length}字 / en ${it.body_en.length}字 / 出典${it.sources.length} / 関係${it.relations.length}`,
      );
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("環境変数が未設定です");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  // slug 実在確認（本文対象 + 関係の両端。存在しないslugは全体エラーで落とす）
  const slugs = [
    ...new Set(items.flatMap((it) => [it.slug, ...it.relations.flatMap((r) => [r.from_slug, r.to_slug])])),
  ];
  const { data: found, error } = await db.from("food_items").select("id, slug").in("slug", slugs);
  if (error) throw new Error(error.message);
  const idOf = new Map((found ?? []).map((x) => [x.slug, x.id]));
  const missing = slugs.filter((s) => !idOf.has(s));
  if (missing.length) {
    console.error(`存在しない slug: ${missing.join(", ")}`);
    process.exit(1);
  }

  let ok = 0;
  for (const it of items) {
    const foodItemId = idOf.get(it.slug)!;
    let failed = false;

    for (const [locale, body] of [
      ["ja", it.body_ja],
      ["en", it.body_en],
    ] as const) {
      const { error: e, count } = await db
        .from("food_item_translations")
        .update({ body_md: body }, { count: "exact" })
        .eq("food_item_id", foodItemId)
        .eq("locale", locale);
      if (e || count !== 1) {
        console.error(`  ✗ ${it.slug} ${locale}: ${e?.message ?? `更新行数 ${count}`}`);
        failed = true;
      }
    }

    for (const s of it.sources) {
      await db.from("food_item_sources").delete().eq("food_item_id", foodItemId).eq("url", s.url);
      const { error: se } = await db.from("food_item_sources").insert({
        food_item_id: foodItemId,
        title: s.title,
        url: s.url,
        publisher: s.publisher || null,
        accessed_at: s.accessed_at || null,
      });
      if (se) {
        console.error(`  ✗ ${it.slug} 出典: ${se.message}`);
        failed = true;
      }
    }

    for (const r of it.relations) {
      const { error: re } = await db.from("food_item_relations").upsert(
        {
          from_id: idOf.get(r.from_slug)!,
          to_id: idOf.get(r.to_slug)!,
          relation_type: TYPE_TO_DB[r.relation_type],
        },
        { onConflict: "from_id,to_id,relation_type" },
      );
      if (re) {
        console.error(`  ✗ ${r.from_slug}→${r.to_slug}: ${re.message}`);
        failed = true;
      }
    }

    if (!failed) {
      ok++;
      console.log(`  ✓ ${it.slug}`);
    }
  }
  console.log(`完了: ${ok}/${items.length}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
