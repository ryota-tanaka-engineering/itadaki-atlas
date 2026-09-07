# 束 JSON（content bundle v1）— `scripts/import-content.ts` の入力

全キー任意。あるものだけ投入される。1ファイル＝1回の追加。リポジトリ `data/content/<name>.json` が正データ（展開された CSV/JSON は `data/content/<name>/` に生成され、これも追跡する）。

```jsonc
{
  "genres":  [{ "slug": "sushi-neta", "name_ja": "寿司ネタ", "name_en": "Sushi toppings",
                "type": "cut",            // dish | ingredient | cut（層。CLAUDE.md 体験原則4）
                "shelf": "rice", "sort_order": 17,     // sort_order 省略時は既存最大+1
                "intro_ja": "…150〜300字…", "intro_en": "…" }],
  "tags":    [{ "slug": "sparkling", "kind": "味・特性", "name_ja": "発泡", "name_en": "Sparkling" }],
  "items":   [{ "slug": "ootoro", "name_ja": "大トロ", "name_romaji": "Ootoro", "name_en": "Ootoro — the fattiest belly cut of tuna",
                "type": "ingredient", "shelf": "rice", "genre": "sushi-neta",
                "origin_pref": "", "origin_city": "", "lat": "", "lng": "", "primary_style": "",
                "summary_ja": "…", "summary_en": "…",
                "body_ja": "## 何でできているか\n…", "body_en": "## What it's made of\n…",
                "sources":   [{ "title": "…", "url": "https://…", "publisher": "…", "accessed_at": "2026-09-08" }],
                "regions":   [{ "pref": "青森県", "city": "大間町", "lat": 41.5269, "lng": 140.9067, "relation_type": "名産地" }],
                "relations": [{ "to_slug": "maguro", "relation_type": "兄弟", "basis": "同じクロマグロの部位" }],
                "tags": ["raw"] }],
  "regenre": [{ "slug": "maguro", "genre": "sushi-neta" }],   // 既存アイテムの付け替え。genre: null で棚内その他へ
  "chains":  [{ "slug": "…", "name_ja": "…", "name_en": "…", "genre_slug": "yakitori", "founded": "…",
                "style_ja": "…", "style_en": "…", "bridge_ja": "…", "bridge_en": "…",
                "recommend": [{ "kind": "item", "slug": "negima" }], "source_url": "https://…", "source_note": "…" }],
  "notes": "対象外にしたもの・要判断（投入には使わない）"
}
```

## 投入順と検証（スクリプトが行う）
genres → tags → items（ジャンル／棚ごと）→ regenre → regions → item-tags → bodies（sources・relations 含む。3章見出しを機械検証）→ chains → content-lint。途中で失敗すれば段名を出して止まる。`--dry-run` は展開と検証のみ、`--only <段>` は再実行、`--skip-expand` は展開済みをそのまま投入（本番投入時に使う）。

## 語彙
- `regions[].relation_type`: 名産地 | 本場（本場は note_ja/note_en/source_url 必須。発祥は書かない）
- `relations[].relation_type`: 源流 | 派生 | 兄弟 | 対比 | 使用食材 | 代表ネタ（DB では lineage/sibling/contrast/uses に変換される）
- `type`: items は dish | ingredient（地図ピン ●/■）、genres は dish | ingredient | cut（層）
