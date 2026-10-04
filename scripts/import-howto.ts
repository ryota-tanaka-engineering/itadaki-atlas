/**
 * 4章目「どう食べるのか」と麺・濃さの属性のバッチ投入（2026-10「詳細ページの情報を厚くする」）。
 *
 * 部隊（data/ledgers/HOWTO_BRIEF.md）が出力する JSON を検証し、
 *   1. food_item_translations.body_md の末尾に4章目を付け足す（既にあれば差し替え。
 *      見出し `## どう食べるのか` / `## How to eat it` はここで機械的に付ける）
 *   2. dish_details の noodle_thickness / noodle_curl / richness を upsert する
 *      （null の項目は触らない。primary_style はそのまま）
 * する。既存3章は変更しない（本文の差し替えは import-bodies.ts）。
 *
 * 形式:
 *   {"items": [{"slug", "howto_ja", "howto_en",
 *               "noodle_thickness": "中太"|null, "noodle_curl": "ちぢれ"|null, "richness": 1..5|null,
 *               "notes"?: "…"}],
 *    "notes"?: "…"}
 *
 * 使い方: node --env-file=.env.local scripts/import-howto.ts --file data/howto/<name>.json [--dry-run]
 *   本番: bash scripts/prod-env.sh node scripts/import-howto.ts --file data/howto/<name>.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { hasHowtoChapter, upsertHowtoChapter, validateChapters } from "./lib/chapters.ts";

// 語彙は DB の CHECK 制約（supabase/migrations/20261004000000_dish_details_noodle_vocab.sql）と揃える
export const NOODLE_THICKNESS = ["極細", "細", "中細", "中太", "太", "極太"] as const;
export const NOODLE_CURL = ["ストレート", "ちぢれ", "手もみ"] as const;

/** 字数の目安（HOWTO_BRIEF.md）。超過・不足は警告のみ（投入は止めない）。 */
export const HOWTO_JA_RANGE = [150, 250] as const;
export const HOWTO_EN_WORDS_RANGE = [80, 160] as const;

const noHeading = (s: string) => !s.split("\n").some((l) => l.trim().startsWith("#"));
const nullable = <T extends z.ZodTypeAny>(inner: T) => z.preprocess((v) => (v === "" ? null : v), inner.nullable().optional());

export const howtoItemSchema = z.object({
  slug: z.string().trim().min(1, "必須"),
  howto_ja: z
    .string()
    .trim()
    .min(1, "必須")
    .refine(noHeading, { message: "本文だけを書く（見出し行 `## ` は投入時に付く）" }),
  howto_en: z
    .string()
    .trim()
    .min(1, "必須")
    .refine(noHeading, { message: "本文だけを書く（見出し行 `## ` は投入時に付く）" }),
  noodle_thickness: nullable(z.enum(NOODLE_THICKNESS)),
  noodle_curl: nullable(z.enum(NOODLE_CURL)),
  richness: nullable(z.number().int().min(1).max(5)),
  notes: z.string().optional(),
});

export const howtoBundleSchema = z.object({
  items: z.array(howtoItemSchema).min(1),
  notes: z.string().optional(),
});

export type HowtoItem = z.infer<typeof howtoItemSchema>;
export type HowtoBundle = z.infer<typeof howtoBundleSchema>;

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** 字数・語数の目安からの逸脱と slug 重複を警告文として返す（検証は zod、ここは目安）。 */
export function softWarnings(bundle: HowtoBundle): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const it of bundle.items) {
    if (seen.has(it.slug)) out.push(`${it.slug}: slug が重複`);
    seen.add(it.slug);
    const ja = it.howto_ja.length;
    if (ja < HOWTO_JA_RANGE[0] || ja > HOWTO_JA_RANGE[1]) out.push(`${it.slug}: howto_ja ${ja}字（目安 ${HOWTO_JA_RANGE.join("〜")}）`);
    const en = countWords(it.howto_en);
    if (en < HOWTO_EN_WORDS_RANGE[0] || en > HOWTO_EN_WORDS_RANGE[1]) {
      out.push(`${it.slug}: howto_en ${en} words（目安 ${HOWTO_EN_WORDS_RANGE.join("〜")}）`);
    }
  }
  return out;
}

/** 格付け語・店名らしきものの簡易検査（ia-atlas-content Skill §1。投入前に目視で直す）。 */
const RANKING_WORDS = ["三大", "一番", "No.1", "No1", "ランキング", "受賞", "認定", "人気No", "日本一"];
export function rankingWordHits(bundle: HowtoBundle): string[] {
  const out: string[] = [];
  for (const it of bundle.items) {
    const hit = RANKING_WORDS.filter((w) => it.howto_ja.includes(w));
    if (hit.length) out.push(`${it.slug}: ${hit.join("・")}`);
  }
  return out;
}

/** dish_details に書く値（null は「触らない」なので送らない）。 */
export function detailsPatch(it: HowtoItem): Record<string, string | number> {
  const patch: Record<string, string | number> = {};
  if (it.noodle_thickness) patch.noodle_thickness = it.noodle_thickness;
  if (it.noodle_curl) patch.noodle_curl = it.noodle_curl;
  if (it.richness != null) patch.richness = it.richness;
  return patch;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const file = arg("file");
  const dryRun = process.argv.includes("--dry-run");
  if (!file) {
    console.error("使い方: node --env-file=.env.local scripts/import-howto.ts --file data/howto/<name>.json [--dry-run]");
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(file, "utf8"));
  const parsed = howtoBundleSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(parsed.error.issues.map((x) => `[${x.path.join(".")}] ${x.message}`).join("\n"));
    process.exit(1);
  }
  const bundle = parsed.data;
  console.log(`読み込み: ${bundle.items.length}件`);
  for (const w of softWarnings(bundle)) console.log(`  △ ${w}`);
  const ranking = rankingWordHits(bundle);
  if (ranking.length) {
    console.error(`格付け語を含む項目があります（書き換えてから投入）:\n  ${ranking.join("\n  ")}`);
    process.exit(1);
  }
  if (dryRun) {
    for (const it of bundle.items) {
      const d = detailsPatch(it);
      console.log(
        `  ${it.slug}: ja ${it.howto_ja.length}字 / en ${countWords(it.howto_en)} words / ` +
          `麺 ${d.noodle_thickness ?? "-"} ${d.noodle_curl ?? "-"} / 濃さ ${d.richness ?? "-"}`,
      );
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

  const slugs = [...new Set(bundle.items.map((it) => it.slug))];
  const { data: found, error } = await db.from("food_items").select("id, slug").in("slug", slugs);
  if (error) throw new Error(error.message);
  const idOf = new Map((found ?? []).map((x) => [x.slug, x.id]));
  const missing = slugs.filter((s) => !idOf.has(s));
  if (missing.length) {
    console.error(`存在しない slug: ${missing.join(", ")}`);
    process.exit(1);
  }

  const { data: trs, error: trErr } = await db
    .from("food_item_translations")
    .select("food_item_id, locale, body_md")
    .in("food_item_id", [...idOf.values()]);
  if (trErr) throw new Error(trErr.message);
  const bodyOf = new Map((trs ?? []).map((t) => [`${t.food_item_id}:${t.locale}`, t.body_md as string | null]));

  let ok = 0;
  for (const it of bundle.items) {
    const foodItemId = idOf.get(it.slug)!;
    let failed = false;

    for (const [locale, text] of [
      ["ja", it.howto_ja],
      ["en", it.howto_en],
    ] as const) {
      const current = bodyOf.get(`${foodItemId}:${locale}`);
      // 4章目は既存3章の末尾に付くもの。本文（Tier2）が無いアイテムには付けない
      if (!current) {
        console.error(`  ✗ ${it.slug} ${locale}: 本文（3章）が未投入のため4章目を付けられません`);
        failed = true;
        continue;
      }
      const next = upsertHowtoChapter(current, locale, text);
      const problem = validateChapters(next, locale);
      if (problem) {
        console.error(`  ✗ ${it.slug} ${locale}: ${problem}`);
        failed = true;
        continue;
      }
      const { error: e, count } = await db
        .from("food_item_translations")
        .update({ body_md: next }, { count: "exact" })
        .eq("food_item_id", foodItemId)
        .eq("locale", locale);
      if (e || count !== 1) {
        console.error(`  ✗ ${it.slug} ${locale}: ${e?.message ?? `更新行数 ${count}`}`);
        failed = true;
        continue;
      }
      bodyOf.set(`${foodItemId}:${locale}`, next);
    }

    const patch = detailsPatch(it);
    if (Object.keys(patch).length > 0) {
      const { error: de } = await db
        .from("dish_details")
        .upsert({ food_item_id: foodItemId, ...patch }, { onConflict: "food_item_id" });
      if (de) {
        console.error(`  ✗ ${it.slug} 属性: ${de.message}`);
        failed = true;
      }
    }

    if (!failed) {
      ok++;
      const marks = [hasHowtoChapter(bodyOf.get(`${foodItemId}:ja`), "ja") ? "ja" : "", hasHowtoChapter(bodyOf.get(`${foodItemId}:en`), "en") ? "en" : ""]
        .filter(Boolean)
        .join("/");
      console.log(`  ✓ ${it.slug}（4章目 ${marks}）`);
    }
  }
  console.log(`完了: ${ok}/${bundle.items.length}`);
  if (ok !== bundle.items.length) process.exit(1);
}

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href : false;
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
