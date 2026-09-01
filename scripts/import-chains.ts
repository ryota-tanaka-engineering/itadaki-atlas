/**
 * 全国チェーンのJSONインポート（chains + chain_recommendations）。
 *
 * チェーン橋渡し装置（North Star「広く」軸）。data/chains.json を正データとし、
 * chains / chain_recommendations に upsert する。
 *
 * - recommend の kind='style'（系統への案内）は投入しない。bridge文が系統文脈を
 *   既に持っており、リンクはアイテム（kind='item'）のみに絞る運用のため。
 * - recommend の kind='item' の slug が food_items に存在しない場合は
 *   投入せずエラーで落とす（黙って握りつぶさない）。
 * - genre_slug は今回すべて 'ramen' 固定、pref_limited は全件 NULL（地域限定チェーン用の予約列）。
 * - 冪等: chains は slug で upsert。chain_recommendations は chain_id 単位で
 *   delete-then-insert し、並び順の変化にも追随する。
 *
 * 使い方: node --env-file=.env.local scripts/import-chains.ts [--dry-run]
 *
 * 接続先は .env.local の NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY。
 * service_role key は RLS をバイパスするため、サーバー側でのみ使う（.doc/10_system/06_security.md）。
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const recommendSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("style"), value: z.string().trim().min(1) }),
  z.object({ kind: z.literal("item"), slug: z.string().trim().min(1) }),
]);

const chainSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "必須")
    .regex(/^[a-z0-9-]+$/, "英小文字・数字・ハイフンのみ"),
  name_ja: z.string().trim().min(1, "必須"),
  name_en: z.string().trim().min(1, "必須"),
  founded: z.string().trim().min(1).optional(),
  style: z.string().trim().min(1).optional(),
  bridge_ja: z.string().trim().min(1, "必須"),
  bridge_en: z.string().trim().min(1, "必須"),
  recommend: z.array(recommendSchema),
  source_url: z.string().trim().min(1).optional(),
  source_note: z.string().trim().min(1).optional(),
});

const fileSchema = z.object({ chains: z.array(chainSchema) });

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const raw = JSON.parse(readFileSync("data/chains.json", "utf8"));
  const parsed = fileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(
      parsed.error.issues.map((x) => `[${x.path.join(".")}] ${x.message}`).join("\n"),
    );
    process.exit(1);
  }
  const { chains } = parsed.data;
  console.log(`読み込み: ${chains.length}件`);

  const itemRecommendSlugs = (
    c: (typeof chains)[number],
  ): { kind: "item"; slug: string }[] =>
    c.recommend.filter((r): r is { kind: "item"; slug: string } => r.kind === "item");

  if (dryRun) {
    for (const c of chains) {
      const items = itemRecommendSlugs(c);
      console.log(`  ${c.slug}: ${c.name_ja} → ${items.map((i) => i.slug).join(", ")}`);
    }
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("環境変数が未設定です（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  // recommend(kind=item) の slug が food_items に存在するか事前に全件検証する。
  // 1件でも欠けていたら何も書き込まずに落とす（要件: 黙って握りつぶさない）。
  const allItemSlugs = [...new Set(chains.flatMap((c) => itemRecommendSlugs(c).map((r) => r.slug)))];
  const { data: items, error: itemsErr } = await db
    .from("food_items")
    .select("id, slug")
    .in("slug", allItemSlugs);
  if (itemsErr) throw new Error(itemsErr.message);
  const itemIdOf = new Map((items ?? []).map((x) => [x.slug, x.id as string]));
  const missing = allItemSlugs.filter((s) => !itemIdOf.has(s));
  if (missing.length) {
    console.error(`存在しない食品slug（chain_recommendations の投入元）: ${missing.join(", ")}`);
    process.exit(1);
  }

  let ok = 0;
  for (const [idx, c] of chains.entries()) {
    const { data: chainRow, error: chainErr } = await db
      .from("chains")
      .upsert(
        {
          slug: c.slug,
          name_ja: c.name_ja,
          name_en: c.name_en,
          style_ja: c.style ?? null,
          style_en: null,
          founded_note: c.founded ?? null,
          bridge_ja: c.bridge_ja,
          bridge_en: c.bridge_en,
          genre_slug: "ramen",
          pref_limited: null,
          source_url: c.source_url ?? null,
          source_note: c.source_note ?? null,
          sort_order: idx,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (chainErr || !chainRow) {
      console.error(`  ✗ ${c.slug}: ${chainErr?.message ?? "upsert failed"}`);
      continue;
    }

    // 一意制約はあるが並び順の変化に追随させるため、chain_id 単位で消してから入れ直す（冪等）
    const { error: delErr } = await db
      .from("chain_recommendations")
      .delete()
      .eq("chain_id", chainRow.id);
    if (delErr) {
      console.error(`  ✗ ${c.slug} recommendations delete: ${delErr.message}`);
      continue;
    }

    const itemRecs = itemRecommendSlugs(c);
    let recOk = 0;
    for (const [recIdx, r] of itemRecs.entries()) {
      const foodItemId = itemIdOf.get(r.slug)!;
      const { error: recErr } = await db.from("chain_recommendations").insert({
        chain_id: chainRow.id,
        food_item_id: foodItemId,
        sort_order: recIdx,
      });
      if (recErr) {
        console.error(`  ✗ ${c.slug} → ${r.slug}: ${recErr.message}`);
        continue;
      }
      recOk++;
    }
    ok++;
    console.log(`  ✓ ${c.slug} (${recOk}/${itemRecs.length}件)`);
  }
  console.log(`完了: ${ok}/${chains.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
