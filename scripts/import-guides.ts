/**
 * 「食べに行く前に」ガイドのJSONインポート
 * （guides + guide_translations + guide_sources + guide_links）。
 *
 * data/guides.json を正データとし、guides に slug で upsert する。
 * 子データ（translations / sources / links）は guide_id 単位で delete-then-insert
 * し、内容の変化・削除に追随する（`scripts/import-chains.ts` と同じ方針）。
 *
 * status（draft/published）はJSONの `status` フィールドで持つ（`--publish` 相当の
 * フラグは無い。CLAUDE.md「投入」節）。
 *
 * links（genre/shelf/tag/pref/item への参照。pref/item は2026-09-12「体験と場所」で追加）は
 * 投入前に全件、参照先の存在を検証する。pref は src/lib/prefectures.ts の PREF_SLUGS、
 * item は food_items.slug と突合する。
 * 1件でも欠けていたら何も書き込まずに落とす（黙って握りつぶさない。import-chains.ts と同じ方針）。
 *
 * 場所を持つガイド（food-town/market/festival/beer-garden/brewery-tour/factory-tour）は
 * pref/city/lat/lng（guides）と when_note（guide_translations。開催・営業時期のメモ。
 * 断定しない文体で「例年5月」「通年」等）を追加で持つ。読み物系ガイドはいずれも省略可。
 *
 * 使い方: node --env-file=.env.local scripts/import-guides.ts --file data/guides.json [--dry-run]
 *
 * 接続先は .env.local の NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY。
 * service_role key は RLS をバイパスするため、サーバー側でのみ使う（.doc/10_system/06_security.md）。
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

import { guidesFileSchema, type GuideImportRow } from "../src/features/guide/schemas.ts";
import { GUIDE_SCENE_SLUGS } from "../src/features/guide/scenes.ts";
import { PREF_SLUGS } from "../src/lib/prefectures.ts";

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const fileIdx = argv.indexOf("--file");
  const file = fileIdx >= 0 ? argv[fileIdx + 1] : "data/guides.json";
  if (!file) {
    console.error("--file にファイルパスが指定されていません");
    process.exit(1);
  }
  return { dryRun, file };
}

async function main() {
  const { dryRun, file } = parseArgs(process.argv.slice(2));

  const raw = JSON.parse(readFileSync(file, "utf8"));
  const parsed = guidesFileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(
      parsed.error.issues.map((x) => `[${x.path.join(".")}] ${x.message}`).join("\n"),
    );
    process.exit(1);
  }
  const { guides } = parsed.data;
  console.log(`読み込み: ${guides.length}件（${file}）`);

  if (dryRun) {
    for (const g of guides) {
      const locales = Object.keys(g.translations).join(",");
      const links = g.links.map((l) => `${l.kind}:${l.slug}`).join(", ");
      console.log(`  ${g.slug} [${g.kind}/${g.status}] locales=${locales} links=${links || "-"}`);
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

  // links の参照先（genre/shelf/tag/pref/item/scene）が実在するか、全件を事前に検証する。
  // 1件でも欠けていたら何も書き込まずに落とす。
  const slugsOf = (kind: GuideImportRow["links"][number]["kind"]) =>
    [...new Set(guides.flatMap((g) => g.links.filter((l) => l.kind === kind).map((l) => l.slug)))];
  const genreSlugs = slugsOf("genre");
  const shelfSlugs = slugsOf("shelf");
  const tagSlugs = slugsOf("tag");
  const prefSlugs = slugsOf("pref");
  const itemSlugs = slugsOf("item");
  const sceneSlugs = slugsOf("scene");

  const [
    { data: genres, error: genresErr },
    { data: shelves, error: shelvesErr },
    { data: tags, error: tagsErr },
    { data: items, error: itemsErr },
  ] = await Promise.all([
    genreSlugs.length
      ? db.from("genres").select("slug").in("slug", genreSlugs)
      : Promise.resolve({ data: [] as { slug: string }[], error: null }),
    shelfSlugs.length
      ? db.from("shelves").select("slug").in("slug", shelfSlugs)
      : Promise.resolve({ data: [] as { slug: string }[], error: null }),
    tagSlugs.length
      ? db.from("tags").select("slug").in("slug", tagSlugs)
      : Promise.resolve({ data: [] as { slug: string }[], error: null }),
    itemSlugs.length
      ? db.from("food_items").select("slug").in("slug", itemSlugs)
      : Promise.resolve({ data: [] as { slug: string }[], error: null }),
  ]);
  if (genresErr) throw new Error(genresErr.message);
  if (shelvesErr) throw new Error(shelvesErr.message);
  if (tagsErr) throw new Error(tagsErr.message);
  if (itemsErr) throw new Error(itemsErr.message);

  // pref は都道府県マスタ（PREF_SLUGS）に対して検証する。DBテーブルを持たないため
  // genre/shelf/tag/item と異なり静的集合との突合になる（src/lib/prefectures.ts が唯一の定義）
  const validPrefSlugs = new Set(Object.values(PREF_SLUGS));
  const prefMissing = prefSlugs.filter((s) => !validPrefSlugs.has(s));
  if (prefMissing.length) {
    console.error(`存在しない都道府県slug（guide_links pref）:\n  ${prefMissing.join("\n  ")}`);
    process.exit(1);
  }

  // scene も pref と同じく静的集合（GUIDE_SCENES。DBテーブルを持たない）との突合で検証する
  const validSceneSlugs = new Set(GUIDE_SCENE_SLUGS as readonly string[]);
  const sceneMissing = sceneSlugs.filter((s) => !validSceneSlugs.has(s));
  if (sceneMissing.length) {
    console.error(`存在しない場面slug（guide_links scene）:\n  ${sceneMissing.join("\n  ")}`);
    process.exit(1);
  }

  const existing = {
    genre: new Set((genres ?? []).map((x) => x.slug)),
    shelf: new Set((shelves ?? []).map((x) => x.slug)),
    tag: new Set((tags ?? []).map((x) => x.slug)),
    pref: validPrefSlugs,
    item: new Set((items ?? []).map((x) => x.slug)),
    scene: validSceneSlugs,
  };
  const missing = guides.flatMap((g) =>
    g.links
      .filter((l) => !existing[l.kind].has(l.slug))
      .map((l) => `${g.slug} → ${l.kind}:${l.slug}`),
  );
  if (missing.length) {
    console.error(`存在しない参照先（guide_links）:\n  ${missing.join("\n  ")}`);
    process.exit(1);
  }

  let ok = 0;
  for (const g of guides) {
    const { data: guideRow, error: guideErr } = await db
      .from("guides")
      .upsert(
        {
          slug: g.slug,
          kind: g.kind,
          sort_order: g.sort_order,
          status: g.status,
          pref: g.pref ?? null,
          city: g.city ?? null,
          lat: g.lat ?? null,
          lng: g.lng ?? null,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (guideErr || !guideRow) {
      console.error(`  ✗ ${g.slug}: ${guideErr?.message ?? "upsert failed"}`);
      continue;
    }
    const guideId = guideRow.id as string;

    const { error: delTrErr } = await db.from("guide_translations").delete().eq("guide_id", guideId);
    if (delTrErr) {
      console.error(`  ✗ ${g.slug} translations delete: ${delTrErr.message}`);
      continue;
    }
    const translationRows = Object.entries(g.translations).map(([locale, t]) => ({
      guide_id: guideId,
      locale,
      title: t.title,
      summary: t.summary ?? null,
      body_md: t.body_md ?? null,
      when_note: t.when_note ?? null,
    }));
    const { error: insTrErr } = await db.from("guide_translations").insert(translationRows);
    if (insTrErr) {
      console.error(`  ✗ ${g.slug} translations insert: ${insTrErr.message}`);
      continue;
    }

    const { error: delSrcErr } = await db.from("guide_sources").delete().eq("guide_id", guideId);
    if (delSrcErr) {
      console.error(`  ✗ ${g.slug} sources delete: ${delSrcErr.message}`);
      continue;
    }
    if (g.sources.length > 0) {
      const { error: insSrcErr } = await db.from("guide_sources").insert(
        g.sources.map((s) => ({
          guide_id: guideId,
          title: s.title,
          url: s.url ?? null,
          publisher: s.publisher ?? null,
          accessed_at: s.accessed_at ?? null,
        })),
      );
      if (insSrcErr) {
        console.error(`  ✗ ${g.slug} sources insert: ${insSrcErr.message}`);
        continue;
      }
    }

    const { error: delLinkErr } = await db.from("guide_links").delete().eq("guide_id", guideId);
    if (delLinkErr) {
      console.error(`  ✗ ${g.slug} links delete: ${delLinkErr.message}`);
      continue;
    }
    if (g.links.length > 0) {
      const { error: insLinkErr } = await db.from("guide_links").insert(
        g.links.map((l) => ({ guide_id: guideId, target_kind: l.kind, target_slug: l.slug })),
      );
      if (insLinkErr) {
        console.error(`  ✗ ${g.slug} links insert: ${insLinkErr.message}`);
        continue;
      }
    }

    ok++;
    console.log(
      `  ✓ ${g.slug} [${g.kind}/${g.status}] translations=${translationRows.length} sources=${g.sources.length} links=${g.links.length}`,
    );
  }
  console.log(`完了: ${ok}/${guides.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
