// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type Bundle,
  bundleSchema,
  buildRelationsCsvRows,
  csvStringify,
  escapeCsvField,
  expandBundle,
  groupItems,
  mergeChains,
  mergeGenres,
  mergeTags,
  parseCsv,
  planRegenre,
} from "./import-content.ts";

// -----------------------------------------------------------------------------
// CSV エスケープ
// -----------------------------------------------------------------------------
describe("escapeCsvField / csvStringify", () => {
  it("カンマを含む値を引用符で囲む", () => {
    expect(escapeCsvField("Ichiran — tonkotsu ramen, Fukuoka")).toBe('"Ichiran — tonkotsu ramen, Fukuoka"');
  });

  it("引用符を含む値は二重化して引用符で囲む", () => {
    expect(escapeCsvField('a "quoted" word')).toBe('"a ""quoted"" word"');
  });

  it("改行を含む値を引用符で囲む", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("特殊文字が無い値はそのまま返す", () => {
    expect(escapeCsvField("plain")).toBe("plain");
  });

  it("csvStringify → parseCsv で往復してカンマ・引用符・改行を壊さない", () => {
    const rows = [
      ["slug", "name_en"],
      ["kaburazushi", "fermented turnip and yellowtail sushi, Kanazawa-style"],
      ["quote-test", 'a "special" dish'],
      ["newline-test", "line1\nline2"],
    ];
    const csv = csvStringify(rows);
    const parsed = parseCsv(csv);
    expect(parsed).toEqual(rows);
  });
});

// -----------------------------------------------------------------------------
// zod: 必須/語彙違反
// -----------------------------------------------------------------------------
function minimalItem(overrides: Record<string, unknown> = {}) {
  return {
    slug: "test-item",
    name_ja: "テスト",
    name_romaji: "Tesuto",
    name_en: "Test dish",
    type: "dish",
    shelf: "noodles",
    summary_ja: "概要",
    summary_en: "summary",
    sources: [{ title: "出典", url: "https://example.com/a", accessed_at: "2026-09-07" }],
    ...overrides,
  };
}

describe("bundleSchema バリデーション", () => {
  it("空の束（全キー省略）は通る", () => {
    const r = bundleSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("items.summary_ja が無いと弾く", () => {
    const item = minimalItem();
    delete (item as Record<string, unknown>).summary_ja;
    const r = bundleSchema.safeParse({ items: [item] });
    expect(r.success).toBe(false);
  });

  it("items.slug が英大文字を含むと弾く（slug規則）", () => {
    const r = bundleSchema.safeParse({ items: [minimalItem({ slug: "Bad-Slug" })] });
    expect(r.success).toBe(false);
  });

  it("relations.relation_type が未知語彙だと弾く", () => {
    const item = minimalItem({ relations: [{ to_slug: "other", relation_type: "類似" }] });
    const r = bundleSchema.safeParse({ items: [item] });
    expect(r.success).toBe(false);
  });

  it("region.relation_type に「発祥」を指定すると弾く（束では名産地・本場のみ許可）", () => {
    const item = minimalItem({ regions: [{ pref: "石川県", relation_type: "発祥" }] });
    const r = bundleSchema.safeParse({ items: [item] });
    expect(r.success).toBe(false);
  });

  it("本場に note_ja/note_en/source_url が無いと弾く", () => {
    const item = minimalItem({ regions: [{ pref: "石川県", relation_type: "本場" }] });
    const r = bundleSchema.safeParse({ items: [item] });
    expect(r.success).toBe(false);
  });

  it("本場に note_ja/note_en/source_url が揃っていれば通る", () => {
    const item = minimalItem({
      regions: [
        {
          pref: "石川県",
          relation_type: "本場",
          note_ja: "理由",
          note_en: "reason",
          source_url: "https://example.com/honba",
        },
      ],
    });
    const r = bundleSchema.safeParse({ items: [item] });
    expect(r.success).toBe(true);
  });

  it("body_ja のみ指定して body_en が無いと弾く（両方あるか無いか整合）", () => {
    const r = bundleSchema.safeParse({ items: [minimalItem({ body_ja: "## x" })] });
    expect(r.success).toBe(false);
  });

  it("URL は http / https を許し、それ以外は弾く", () => {
    const ok = minimalItem({ sources: [{ title: "t", url: "http://example.com", accessed_at: "2026-09-07" }] });
    expect(bundleSchema.safeParse({ items: [ok] }).success).toBe(true);
    const ng = minimalItem({ sources: [{ title: "t", url: "ftp://example.com", accessed_at: "2026-09-07" }] });
    expect(bundleSchema.safeParse({ items: [ng] }).success).toBe(false);
  });

  it("items内でslugが重複すると弾く", () => {
    const r = bundleSchema.safeParse({ items: [minimalItem(), minimalItem()] });
    expect(r.success).toBe(false);
  });

  // 2026-09: primary_style をラーメン専用の固定4系統+その他から、ジャンルごとの
  // 自由テキストへ一般化（.doc/20_data/01_models.md §3.5）。
  it("items.primary_style はラーメンの4系統に限らず任意の値を許可する（洋食の系統等）", () => {
    const r = bundleSchema.safeParse({ items: [minimalItem({ primary_style: "ピザ" })] });
    expect(r.success).toBe(true);
  });

  it("items.primary_style が21文字以上だと弾く（DBのCHECK制約と揃える）", () => {
    const r = bundleSchema.safeParse({ items: [minimalItem({ primary_style: "あ".repeat(21) })] });
    expect(r.success).toBe(false);
  });

  it("items.primary_style は空文字列を値なし（undefined相当）として通す", () => {
    const r = bundleSchema.safeParse({ items: [minimalItem({ primary_style: "" })] });
    expect(r.success).toBe(true);
  });

  it("genres.type に cut を許可する", () => {
    const r = bundleSchema.safeParse({
      genres: [{ slug: "beef-cuts", name_ja: "牛肉の部位", name_en: "Beef cuts", type: "cut", shelf: "meat" }],
    });
    expect(r.success).toBe(true);
  });

  it("同一バンドル内でジャンルのshelfとitemのshelfが食い違うと弾く", () => {
    const r = bundleSchema.safeParse({
      genres: [{ slug: "sake", name_ja: "日本酒", name_en: "Sake", type: "dish", shelf: "drinks" }],
      items: [minimalItem({ genre: "sake", shelf: "noodles" })],
    });
    expect(r.success).toBe(false);
  });

  it("chains.genre_slug が無いと弾く（束ではrequired）", () => {
    const r = bundleSchema.safeParse({
      chains: [
        {
          slug: "test-chain",
          name_ja: "テストチェーン",
          name_en: "Test chain",
          bridge_ja: "橋渡し",
          bridge_en: "bridge",
          recommend: [],
        },
      ],
    });
    expect(r.success).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// 展開: ファイル群と行数
// -----------------------------------------------------------------------------
describe("expandBundle", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "atlas-expand-test-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeExistingGenres(path: string) {
    writeFileSync(
      path,
      "slug,name_ja,name_en,type,sort_order,shelf,intro_ja,intro_en\n" +
        "ramen,ラーメン,Ramen,dish,1,noodles,総論ja,総論en\n",
    );
  }
  function writeExistingTags(path: string) {
    writeFileSync(
      path,
      JSON.stringify([
        { slug: "spicy", kind: "味・特性", name_ja: "辛い", name_en: "Spicy", definition: "辛い", synonyms: [] },
      ]),
    );
  }
  function writeExistingChains(path: string) {
    writeFileSync(path, JSON.stringify({ chains: [] }));
  }

  it("genres/items/regions/item-tags/bodies/tags/chains を一括で展開し、行数が一致する", () => {
    const existingGenresPath = join(dir, "existing-genres.csv");
    const existingTagsPath = join(dir, "existing-tags.json");
    const existingChainsPath = join(dir, "existing-chains.json");
    writeExistingGenres(existingGenresPath);
    writeExistingTags(existingTagsPath);
    writeExistingChains(existingChainsPath);

    const bundle: Bundle = bundleSchema.parse({
      genres: [{ slug: "sushi", name_ja: "寿司", name_en: "Sushi", type: "dish", shelf: "rice", intro_ja: "a", intro_en: "b" }],
      tags: [
        { slug: "fermented", kind: "味・特性", name_ja: "発酵", name_en: "Fermented", definition: "発酵", synonyms: ["醸造"] },
      ],
      items: [
        minimalItem({
          slug: "kaburazushi",
          name_en: "fermented turnip sushi, Kanazawa-style",
          genre: "sushi",
          shelf: "rice",
          tags: ["fermented"],
          regions: [
            {
              pref: "石川県",
              relation_type: "名産地",
              note_ja: "金沢の正月食",
              note_en: "New Year dish",
            },
          ],
          body_ja: "## 何でできているか\nx",
          body_en: "## What it's made of\nx",
        }),
        minimalItem({
          slug: "other-item",
          shelf: "grilled",
          genre: null,
        }),
        // 本文なし × relations あり（relations.csv 経由で投入する対象。実装部隊の報告
        // 「投入スクリプトの仕上げ」対応。from_slug 省略時は自分自身が源流側になる）。
        minimalItem({
          slug: "no-body-with-relation",
          shelf: "grilled",
          genre: null,
          relations: [{ to_slug: "other-item", relation_type: "兄弟" }],
        }),
      ],
      chains: [
        {
          slug: "test-chain",
          name_ja: "テストチェーン",
          name_en: "Test chain",
          genre_slug: "sushi",
          bridge_ja: "橋渡し",
          bridge_en: "bridge",
          recommend: [],
        },
      ],
    });

    const result = expandBundle(bundle, "verify-batch", {
      contentRoot: dir,
      existingGenresCsv: existingGenresPath,
      existingTagsJson: existingTagsPath,
      existingChainsJson: existingChainsPath,
    });

    // genres.csv: 既存1件 + 新規1件 = 2件。data/genres.csv 本体（テストでは existingGenresPath）
    // 自体に書き戻す。data/content/<name>/ にはコピーを残さない（実装部隊の報告
    // 「投入スクリプトの仕上げ」対応）。
    expect(result.genres?.count).toBe(2);
    expect(result.genres?.path).toBe(existingGenresPath);
    expect(existsSync(result.genres!.path)).toBe(true);
    const genreCsvBody = parseCsv(readFileSync(result.genres!.path, "utf8")).slice(1);
    expect(genreCsvBody).toHaveLength(2);
    expect(existsSync(join(dir, "verify-batch", "genres.csv"))).toBe(false);

    // tags.json: 既存1件 + 新規1件 = 2件。同じく tags.json 本体に書き戻す
    expect(result.tags?.count).toBe(2);
    expect(result.tags?.path).toBe(existingTagsPath);
    expect(existsSync(join(dir, "verify-batch", "tags.json"))).toBe(false);

    // items: sushi/rice に1件、others/grilled に2件（本文ありのother-item + 本文なしの
    // no-body-with-relation）、計2ファイル
    expect(result.items).toHaveLength(2);
    const sushiGroup = result.items.find((i) => i.genre === "sushi");
    const othersGroup = result.items.find((i) => i.genre === null);
    expect(sushiGroup?.count).toBe(1);
    expect(othersGroup?.count).toBe(2);
    expect(othersGroup?.path.endsWith("items__others__grilled.csv")).toBe(true);

    // name_en のカンマが壊れていないこと（CSVパース結果で1フィールドのまま）
    const sushiCsvRows = parseCsv(readFileSync(sushiGroup!.path, "utf8"));
    const nameEnIdx = sushiCsvRows[0].indexOf("name_en");
    expect(sushiCsvRows[1][nameEnIdx]).toBe("fermented turnip sushi, Kanazawa-style");

    // regions.csv: 1行
    expect(result.regions?.count).toBe(1);
    // item-tags.csv: 1行
    expect(result.itemTags?.count).toBe(1);
    // bodies.json: 1件（body_ja/en 両方あるもののみ）
    expect(result.bodies?.count).toBe(1);
    const bodiesJson = JSON.parse(readFileSync(result.bodies!.path, "utf8"));
    expect(bodiesJson.items[0].slug).toBe("kaburazushi");

    // relations.csv: 本文なし×relationsありの1件のみ（本文ありのkaburazushiは
    // relationsを持たないためここでは0だが、bodies段で入る対象なのでここには含めない仕様）
    expect(result.relations?.count).toBe(1);
    const relationsCsvRows = parseCsv(readFileSync(result.relations!.path, "utf8"));
    expect(relationsCsvRows[0]).toEqual(["from_slug", "to_slug", "relation_type"]);
    expect(relationsCsvRows[1]).toEqual(["no-body-with-relation", "other-item", "兄弟"]);

    // chains.json: 既存0件 + 新規1件 = 1件。同じく chains.json 本体に書き戻す
    expect(result.chains?.count).toBe(1);
    expect(result.chains?.path).toBe(existingChainsPath);
    expect(existsSync(join(dir, "verify-batch", "chains.json"))).toBe(false);
  });

  it("bodyが無いアイテムだけの場合はbodies.jsonを作らない", () => {
    const bundle: Bundle = bundleSchema.parse({ items: [minimalItem()] });
    const result = expandBundle(bundle, "no-body-batch", { contentRoot: dir });
    expect(result.bodies).toBeUndefined();
    expect(result.regions).toBeUndefined();
    expect(result.itemTags).toBeUndefined();
    // relations が無ければ relations.csv も作らない
    expect(result.relations).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// relations.csv 行の組み立て（本文なしアイテムのみが対象。bodies段との二重投入回避）
// -----------------------------------------------------------------------------
describe("buildRelationsCsvRows", () => {
  it("本文なしアイテムの relations だけを対象にする（本文ありは bodies 段で入るため除外）", () => {
    const withBody = bundleSchema.parse({
      items: [minimalItem({ slug: "with-body", body_ja: "## x", body_en: "## x", relations: [{ to_slug: "other", relation_type: "兄弟" }] })],
    }).items[0];
    const withoutBody = bundleSchema.parse({
      items: [minimalItem({ slug: "without-body", relations: [{ to_slug: "other", relation_type: "対比" }] })],
    }).items[0];

    const rows = buildRelationsCsvRows([withBody, withoutBody]);
    expect(rows).toEqual([{ from_slug: "without-body", to_slug: "other", relation_type: "対比" }]);
  });

  it("from_slug 省略時はアイテム自身のslugを使う", () => {
    const item = bundleSchema.parse({
      items: [minimalItem({ slug: "self-slug", relations: [{ to_slug: "other", relation_type: "源流" }] })],
    }).items[0];
    expect(buildRelationsCsvRows([item])).toEqual([
      { from_slug: "self-slug", to_slug: "other", relation_type: "源流" },
    ]);
  });

  it("relations が無いアイテムからは何も作らない", () => {
    const item = bundleSchema.parse({ items: [minimalItem()] }).items[0];
    expect(buildRelationsCsvRows([item])).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// genres/tags/chains のマージ純粋関数
// -----------------------------------------------------------------------------
describe("mergeGenres / mergeTags / mergeChains", () => {
  it("既存slugは上書き、新規slugはsort_order省略時に既存最大+1を採番する", () => {
    const existing = [
      { slug: "ramen", name_ja: "ラーメン", name_en: "Ramen", type: "dish", sort_order: "1", shelf: "noodles", intro_ja: "", intro_en: "" },
      { slug: "sushi", name_ja: "寿司", name_en: "Sushi", type: "dish", sort_order: "3", shelf: "rice", intro_ja: "", intro_en: "" },
    ];
    const merged = mergeGenres(existing, [
      { slug: "ramen", name_ja: "ラーメン改", name_en: "Ramen v2", type: "dish", shelf: "noodles" },
      { slug: "sake", name_ja: "日本酒", name_en: "Sake", type: "dish", shelf: "drinks" },
    ]);
    expect(merged).toHaveLength(3);
    expect(merged.find((r) => r.slug === "ramen")?.name_en).toBe("Ramen v2");
    expect(merged.find((r) => r.slug === "sake")?.sort_order).toBe("4");
  });

  it("mergeTags は既存を保ちつつ新規を追加する", () => {
    const existing = [{ slug: "a", kind: "味・特性" as const, name_ja: "A", name_en: "A", definition: "a", synonyms: [] }];
    const merged = mergeTags(existing, [
      { slug: "b", kind: "素材", name_ja: "B", name_en: "B", definition: "b", synonyms: [] },
    ]);
    expect(merged.map((t) => t.slug)).toEqual(["a", "b"]);
  });

  it("mergeChains は同一slugを新規で上書きする", () => {
    const existing = [
      { slug: "x", name_ja: "X", name_en: "X", genre_slug: "ramen", bridge_ja: "a", bridge_en: "a", recommend: [] },
    ];
    const merged = mergeChains(existing as never, [
      { slug: "x", name_ja: "X改", name_en: "X v2", genre_slug: "ramen", bridge_ja: "b", bridge_en: "b", recommend: [] } as never,
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].name_ja).toBe("X改");
  });
});

// -----------------------------------------------------------------------------
// groupItems
// -----------------------------------------------------------------------------
describe("groupItems", () => {
  it("genre+shelf でグループ化し、ファイル名を組み立てる", () => {
    const items = [minimalItem({ slug: "a", genre: "ramen", shelf: "noodles" }), minimalItem({ slug: "b", genre: null, shelf: "meat" })];
    const parsed = items.map((i) => bundleSchema.parse({ items: [i] }).items[0]);
    const groups = groupItems(parsed);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.genre === "ramen")?.fileName).toBe("items__ramen__noodles.csv");
    expect(groups.find((g) => g.genre === null)?.fileName).toBe("items__others__meat.csv");
  });
});

// -----------------------------------------------------------------------------
// regenre の解決（DB非依存の純粋関数）
// -----------------------------------------------------------------------------
describe("planRegenre", () => {
  it("genreがnullならgenre_id=nullのみを返す（shelf_slugは変更しない）", () => {
    const { updates, missingGenres } = planRegenre([{ slug: "item-a", genre: null }], new Map());
    expect(missingGenres).toEqual([]);
    expect(updates).toEqual([{ slug: "item-a", genre_id: null }]);
  });

  it("genreが指定されていれば、そのジャンルのid/shelf_slugを継承する", () => {
    const genreBySlug = new Map([["ramen", { id: "genre-id-1", shelf_slug: "noodles" }]]);
    const { updates, missingGenres } = planRegenre([{ slug: "item-a", genre: "ramen" }], genreBySlug);
    expect(missingGenres).toEqual([]);
    expect(updates).toEqual([{ slug: "item-a", genre_id: "genre-id-1", shelf_slug: "noodles" }]);
  });

  it("存在しないジャンルslugはmissingGenresに集める", () => {
    const { updates, missingGenres } = planRegenre([{ slug: "item-a", genre: "unknown-genre" }], new Map());
    expect(updates).toEqual([]);
    expect(missingGenres).toEqual(["unknown-genre"]);
  });
});
