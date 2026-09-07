/**
 * 市区町村名の他言語表記（place_names）のJSONインポート。
 *
 * data/place-names.json は food_items.origin_city / food_item_regions.city の
 * distinct(pref, city) 全件を英語（ローマ字。市・区・町・村は落とす）で書いたもの
 * （実装部隊の報告「/en の本場・産地チップに市区町村名が日本語のまま」対応）。
 *
 * 使い方: node --env-file=.env.local scripts/import-place-names.ts --file data/place-names.json [--dry-run]
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const rowSchema = z.object({
  pref: z.string().trim().min(1),
  city: z.string().trim().min(1),
  en: z.string().trim().min(1),
});

async function main() {
  const i = process.argv.indexOf("--file");
  const file = i >= 0 ? process.argv[i + 1] : "data/place-names.json";
  const dryRun = process.argv.includes("--dry-run");

  const raw = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(raw)) {
    console.error(`${file} は {pref, city, en} の配列である必要があります。`);
    process.exit(1);
  }

  const rows: z.infer<typeof rowSchema>[] = [];
  const errors: string[] = [];
  const seenKeys = new Set<string>();

  raw.forEach((entry, idx) => {
    const r = rowSchema.safeParse(entry);
    if (!r.success) {
      errors.push(`  [${idx}] ${r.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join(", ")}`);
      return;
    }
    const key = `${r.data.pref}::${r.data.city}`;
    if (seenKeys.has(key)) {
      errors.push(`  [${idx}] ファイル内で重複: ${key}`);
      return;
    }
    seenKeys.add(key);
    rows.push(r.data);
  });

  console.log(`読み込み: ${raw.length}件 / 検証通過: ${rows.length}件`);
  if (errors.length > 0) {
    console.error(`\nバリデーションエラー ${errors.length}件:`);
    console.error(errors.join("\n"));
    console.error("\n1件でも不正なら投入しない。修正して再実行してください。");
    process.exit(1);
  }

  // locale は現時点では 'en' のみ投入する（place_names.locale は将来 zh-Hant/ko 等の
  // 追加に備えた列。.doc/20_data/01_models.md §1.3 と同じ二層方式）。
  const payload = rows.map((r) => ({ pref: r.pref, city: r.city, locale: "en", name: r.en }));

  if (dryRun) {
    console.log("\n--dry-run のため投入しません。");
    for (const r of payload) {
      console.log(`  ${r.pref} ${r.city} → ${r.name}`);
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

  // 1回のバッチupsertで済ませる（N+1回避。件数は300件弱でPostgRESTの1リクエスト上限内）。
  const { error, count } = await db
    .from("place_names")
    .upsert(payload, { onConflict: "pref,city,locale", count: "exact" });

  if (error) {
    console.error(`✗ 投入失敗: ${error.message}`);
    process.exit(1);
  }
  console.log(`\n完了: ${count ?? payload.length}/${payload.length}件を投入しました。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
