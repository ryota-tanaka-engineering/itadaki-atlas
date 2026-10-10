/**
 * 都道府県の総論（一行）と読み物（地の文）の JSON インポート（2026-10-10）。
 *
 * data/prefecture-intros.json を正データとし、prefecture_intros に (pref, locale) で upsert、
 * 出典 prefecture_intro_sources は県ごとに delete-then-insert する（import-guides.ts と同じ方針）。
 * 部隊の出力（data/ledgers/PREF_INTRO_BRIEF.md の intros / essays）を `buildIntroFile` で
 * この形に合流させてから保存する。
 *
 * 形式:
 *   [{ "pref": "石川県",
 *      "translations": { "ja": { "intro": "…", "body_md": "## …"? }, "en": { … } },
 *      "sources": [{ "title", "url", "publisher", "accessed_at" }] }]
 *
 * 使い方: node --env-file=.env.local scripts/import-prefecture-intros.ts --file data/prefecture-intros.json [--dry-run]
 *   本番: bash scripts/prod-env.sh node scripts/import-prefecture-intros.ts --file data/prefecture-intros.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { PREFECTURES } from "../src/lib/prefectures.ts";

const prefField = z
  .string()
  .trim()
  .refine((v) => (PREFECTURES as readonly string[]).includes(v), { message: "都道府県名マスタに一致しません" });

/** 格付け語・観光コピー・使わない語（PREF_INTRO_BRIEF.md）。見つかれば投入を止める */
export const BANNED_WORDS = ["有名", "人気", "一番", "三大", "No.1", "ご当地", "宝庫", "王国"];

const translationSchema = z.object({
  intro: z.string().trim().min(1, "必須").max(600),
  body_md: z.string().trim().min(1).optional(),
});

export const prefIntroSchema = z.object({
  pref: prefField,
  translations: z
    .object({ ja: translationSchema, en: translationSchema })
    .catchall(translationSchema)
    .superRefine((t, ctx) => {
      if (!!t.ja.body_md !== !!t.en.body_md) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "body_md は ja と en の両方に入れるか両方空にする" });
      }
    }),
  sources: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        url: z.string().trim().url().optional(),
        publisher: z.string().trim().optional(),
        accessed_at: z
          .string()
          .trim()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      }),
    )
    .min(1, "出典は1件以上"),
});

export const prefIntroFileSchema = z.array(prefIntroSchema).superRefine((rows, ctx) => {
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    if (seen.has(r.pref)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `県が重複: ${r.pref}`, path: [i, "pref"] });
    seen.add(r.pref);
  });
});

export type PrefIntroRow = z.infer<typeof prefIntroSchema>;

/** 本文（ja）に使わない語が含まれていれば、その語と場所を返す。 */
export function bannedWordHits(rows: PrefIntroRow[]): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const ja = `${r.translations.ja.intro}\n${r.translations.ja.body_md ?? ""}`;
    const hit = BANNED_WORDS.filter((w) => ja.includes(w));
    if (hit.length) out.push(`${r.pref}: ${hit.join("・")}`);
  }
  return out;
}

/** 本文中の内部リンク（`](/genre/slug)`）のパスを集める。投入前に実在を確かめるため。 */
export function internalLinks(rows: PrefIntroRow[]): string[] {
  const out = new Set<string>();
  for (const r of rows) {
    for (const t of Object.values(r.translations)) {
      for (const m of (t.body_md ?? "").matchAll(/\]\((\/[^)\s]+)\)/g)) out.add(m[1]);
    }
  }
  return [...out];
}

type FleetIntro = { pref: string; intro_ja: string; intro_en: string; sources?: PrefIntroRow["sources"] };
type FleetEssay = { pref: string; body_ja: string; body_en: string };

/** 部隊の出力（intros / essays の束、複数ファイル）を投入形式に合流させる。 */
export function buildIntroFile(bundles: { intros?: FleetIntro[]; essays?: FleetEssay[] }[]): PrefIntroRow[] {
  const byPref = new Map<string, PrefIntroRow>();
  for (const b of bundles) {
    for (const it of b.intros ?? []) {
      byPref.set(it.pref, {
        pref: it.pref,
        translations: { ja: { intro: it.intro_ja }, en: { intro: it.intro_en } },
        sources: it.sources ?? [],
      });
    }
  }
  for (const b of bundles) {
    for (const e of b.essays ?? []) {
      const row = byPref.get(e.pref);
      if (!row) throw new Error(`地の文に対応する一行の総論がありません: ${e.pref}`);
      row.translations.ja.body_md = e.body_ja;
      row.translations.en.body_md = e.body_en;
    }
  }
  return [...byPref.values()].sort(
    (a, b) => (PREFECTURES as readonly string[]).indexOf(a.pref) - (PREFECTURES as readonly string[]).indexOf(b.pref),
  );
}

async function main() {
  const i = process.argv.indexOf("--file");
  const file = i >= 0 ? process.argv[i + 1] : "data/prefecture-intros.json";
  const dryRun = process.argv.includes("--dry-run");

  const parsed = prefIntroFileSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) {
    console.error(parsed.error.issues.map((x) => `[${x.path.join(".")}] ${x.message}`).join("\n"));
    process.exit(1);
  }
  const rows = parsed.data;
  console.log(`読み込み: ${rows.length}県（読み物つき ${rows.filter((r) => r.translations.ja.body_md).length}県）`);
  const banned = bannedWordHits(rows);
  if (banned.length) {
    console.error(`使わない語があります（書き換えてから投入）:\n  ${banned.join("\n  ")}`);
    process.exit(1);
  }
  const links = internalLinks(rows);
  if (dryRun) {
    for (const r of rows) console.log(`  ${r.pref}: ja ${r.translations.ja.intro.length}字${r.translations.ja.body_md ? ` / 読み物 ${r.translations.ja.body_md.length}字` : ""}`);
    if (links.length) console.log(`  内部リンク ${links.length}本: ${links.join(", ")}`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("環境変数が未設定です");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  // 内部リンクの slug が公開済みか確かめる（行き止まりリンクを作らない）
  const slugs = links.map((l) => l.split("/").filter(Boolean).pop()!).filter(Boolean);
  if (slugs.length) {
    const { data, error } = await db.from("food_items").select("slug").eq("status", "published").in("slug", slugs);
    if (error) throw new Error(error.message);
    const found = new Set((data ?? []).map((x) => x.slug));
    const missing = slugs.filter((s) => !found.has(s));
    if (missing.length) {
      console.error(`読み物のリンク先が公開されていません: ${missing.join(", ")}`);
      process.exit(1);
    }
  }

  let ok = 0;
  for (const r of rows) {
    const trs = Object.entries(r.translations).map(([locale, t]) => ({
      pref: r.pref,
      locale,
      intro: t.intro,
      body_md: t.body_md ?? null,
    }));
    const { error: te } = await db.from("prefecture_intros").upsert(trs, { onConflict: "pref,locale" });
    if (te) {
      console.error(`  ✗ ${r.pref}: ${te.message}`);
      continue;
    }
    await db.from("prefecture_intro_sources").delete().eq("pref", r.pref);
    const { error: se } = await db.from("prefecture_intro_sources").insert(
      r.sources.map((s) => ({ pref: r.pref, title: s.title, url: s.url ?? null, publisher: s.publisher ?? null, accessed_at: s.accessed_at ?? null })),
    );
    if (se) {
      console.error(`  ✗ ${r.pref} 出典: ${se.message}`);
      continue;
    }
    ok++;
  }
  console.log(`完了: ${ok}/${rows.length}`);
  if (ok !== rows.length) process.exit(1);
}

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href : false;
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
