/**
 * コンテンツ整合性検査（content lint）。投入のたびに走らせ、体験を壊す「漏れ」を機械で出す。
 *
 * 検査項目（ia-atlas-content Skill の規律に対応）:
 *   E1 行き止まり: 名前つき関係を1本も持たないアイテム
 *   E2 三点セット欠落: name_en / ja翻訳 / en翻訳 の欠落
 *   E3 概要欠落: summary が ja/en いずれか無い
 *   E4 出典欠落: food_item_sources が0件
 *   E5 本場の理由欠落: relation_type='本場' で note_ja/note_en/座標 の欠落
 *   E6 ジャンル20件規則: 20件未満のジャンル（昇格の根拠を失っている）
 *   E7 総論欠落: genres.intro_ja/en が無いジャンル（全国区の受け皿）
 *   W1 本文（3章）未投入のアイテム数（Tier1のまま）: 集計のみ
 *   W2 チェーンを1社も持たないジャンル（橋渡し未整備）
 *   W3 本場を1件も持たない棚（料理側の本場が未整備）
 *   W4 語彙外タグ（tags テーブルに無い slug）
 *
 * 使い方: node --env-file=.env.local scripts/content-lint.ts [--strict]
 *   --strict: E項目が1件でもあれば exit 1（CI用）
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("環境変数が未設定です");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const strict = process.argv.includes("--strict");

type Row = Record<string, unknown>;
async function all(table: string, select: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function main() {
  const [items, tr, rels, srcs, regions, genres, chains, tags, itemTags] = await Promise.all([
    all("food_items", "id, slug, name_romaji, genre_id, shelf_slug, status"),
    all("food_item_translations", "food_item_id, locale, name, summary, body_md"),
    all("food_item_relations", "from_id, to_id"),
    all("food_item_sources", "food_item_id"),
    all("food_item_regions", "food_item_id, relation_type, note_ja, note_en, lat, lng"),
    all("genres", "id, slug, name_ja, intro_ja, intro_en, shelf_slug"),
    all("chains", "genre_slug"),
    all("tags", "slug"),
    all("food_item_tags", "food_item_id, tag_slug"),
  ]);
  const live = items.filter((i) => !String(i.slug).includes("fixture") && i.status === "published");
  const idToSlug = new Map(live.map((i) => [i.id as string, i.slug as string]));
  const E: Record<string, string[]> = {};
  const W: Record<string, string[]> = {};
  const push = (b: Record<string, string[]>, k: string, v: string) => (b[k] ??= []).push(v);

  const linked = new Set<string>();
  for (const r of rels) { linked.add(r.from_id as string); linked.add(r.to_id as string); }
  const trBy = new Map<string, Row[]>();
  for (const t of tr) (trBy.get(t.food_item_id as string) ?? trBy.set(t.food_item_id as string, []).get(t.food_item_id as string)!).push(t);
  const srcCount = new Map<string, number>();
  for (const s of srcs) srcCount.set(s.food_item_id as string, (srcCount.get(s.food_item_id as string) ?? 0) + 1);
  const tagSet = new Set(tags.map((t) => t.slug as string));

  let noBody = 0;
  for (const it of live) {
    const id = it.id as string, slug = it.slug as string;
    if (!linked.has(id)) push(E, "E1 行き止まり（関係0本）", slug);
    const ts = trBy.get(id) ?? [];
    const ja = ts.find((t) => t.locale === "ja"), en = ts.find((t) => t.locale === "en");
    if (!ja || !en || !en.name) push(E, "E2 三点セット欠落（ja/en名）", slug);
    if (!ja?.summary || !en?.summary) push(E, "E3 概要欠落", slug);
    if (!srcCount.get(id)) push(E, "E4 出典欠落", slug);
    if (!ja?.body_md || !en?.body_md) noBody++;
  }
  for (const r of regions) {
    if (r.relation_type === "本場" && (!r.note_ja || !r.note_en || r.lat == null))
      push(E, "E5 本場の理由/座標欠落", idToSlug.get(r.food_item_id as string) ?? String(r.food_item_id));
  }
  const perGenre = new Map<string, number>();
  for (const it of live) if (it.genre_id) perGenre.set(it.genre_id as string, (perGenre.get(it.genre_id as string) ?? 0) + 1);
  const chainGenres = new Set(chains.map((c) => c.genre_slug as string));
  for (const g of genres) {
    const n = perGenre.get(g.id as string) ?? 0;
    if (n < 20) push(E, "E6 ジャンル20件規則違反", `${g.slug}（${n}件）`);
    if (!g.intro_ja || !g.intro_en) push(E, "E7 ジャンル総論欠落", g.slug as string);
    if (!chainGenres.has(g.slug as string)) push(W, "W2 チェーン未整備のジャンル", g.slug as string);
  }
  const honbaShelves = new Set<string>();
  for (const r of regions) if (r.relation_type === "本場") { const it = live.find((i) => i.id === r.food_item_id); if (it) honbaShelves.add(it.shelf_slug as string); }
  const dishShelves = new Set(live.filter((i) => ["noodles","rice","grilled","fried","hotpot","raw","griddle","homestyle","sweets","bread"].includes(i.shelf_slug as string)).map((i) => i.shelf_slug as string));
  for (const s of dishShelves) if (!honbaShelves.has(s)) push(W, "W3 本場が1件も無い料理棚", s);
  for (const t of itemTags) if (!tagSet.has(t.tag_slug as string)) push(W, "W4 語彙外タグ", `${idToSlug.get(t.food_item_id as string)}:${t.tag_slug}`);
  W["W1 本文未投入（Tier1のまま）"] = [`${noBody}件 / ${live.length}件`];

  console.log(`対象: ${live.length}件（published・fixture除く）`);
  for (const [k, v] of Object.entries(E)) console.log(`✗ ${k}: ${v.length}件  ${v.slice(0, 12).join(", ")}${v.length > 12 ? " …" : ""}`);
  for (const [k, v] of Object.entries(W)) console.log(`△ ${k}: ${v.length === 1 && k.startsWith("W1") ? v[0] : v.length + "件  " + v.slice(0, 12).join(", ")}`);
  const errors = Object.values(E).reduce((a, b) => a + b.length, 0);
  console.log(errors ? `E合計 ${errors}件` : "E項目なし");
  if (strict && errors) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
