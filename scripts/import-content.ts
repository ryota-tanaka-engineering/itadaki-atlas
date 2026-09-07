/**
 * コンテンツ束JSON（形式v1）を1コマンドで投入する。
 *
 * 背景: JSON → scratchpadでの変換 → 4〜6本のimportスクリプトを手で順に実行、という手順を
 * 毎回手で組んでいたのを1コマンドにする。日本酒・土産・駅弁など今の形に無いカテゴリも
 * 同じ入口で足せるように、束JSONの全キーは任意（あるものだけ処理する）。
 *
 * 処理の流れ:
 *   1. 束JSON（--file）をzodで検証する
 *   2. 既存importerが受け付ける中間ファイルに展開する。
 *      genres.csv / tags.json / chains.json は **data/genres.csv・data/tags.json・
 *      data/chains.json 本体をマージ結果で書き戻す**（これらが正データ。
 *      data/content/<name>/ 側にコピーは残さない）。items__*.csv / regions.csv /
 *      item-tags.csv / bodies.json / relations.csv はバッチごとの中間ファイルとして
 *      data/content/<name>/ に書き出す
 *   3. 展開したファイルを、既存の import-*.ts を子プロセスとして順に実行して投入する:
 *      import-genres → import-tags → import-food-items（グループごと）→ regenre（インライン）
 *      → import-regions → import-item-tags → import-bodies → import-relations → import-chains
 *      どれかが非0で終了したら即座に停止する。import-relations は本文（body_ja/en）を
 *      持たないアイテムの relations のみを対象にする（本文ありの relations は
 *      bodies 段で入るため二重投入しない）
 *   4. 最後に content-lint.ts を実行して結果を表示する（--strict ではなく通常）
 *
 * 使い方:
 *   node --env-file=.env.local scripts/import-content.ts --file data/content/<name>.json
 *   node --env-file=.env.local scripts/import-content.ts --file <json> --dry-run
 *   node --env-file=.env.local scripts/import-content.ts --file <json> --only genres,tags
 *   node --env-file=.env.local scripts/import-content.ts --file <json> --skip-expand
 *
 * 本番投入は scripts/prod-env.sh 経由:
 *   bash scripts/prod-env.sh node scripts/import-content.ts --file data/content/<name>.json
 *
 * 束JSON形式（v1。全キー任意、あるものだけ処理する）:
 * {
 *   "genres":  [{ slug, name_ja, name_en, type: "dish"|"ingredient"|"cut", shelf,
 *                 sort_order?, intro_ja?, intro_en? }],
 *   "tags":    [{ slug, kind, name_ja, name_en, definition, synonyms? }],  // data/tags.json と同形
 *   "items":   [{ slug, name_ja, name_romaji, name_en, type: "dish"|"ingredient", shelf,
 *                 genre?: string|null,
 *                 origin_pref?, origin_city?, lat?, lng?, primary_style?,
 *                 summary_ja, summary_en, body_ja?, body_en?,
 *                 sources: [{ title, url, publisher?, accessed_at }],
 *                 regions?: [{ pref, city?, lat?, lng?, relation_type: "名産地"|"本場",
 *                               note_ja?, note_en?, source_url?, source_title?,
 *                               source_publisher?, source_accessed_at? }],
 *                 relations?: [{ from_slug?, to_slug,
 *                                relation_type: "源流"|"派生"|"兄弟"|"対比"|"使用食材"|"代表ネタ",
 *                                basis? }],
 *                 tags?: ["slug", ...] }],
 *   "regenre": [{ slug, genre: string|null }],  // 既存アイテムのジャンル付け替え。null=棚内その他
 *   "chains":  [ ...data/chains.json の chains[] 要素と同形（genre_slug 必須） ],
 *   "notes": "任意の自由記述（投入には使わない）"
 * }
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { PREFECTURES } from "../src/lib/prefectures.ts";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));

// -----------------------------------------------------------------------------
// 語彙・定数（既存 import-*.ts と同じ値を保つ。exportが無いため duplicate する）
// -----------------------------------------------------------------------------
const GENRE_TYPES = ["dish", "ingredient", "cut"] as const;
const TAG_KINDS = ["味・特性", "素材", "調理", "形状・食べ方", "場面", "系譜"] as const;
const ITEM_TYPES = ["dish", "ingredient"] as const;
const PRIMARY_STYLES = ["醤油", "味噌", "塩", "豚骨", "その他"] as const;
const ITEM_RELATION_TYPES = ["源流", "派生", "兄弟", "対比", "使用食材", "代表ネタ"] as const;
const REGION_RELATION_TYPES = ["名産地", "本場"] as const;

const STEP_NAMES = [
  "genres",
  "tags",
  "items",
  "regenre",
  "regions",
  "item-tags",
  "bodies",
  "relations",
  "chains",
] as const;
type StepName = (typeof STEP_NAMES)[number];

// -----------------------------------------------------------------------------
// zod スキーマ
// -----------------------------------------------------------------------------
const slugField = (pattern: RegExp, message: string) => z.string().trim().min(1, "必須").regex(pattern, message);
const SLUG_RE = /^[a-z0-9-]+$/;
const SLUG_MSG = "英小文字・数字・ハイフンのみ";
const TAG_SLUG_RE = /^[a-z0-9_-]+$/;
const TAG_SLUG_MSG = "英小文字・数字・ハイフン・アンダースコアのみ";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const httpsUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => u.startsWith("https://"), { message: "https 形式のURLのみ" });

const prefField = z
  .string()
  .trim()
  .refine((v) => (PREFECTURES as readonly string[]).includes(v), {
    message: "都道府県名マスタに一致しません",
  });

// 「空欄=値なし」の慣習（DISH_RULES.md: 発祥地が特定できないものは空欄=図鑑枠）を束JSONは
// キー省略ではなく空文字列で表す実例がある（研究部隊のPython生成物はキーを常に持つため）。
// 任意項目は "" もキー省略も等しく「値なし」として扱う。数値項目も "" は未入力扱いにする。
const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalTrimmed = () => z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());
const optionalRaw = () => z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalDate = () => z.preprocess(emptyToUndefined, z.string().trim().regex(DATE_RE, "YYYY-MM-DD 形式").optional());
const optionalCoord = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), z.number().min(min).max(max).optional());
const optionalHttps = () => z.preprocess(emptyToUndefined, httpsUrl.optional());
const optionalPref = () => z.preprocess(emptyToUndefined, z.string().trim().optional());
const optionalSlug = () => z.preprocess(emptyToUndefined, slugField(SLUG_RE, SLUG_MSG).optional());
const nullableSlug = () =>
  z.preprocess((v) => (v === "" ? null : v), slugField(SLUG_RE, SLUG_MSG).nullable());

const sourceSchema = z.object({
  title: z.string().trim().min(1, "必須"),
  url: httpsUrl,
  publisher: optionalTrimmed(),
  accessed_at: z.string().trim().regex(DATE_RE, "YYYY-MM-DD 形式"),
});

const genreSchema = z.object({
  slug: slugField(SLUG_RE, SLUG_MSG),
  name_ja: z.string().trim().min(1),
  name_en: z.string().trim().min(1),
  type: z.enum(GENRE_TYPES),
  shelf: slugField(SLUG_RE, SLUG_MSG),
  sort_order: z.number().int().optional(),
  intro_ja: optionalTrimmed(),
  intro_en: optionalTrimmed(),
});

const tagSchema = z.object({
  slug: slugField(TAG_SLUG_RE, TAG_SLUG_MSG),
  kind: z.enum(TAG_KINDS),
  name_ja: z.string().trim().min(1),
  name_en: z.string().trim().min(1),
  definition: z.string().trim().min(1),
  synonyms: z.array(z.string().trim().min(1)).default([]),
});

const regionSchema = z
  .object({
    pref: prefField,
    city: optionalTrimmed(),
    lat: optionalCoord(20, 46),
    lng: optionalCoord(122, 154),
    relation_type: z.enum(REGION_RELATION_TYPES),
    note_ja: optionalTrimmed(),
    note_en: optionalTrimmed(),
    source_url: optionalHttps(),
    source_title: optionalTrimmed(),
    source_publisher: optionalTrimmed(),
    source_accessed_at: optionalDate(),
  })
  .superRefine((r, ctx) => {
    if ((r.lat === undefined) !== (r.lng === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "lat と lng は両方入れるか両方空にする",
        path: ["lat"],
      });
    }
    if (r.relation_type === "本場") {
      if (!r.note_ja || !r.note_en) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "本場には note_ja/note_en（構造的理由の一文）が必須です",
          path: ["note_ja"],
        });
      }
      if (!r.source_url) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "本場には source_url が必須です",
          path: ["source_url"],
        });
      }
    }
  });

const itemRelationSchema = z.object({
  from_slug: optionalSlug(),
  to_slug: slugField(SLUG_RE, SLUG_MSG),
  relation_type: z.enum(ITEM_RELATION_TYPES),
  basis: optionalTrimmed(),
});

const itemSchema = z
  .object({
    slug: slugField(SLUG_RE, SLUG_MSG),
    name_ja: z.string().trim().min(1, "必須（三点セット）"),
    name_romaji: z.string().trim().min(1, "必須（三点セット）"),
    name_en: z.string().trim().min(1, "必須（三点セット・説明訳）"),
    type: z.enum(ITEM_TYPES),
    shelf: slugField(SLUG_RE, SLUG_MSG),
    genre: nullableSlug().optional(),
    origin_pref: optionalPref(),
    origin_city: optionalTrimmed(),
    lat: optionalCoord(20, 46),
    lng: optionalCoord(122, 154),
    primary_style: z.preprocess(emptyToUndefined, z.enum(PRIMARY_STYLES).optional()),
    summary_ja: z.string().trim().min(1, "必須"),
    summary_en: z.string().trim().min(1, "必須"),
    body_ja: optionalRaw(),
    body_en: optionalRaw(),
    sources: z.array(sourceSchema).min(1, "出典は1件以上必須"),
    regions: z.array(regionSchema).default([]),
    relations: z.array(itemRelationSchema).default([]),
    tags: z.array(slugField(TAG_SLUG_RE, TAG_SLUG_MSG)).default([]),
  })
  .superRefine((it, ctx) => {
    if ((it.lat === undefined) !== (it.lng === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "lat と lng は両方入れるか両方空にする",
        path: ["lat"],
      });
    }
    if (it.origin_pref !== undefined && !(PREFECTURES as readonly string[]).includes(it.origin_pref)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "都道府県名マスタに一致しません",
        path: ["origin_pref"],
      });
    }
    if ((it.body_ja === undefined) !== (it.body_en === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "body_ja と body_en は両方入れるか両方空にする（3章一字一句の検証は import-bodies.ts が行う）",
        path: ["body_ja"],
      });
    }
  });

const regenreSchema = z.object({
  slug: slugField(SLUG_RE, SLUG_MSG),
  genre: nullableSlug(),
});

const recommendSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("style"), value: z.string().trim().min(1) }),
  z.object({ kind: z.literal("item"), slug: z.string().trim().min(1) }),
]);

const chainSchema = z.object({
  slug: slugField(SLUG_RE, SLUG_MSG),
  name_ja: z.string().trim().min(1, "必須"),
  name_en: z.string().trim().min(1, "必須"),
  founded: optionalTrimmed(),
  style: optionalTrimmed(),
  style_ja: optionalTrimmed(),
  style_en: optionalTrimmed(),
  genre_slug: slugField(SLUG_RE, SLUG_MSG),
  bridge_ja: z.string().trim().min(1, "必須"),
  bridge_en: z.string().trim().min(1, "必須"),
  recommend: z.array(recommendSchema).default([]),
  source_url: optionalHttps(),
  source_note: optionalTrimmed(),
});

export const bundleSchema = z
  .object({
    genres: z.array(genreSchema).default([]),
    tags: z.array(tagSchema).default([]),
    items: z.array(itemSchema).default([]),
    regenre: z.array(regenreSchema).default([]),
    chains: z.array(chainSchema).default([]),
    notes: z.string().optional(),
  })
  .superRefine((b, ctx) => {
    const dup = (label: string, slugs: string[], path: string) => {
      const seen = new Set<string>();
      const dupes = new Set<string>();
      for (const s of slugs) {
        if (seen.has(s)) dupes.add(s);
        seen.add(s);
      }
      if (dupes.size > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} 内で重複: ${[...dupes].join(", ")}`,
          path: [path],
        });
      }
    };
    dup("genres", b.genres.map((g) => g.slug), "genres");
    dup("tags", b.tags.map((t) => t.slug), "tags");
    dup("items", b.items.map((i) => i.slug), "items");
    dup("chains", b.chains.map((c) => c.slug), "chains");
    dup("regenre", b.regenre.map((r) => r.slug), "regenre");

    // items[].shelf は、同一バンドル内で定義されたジャンルの shelf と食い違ってはいけない
    // （genre 指定時、実際の投入は genre の shelf_slug を継承するため。DB既存ジャンルとの
    //  食い違いはオフラインでは検証できず、DB接続を要する投入時に initが検出する）。
    const genreShelfBySlug = new Map(b.genres.map((g) => [g.slug, g.shelf]));
    b.items.forEach((it, idx) => {
      if (it.genre) {
        const expected = genreShelfBySlug.get(it.genre);
        if (expected && expected !== it.shelf) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `items[${idx}] (${it.slug}) の shelf "${it.shelf}" がジャンル "${it.genre}" の shelf "${expected}" と一致しません`,
            path: ["items", idx, "shelf"],
          });
        }
      }
    });
  });

export type Bundle = z.infer<typeof bundleSchema>;
export type ItemInput = z.infer<typeof itemSchema>;
export type GenreInput = z.infer<typeof genreSchema>;
export type TagInput = z.infer<typeof tagSchema>;
export type ChainInput = z.infer<typeof chainSchema>;
export type RegenreEntry = z.infer<typeof regenreSchema>;

// -----------------------------------------------------------------------------
// CSV（RFC4180: 引用符・埋め込みカンマ・改行に対応。既存 import-*.ts と同一実装）
// -----------------------------------------------------------------------------
export function parseCsv(text: string): string[][] {
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

/** RFC4180: カンマ・引用符・改行を含む場合のみ引用符で囲み、内部の引用符は二重化する。 */
export function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function csvStringify(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\n") + "\n";
}

// -----------------------------------------------------------------------------
// 展開: genres.csv / tags.json / items__*.csv / regions.csv / item-tags.csv /
//       bodies.json / chains.json を data/content/<name>/ に書き出す
// -----------------------------------------------------------------------------
const GENRE_HEADER = ["slug", "name_ja", "name_en", "type", "sort_order", "shelf", "intro_ja", "intro_en"] as const;
export type GenreRow = Record<(typeof GENRE_HEADER)[number], string>;

const ITEM_HEADER = [
  "slug",
  "name_ja",
  "name_romaji",
  "name_en",
  "origin_pref",
  "origin_city",
  "lat",
  "lng",
  "primary_style",
  "type",
  "summary_ja",
  "summary_en",
  "source_title",
  "source_url",
  "source_publisher",
  "source_accessed_at",
] as const;

const REGION_HEADER = [
  "item_slug",
  "pref",
  "city",
  "lat",
  "lng",
  "relation_type",
  "note_ja",
  "note_en",
  "source_url",
  "source_title",
  "source_publisher",
  "source_accessed_at",
] as const;
export type RegionRow = Record<(typeof REGION_HEADER)[number], string>;

export interface TagRow {
  slug: string;
  kind: string;
  name_ja: string;
  name_en: string;
  definition: string;
  synonyms: string[];
}

export interface ItemGroup {
  genre: string | null;
  shelf: string;
  fileName: string;
  rows: ItemInput[];
}

export function groupItems(items: ItemInput[]): ItemGroup[] {
  const map = new Map<string, ItemGroup>();
  for (const it of items) {
    const genre = it.genre ?? null;
    const key = `${genre ?? ""}::${it.shelf}`;
    let group = map.get(key);
    if (!group) {
      group = { genre, shelf: it.shelf, fileName: `items__${genre ?? "others"}__${it.shelf}.csv`, rows: [] };
      map.set(key, group);
    }
    group.rows.push(it);
  }
  return [...map.values()];
}

function itemToRow(item: ItemInput): string[] {
  const src = item.sources[0];
  return [
    item.slug,
    item.name_ja,
    item.name_romaji,
    item.name_en,
    item.origin_pref ?? "",
    item.origin_city ?? "",
    item.lat !== undefined ? String(item.lat) : "",
    item.lng !== undefined ? String(item.lng) : "",
    item.primary_style ?? "",
    item.type,
    item.summary_ja,
    item.summary_en,
    src.title,
    src.url,
    src.publisher ?? "",
    src.accessed_at,
  ];
}

export function regionRows(items: ItemInput[]): RegionRow[] {
  const out: RegionRow[] = [];
  for (const it of items) {
    for (const r of it.regions) {
      out.push({
        item_slug: it.slug,
        pref: r.pref,
        city: r.city ?? "",
        lat: r.lat !== undefined ? String(r.lat) : "",
        lng: r.lng !== undefined ? String(r.lng) : "",
        relation_type: r.relation_type,
        note_ja: r.note_ja ?? "",
        note_en: r.note_en ?? "",
        source_url: r.source_url ?? "",
        source_title: r.source_title ?? "",
        source_publisher: r.source_publisher ?? "",
        source_accessed_at: r.source_accessed_at ?? "",
      });
    }
  }
  return out;
}

export function itemTagRows(items: ItemInput[]): { item_slug: string; tag_slug: string }[] {
  const out: { item_slug: string; tag_slug: string }[] = [];
  for (const it of items) for (const t of it.tags) out.push({ item_slug: it.slug, tag_slug: t });
  return out;
}

export interface BodyItem {
  slug: string;
  body_ja: string;
  body_en: string;
  sources: { title: string; url: string; publisher?: string; accessed_at: string }[];
  relations: { from_slug: string; to_slug: string; relation_type: string; basis?: string }[];
}

export function buildBodies(items: ItemInput[]): BodyItem[] {
  return items
    .filter((it): it is ItemInput & { body_ja: string; body_en: string } => it.body_ja !== undefined && it.body_en !== undefined)
    .map((it) => ({
      slug: it.slug,
      body_ja: it.body_ja,
      body_en: it.body_en,
      sources: it.sources.map((s) => ({ title: s.title, url: s.url, publisher: s.publisher, accessed_at: s.accessed_at })),
      relations: it.relations.map((r) => ({
        from_slug: r.from_slug ?? it.slug,
        to_slug: r.to_slug,
        relation_type: r.relation_type,
        basis: r.basis,
      })),
    }));
}

/**
 * relations.csv（import-relations.ts 用。from_slug,to_slug,relation_type）の行を作る。
 *
 * **本文（body_ja/en）を持たないアイテムの relations のみ**が対象。本文ありのアイテムの
 * relations は bodies 段（buildBodies）で一緒に入るため、ここに含めると二重投入になる。
 * basis は import-relations.ts のCSV形式に列が無く、bodies経路でもDBには保存されない
 * （import-bodies.ts 参照）ため、ここでも持たせない。
 */
export function buildRelationsCsvRows(items: ItemInput[]): { from_slug: string; to_slug: string; relation_type: string }[] {
  const out: { from_slug: string; to_slug: string; relation_type: string }[] = [];
  for (const it of items) {
    if (it.body_ja !== undefined) continue; // 本文ありは bodies 段で入る
    for (const r of it.relations) {
      out.push({ from_slug: r.from_slug ?? it.slug, to_slug: r.to_slug, relation_type: r.relation_type });
    }
  }
  return out;
}

export function mergeGenres(existing: GenreRow[], newGenres: GenreInput[]): GenreRow[] {
  const rows = existing.map((r) => ({ ...r }));
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  let maxSort = rows.reduce((m, r) => Math.max(m, Number(r.sort_order) || 0), 0);
  for (const g of newGenres) {
    const existingRow = bySlug.get(g.slug);
    const sortOrder =
      g.sort_order !== undefined ? g.sort_order : existingRow ? Number(existingRow.sort_order) : ++maxSort;
    const row: GenreRow = {
      slug: g.slug,
      name_ja: g.name_ja,
      name_en: g.name_en,
      type: g.type,
      sort_order: String(sortOrder),
      shelf: g.shelf,
      intro_ja: g.intro_ja ?? existingRow?.intro_ja ?? "",
      intro_en: g.intro_en ?? existingRow?.intro_en ?? "",
    };
    if (existingRow) {
      Object.assign(existingRow, row);
    } else {
      rows.push(row);
      bySlug.set(g.slug, row);
    }
  }
  return rows;
}

export function mergeTags(existing: TagRow[], newTags: TagInput[]): TagRow[] {
  const order = existing.map((t) => t.slug);
  const bySlug = new Map(existing.map((t) => [t.slug, { ...t }]));
  for (const t of newTags) {
    if (!bySlug.has(t.slug)) order.push(t.slug);
    bySlug.set(t.slug, {
      slug: t.slug,
      kind: t.kind,
      name_ja: t.name_ja,
      name_en: t.name_en,
      definition: t.definition,
      synonyms: t.synonyms,
    });
  }
  return order.map((s) => bySlug.get(s)!);
}

export function mergeChains(existing: ChainInput[], newChains: ChainInput[]): ChainInput[] {
  const order = existing.map((c) => c.slug);
  const bySlug = new Map(existing.map((c) => [c.slug, c]));
  for (const c of newChains) {
    if (!bySlug.has(c.slug)) order.push(c.slug);
    bySlug.set(c.slug, c);
  }
  return order.map((s) => bySlug.get(s)!);
}

function readExistingGenres(csvPath: string): GenreRow[] {
  if (!existsSync(csvPath)) return [];
  const [header, ...body] = parseCsv(readFileSync(csvPath, "utf8"));
  return body.map((cells) => {
    const obj = {} as GenreRow;
    header.forEach((h, i) => {
      (obj as Record<string, string>)[h.trim()] = cells[i] ?? "";
    });
    return obj;
  });
}

function readExistingTags(jsonPath: string): TagRow[] {
  if (!existsSync(jsonPath)) return [];
  return JSON.parse(readFileSync(jsonPath, "utf8")) as TagRow[];
}

function readExistingChains(jsonPath: string): ChainInput[] {
  if (!existsSync(jsonPath)) return [];
  const raw = JSON.parse(readFileSync(jsonPath, "utf8")) as { chains: ChainInput[] };
  return raw.chains ?? [];
}

export interface ExpandFileInfo {
  path: string;
  count: number;
}

export interface ExpandResult {
  contentDir: string;
  genres?: ExpandFileInfo;
  tags?: ExpandFileInfo;
  items: (ExpandFileInfo & { genre: string | null; shelf: string })[];
  regions?: ExpandFileInfo;
  itemTags?: ExpandFileInfo;
  bodies?: ExpandFileInfo;
  /** 本文を持たないアイテムの relations のみ（bodies 段と二重投入しないため）。 */
  relations?: ExpandFileInfo;
  chains?: ExpandFileInfo;
}

export interface ExpandPaths {
  contentRoot?: string;
  existingGenresCsv?: string;
  existingTagsJson?: string;
  existingChainsJson?: string;
}

export function expandBundle(bundle: Bundle, name: string, paths: ExpandPaths = {}): ExpandResult {
  const contentDir = join(paths.contentRoot ?? "data/content", name);
  mkdirSync(contentDir, { recursive: true });
  const result: ExpandResult = { contentDir, items: [] };

  if (bundle.genres.length > 0) {
    // data/genres.csv 本体をマージ結果で書き戻す（正データ。data/content/<name>/ には
    // コピーを残さない。実装部隊の報告「投入スクリプトの仕上げ」対応）。
    const canonicalPath = paths.existingGenresCsv ?? "data/genres.csv";
    const existing = readExistingGenres(canonicalPath);
    const merged = mergeGenres(existing, bundle.genres);
    const rows = merged.map((r) => GENRE_HEADER.map((h) => r[h]));
    writeFileSync(canonicalPath, csvStringify([[...GENRE_HEADER], ...rows]));
    result.genres = { path: canonicalPath, count: merged.length };
  }

  if (bundle.tags.length > 0) {
    // data/tags.json 本体をマージ結果で書き戻す（正データ。同上）。
    const canonicalPath = paths.existingTagsJson ?? "data/tags.json";
    const existing = readExistingTags(canonicalPath);
    const merged = mergeTags(existing, bundle.tags);
    writeFileSync(canonicalPath, JSON.stringify(merged, null, 2));
    result.tags = { path: canonicalPath, count: merged.length };
  }

  if (bundle.items.length > 0) {
    const groups = groupItems(bundle.items);
    for (const g of groups) {
      const rows = g.rows.map((it) => itemToRow(it));
      const filePath = join(contentDir, g.fileName);
      writeFileSync(filePath, csvStringify([[...ITEM_HEADER], ...rows]));
      result.items.push({ path: filePath, count: g.rows.length, genre: g.genre, shelf: g.shelf });
    }

    const regionRowsFlat = regionRows(bundle.items);
    if (regionRowsFlat.length > 0) {
      const rows = regionRowsFlat.map((r) => REGION_HEADER.map((h) => r[h]));
      const filePath = join(contentDir, "regions.csv");
      writeFileSync(filePath, csvStringify([[...REGION_HEADER], ...rows]));
      result.regions = { path: filePath, count: regionRowsFlat.length };
    }

    const itemTagRowsFlat = itemTagRows(bundle.items);
    if (itemTagRowsFlat.length > 0) {
      const rows = itemTagRowsFlat.map((r) => [r.item_slug, r.tag_slug]);
      const filePath = join(contentDir, "item-tags.csv");
      writeFileSync(filePath, csvStringify([["item_slug", "tag_slug"], ...rows]));
      result.itemTags = { path: filePath, count: itemTagRowsFlat.length };
    }

    const bodiesItems = buildBodies(bundle.items);
    if (bodiesItems.length > 0) {
      const filePath = join(contentDir, "bodies.json");
      writeFileSync(filePath, JSON.stringify({ items: bodiesItems }, null, 2));
      result.bodies = { path: filePath, count: bodiesItems.length };
    }

    const relationsRows = buildRelationsCsvRows(bundle.items);
    if (relationsRows.length > 0) {
      const rows = relationsRows.map((r) => [r.from_slug, r.to_slug, r.relation_type]);
      const filePath = join(contentDir, "relations.csv");
      writeFileSync(filePath, csvStringify([["from_slug", "to_slug", "relation_type"], ...rows]));
      result.relations = { path: filePath, count: relationsRows.length };
    }
  }

  if (bundle.chains.length > 0) {
    // data/chains.json 本体をマージ結果で書き戻す（正データ。同上）。
    const canonicalPath = paths.existingChainsJson ?? "data/chains.json";
    const existing = readExistingChains(canonicalPath);
    const merged = mergeChains(existing, bundle.chains);
    writeFileSync(canonicalPath, JSON.stringify({ chains: merged }, null, 2));
    result.chains = { path: canonicalPath, count: merged.length };
  }

  return result;
}

// -----------------------------------------------------------------------------
// regenre（インライン。既存importerが無いためSupabaseクライアントで直接更新する）
// -----------------------------------------------------------------------------
export interface RegenrePlanResult {
  updates: { slug: string; genre_id: string | null; shelf_slug?: string }[];
  missingGenres: string[];
}

export function planRegenre(
  entries: RegenreEntry[],
  genreBySlug: Map<string, { id: string; shelf_slug: string }>,
): RegenrePlanResult {
  const missingGenres = new Set<string>();
  const updates: RegenrePlanResult["updates"] = [];
  for (const e of entries) {
    if (e.genre === null) {
      updates.push({ slug: e.slug, genre_id: null });
      continue;
    }
    const g = genreBySlug.get(e.genre);
    if (!g) {
      missingGenres.add(e.genre);
      continue;
    }
    updates.push({ slug: e.slug, genre_id: g.id, shelf_slug: g.shelf_slug });
  }
  return { updates, missingGenres: [...missingGenres] };
}

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("環境変数が未設定です（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）");
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function runRegenreStep(entries: RegenreEntry[]): Promise<void> {
  console.log(`\n=== regenre (${entries.length}件) ===`);
  const db = createSupabaseClient();
  const itemSlugs = [...new Set(entries.map((e) => e.slug))];
  const genreSlugs = [...new Set(entries.map((e) => e.genre).filter((g): g is string => g !== null))];

  const { data: items, error: itemsErr } = await db.from("food_items").select("id, slug").in("slug", itemSlugs);
  if (itemsErr) throw new Error(itemsErr.message);
  const foundSlugs = new Set((items ?? []).map((i) => i.slug as string));
  const missingItems = itemSlugs.filter((s) => !foundSlugs.has(s));
  if (missingItems.length > 0) {
    console.error(`存在しない food_items slug: ${missingItems.join(", ")}`);
    process.exit(1);
  }

  let genreRows: { id: string; slug: string; shelf_slug: string }[] = [];
  if (genreSlugs.length > 0) {
    const { data, error } = await db.from("genres").select("id, slug, shelf_slug").in("slug", genreSlugs);
    if (error) throw new Error(error.message);
    genreRows = (data ?? []) as { id: string; slug: string; shelf_slug: string }[];
  }
  const genreBySlug = new Map(genreRows.map((g) => [g.slug, { id: g.id, shelf_slug: g.shelf_slug }]));
  const { updates, missingGenres } = planRegenre(entries, genreBySlug);
  if (missingGenres.length > 0) {
    console.error(`存在しない genres slug: ${missingGenres.join(", ")}`);
    process.exit(1);
  }

  let ok = 0;
  for (const u of updates) {
    const payload: { genre_id: string | null; shelf_slug?: string } = { genre_id: u.genre_id };
    if (u.shelf_slug) payload.shelf_slug = u.shelf_slug;
    const { error } = await db.from("food_items").update(payload).eq("slug", u.slug);
    if (error) {
      console.error(`  ✗ ${u.slug}: ${error.message}`);
      continue;
    }
    ok++;
    console.log(`  ✓ ${u.slug} → genre_id=${u.genre_id ?? "(なし)"}`);
  }
  console.log(`完了: ${ok}/${updates.length}`);
}

// -----------------------------------------------------------------------------
// 子プロセス実行
// -----------------------------------------------------------------------------
function runNodeScript(label: string, scriptName: string, args: string[], opts: { cwd?: string } = {}): void {
  console.log(`\n=== ${label} ===`);
  const scriptPath = join(SCRIPTS_DIR, scriptName);
  const res = spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: "inherit",
    env: process.env,
    cwd: opts.cwd,
  });
  if (res.error) {
    console.error(`✗ ${label} の起動に失敗しました: ${res.error.message}`);
    process.exit(1);
  }
  if (res.status !== 0) {
    console.error(`\n✗ ${label} で失敗しました（exit ${res.status}）。ここで停止します。`);
    process.exit(res.status ?? 1);
  }
}

/**
 * import-chains.ts は --file を受け付けず、常に cwd 相対の "data/chains.json" を読む。
 * data/chains.json 本体は展開段階（expandBundle）で既にマージ結果に書き換え済み
 * （正データ。data/content/<name>/ にはコピーを残さない）ため、複製は不要で
 * そのまま子プロセスを起動するだけでよい。
 */
function runChainsStep(chainsPath: string): void {
  const merged = JSON.parse(readFileSync(chainsPath, "utf8")) as { chains: unknown[] };
  console.log(`\n=== chains (${merged.chains.length}件) ===`);
  runNodeScript("import-chains", "import-chains.ts", []);
}

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const file = arg("file");
  const dryRun = hasFlag("dry-run");
  const skipExpand = hasFlag("skip-expand");
  const onlyRaw = arg("only");

  if (!file) {
    console.error(
      "使い方: node --env-file=.env.local scripts/import-content.ts --file data/content/<name>.json\n" +
        "      [--dry-run] [--only genres,tags,items,regenre,regions,item-tags,bodies,relations,chains] [--skip-expand]",
    );
    process.exit(1);
  }

  let only: StepName[] | null = null;
  if (onlyRaw) {
    const requested = onlyRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const unknown = requested.filter((s) => !(STEP_NAMES as readonly string[]).includes(s));
    if (unknown.length > 0) {
      console.error(`未知の段名: ${unknown.join(", ")}（有効: ${STEP_NAMES.join(", ")}）`);
      process.exit(1);
    }
    only = requested as StepName[];
  }

  if (!existsSync(file)) {
    console.error(`ファイルが見つかりません: ${file}`);
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const parsed = bundleSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("バリデーションエラー:");
    console.error(parsed.error.issues.map((x) => `  [${x.path.join(".") || "-"}] ${x.message}`).join("\n"));
    console.error("\n1件でも不正なら投入しない。修正して再実行してください。");
    process.exit(1);
  }
  const bundle = parsed.data;
  const name = basename(file, extname(file));
  const contentDir = join("data/content", name);

  console.log(
    `読み込み: genres ${bundle.genres.length} / tags ${bundle.tags.length} / items ${bundle.items.length} / ` +
      `regenre ${bundle.regenre.length} / chains ${bundle.chains.length}`,
  );

  if (!skipExpand) {
    const result = expandBundle(bundle, name);
    console.log(`\n展開先: ${result.contentDir}`);
    if (result.genres) console.log(`  ${result.genres.path}: ${result.genres.count}行（既存とマージ後の総数。本体を書き戻し済み）`);
    if (result.tags) console.log(`  ${result.tags.path}: ${result.tags.count}件（既存とマージ後の総数。本体を書き戻し済み）`);
    for (const it of result.items) console.log(`  ${basename(it.path)}: ${it.count}件`);
    if (result.regions) console.log(`  regions.csv: ${result.regions.count}行`);
    if (result.itemTags) console.log(`  item-tags.csv: ${result.itemTags.count}行`);
    if (result.bodies) console.log(`  bodies.json: ${result.bodies.count}件`);
    if (result.relations) console.log(`  relations.csv: ${result.relations.count}行（本文なしアイテムのみ）`);
    if (result.chains) console.log(`  ${result.chains.path}: ${result.chains.count}件（既存とマージ後の総数。本体を書き戻し済み）`);
  } else {
    if (!existsSync(contentDir)) {
      console.error(`--skip-expand ですが展開済みディレクトリがありません: ${contentDir}`);
      process.exit(1);
    }
    console.log(`\n--skip-expand: 展開をスキップし ${contentDir} をそのまま使用します`);
  }

  if (dryRun) {
    console.log("\n--dry-run のため投入しません。");
    return;
  }

  const shouldRun = (step: StepName) => (only ? only.includes(step) : true);
  const skipNote = (step: StepName) => {
    if (only?.includes(step)) console.log(`\n=== ${step} ===\n  (スキップ: 対象データなし)`);
  };

  if (shouldRun("genres")) {
    if (bundle.genres.length > 0) {
      // data/genres.csv 本体（展開段階で既にマージ結果に書き換え済み。正データ）を読む。
      runNodeScript("import-genres", "import-genres.ts", ["--file", "data/genres.csv"]);
    } else skipNote("genres");
  }
  if (shouldRun("tags")) {
    if (bundle.tags.length > 0) {
      // data/tags.json 本体（同上）を読む。
      runNodeScript("import-tags", "import-tags.ts", ["--file", "data/tags.json"]);
    } else skipNote("tags");
  }
  if (shouldRun("items")) {
    if (bundle.items.length > 0) {
      const groups = groupItems(bundle.items);
      for (const g of groups) {
        const target = g.genre ? ["--genre", g.genre] : ["--shelf", g.shelf];
        runNodeScript(`import-food-items (${g.fileName})`, "import-food-items.ts", [
          "--file",
          join(contentDir, g.fileName),
          ...target,
          "--publish",
        ]);
      }
    } else skipNote("items");
  }
  if (shouldRun("regenre")) {
    if (bundle.regenre.length > 0) {
      await runRegenreStep(bundle.regenre);
    } else skipNote("regenre");
  }
  if (shouldRun("regions")) {
    if (bundle.items.some((it) => it.regions.length > 0)) {
      runNodeScript("import-regions", "import-regions.ts", ["--file", join(contentDir, "regions.csv")]);
    } else skipNote("regions");
  }
  if (shouldRun("item-tags")) {
    if (bundle.items.some((it) => it.tags.length > 0)) {
      runNodeScript("import-item-tags", "import-item-tags.ts", ["--file", join(contentDir, "item-tags.csv")]);
    } else skipNote("item-tags");
  }
  if (shouldRun("bodies")) {
    if (bundle.items.some((it) => it.body_ja !== undefined && it.body_en !== undefined)) {
      runNodeScript("import-bodies", "import-bodies.ts", ["--file", join(contentDir, "bodies.json")]);
    } else skipNote("bodies");
  }
  if (shouldRun("relations")) {
    // 本文なし × relations あり のアイテムのみが対象（本文ありは bodies 段で入る）。
    if (bundle.items.some((it) => it.body_ja === undefined && it.relations.length > 0)) {
      runNodeScript("import-relations", "import-relations.ts", ["--file", join(contentDir, "relations.csv")]);
    } else skipNote("relations");
  }
  if (shouldRun("chains")) {
    if (bundle.chains.length > 0) {
      // data/chains.json 本体（展開段階で既にマージ結果に書き換え済み。正データ）を読む。
      runChainsStep("data/chains.json");
    } else skipNote("chains");
  }

  runNodeScript("content-lint", "content-lint.ts", []);

  console.log("\n完了しました。");
}

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href : false;
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
