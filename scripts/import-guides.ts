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
 * links（genre/shelf/tag への参照）は投入前に全件、参照先の存在を検証する。
 * 1件でも欠けていたら何も書き込まずに落とす（黙って握りつぶさない。import-chains.ts と同じ方針）。
 *
 * 使い方: node --env-file=.env.local scripts/import-guides.ts --file data/guides.json [--dry-run]
 *
 * 接続先は .env.local の NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY。
 * service_role key は RLS をバイパスするため、サーバー側でのみ使う（.doc/10_system/06_security.md）。
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

import { guidesFileSchema, type GuideImportRow } from "../src/features/guide/schemas.ts";

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

  // links の参照先（genre/shelf/tag）が実在するか、全件を事前に検証する。
  // 1件でも欠けていたら何も書き込まずに落とす。
  const slugsOf = (kind: GuideImportRow["links"][number]["kind"]) =>
    [...new Set(guides.flatMap((g) => g.links.filter((l) => l.kind === kind).map((l) => l.slug)))];
  const genreSlugs = slugsOf("genre");
  const shelfSlugs = slugsOf("shelf");
  const tagSlugs = slugsOf("tag");

  const [{ data: genres, error: genresErr }, { data: shelves, error: shelvesErr }, { data: tags, error: tagsErr }] =
    await Promise.all([
      genreSlugs.length
        ? db.from("genres").select("slug").in("slug", genreSlugs)
        : Promise.resolve({ data: [] as { slug: string }[], error: null }),
      shelfSlugs.length
        ? db.from("shelves").select("slug").in("slug", shelfSlugs)
        : Promise.resolve({ data: [] as { slug: string }[], error: null }),
      tagSlugs.length
        ? db.from("tags").select("slug").in("slug", tagSlugs)
        : Promise.resolve({ data: [] as { slug: string }[], error: null }),
    ]);
  if (genresErr) throw new Error(genresErr.message);
  if (shelvesErr) throw new Error(shelvesErr.message);
  if (tagsErr) throw new Error(tagsErr.message);

  const existing = {
    genre: new Set((genres ?? []).map((x) => x.slug)),
    shelf: new Set((shelves ?? []).map((x) => x.slug)),
    tag: new Set((tags ?? []).map((x) => x.slug)),
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
        { slug: g.slug, kind: g.kind, sort_order: g.sort_order, status: g.status },
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
