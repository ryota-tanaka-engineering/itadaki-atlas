# ガイド「食べに行く前に」執筆 指示書（全文を読んでから着手）

出力は scratchpad のみ。リポジトリ /Users/tanakaryouta/workspace/ia-miracolo/itadaki-atlas は読み取り専用（`data/guides.json` に既存3件の形式見本あり）。再委譲禁止。一意なスクリプト名。3件ごとに途中保存。

## 目的
海外読者（英語圏が主、日本語も主力）が、店に入る前・買う前の不安を減らすための実用ガイド。日本食の地理データベース「Itadaki Atlas」の一部で、ランキング・煽り禁止、断定しない（「〜なことが多いです」「店によります」）。丁寧語（です・ます）で、読者に話しかける文体。日本語版と英語版は同内容の自然な文（直訳不要）。

## 形式（data/guides.json と同じ。1ファイルに guides[] で複数）
```jsonc
{ "guides": [{
  "slug": "convenience-store-basics",          // 英小文字とハイフン
  "kind": "shopping",                           // 今回は全件 shopping（買う場所）。既存: ordering paying manners finding takeaway seasons
  "sort_order": 10, "status": "published",
  "translations": {
    "ja": { "title": "コンビニの使い方", "summary": "80〜160字。何が分かるガイドか", "body_md": "## 見出し\n本文（Markdown。見出しは自由。600〜1,200字。箇条書き可。写真なし）" },
    "en": { "title": "…", "summary": "…", "body_md": "…" } },
  "sources": [{ "title": "…", "url": "https://…", "publisher": "…", "accessed_at": "2026-09-10" }],   // 1〜3本。公式（観光庁・JNTO・業界団体・自治体・企業の公式案内）。curl -sI で200確認
  "links": [{ "kind": "genre", "slug": "gohan-no-otomo" }, { "kind": "shelf", "slug": "processed" }, { "kind": "tag", "slug": "handheld" }]   // 関係する食べもの。genre/shelf/tag の既存 slug のみ
}]}
```
既存ジャンル slug: ramen yakitori sushi wagyu udon soba rice-varieties fermented-seasonings jidori brand-pork beef-cuts pork-cuts fish shellfish donburi fried yakisoba tsukemono konamono nerimono sushi-neta（gohan-no-otomo / machi-chuka / yoshoku / nihonshu は別部隊が作成中。links に使ってよいが、無ければ投入時に落とされる）。棚 slug: noodles rice bread griddle grilled fried hotpot raw sweets homestyle meat seafood seaweed vegetables tubers fruits grains mushrooms dairy sake drinks seasonings dashi dried fermented processed cured confections。タグ slug: fermented spicy miso soy_sauce pork beef chicken egg kelp offal insect smoked kelp_cured freeze_dried no_broth cold_served skewered handheld street_food ceremonial meal_ender souvenir_non_confection yoshoku chinese_derived postwar_us_military ryukyu

## 内容の規律
- 「知っていると一回目の失敗が減る」ことだけを書く。制度・法律・価格は変わるので数字は「目安」と断り、年は書かない
- 店名・チェーン名は原則書かない（一般的な作法として書く）。書くなら公式の案内を出典に
- 各ガイドの末尾に「関係する食べもの」への誘導文を1行（links と対応）

## 出力
/private/tmp/claude-501/-Users-tanakaryouta-workspace-ia-miracolo/98c0ed5c-406a-480f-a772-02af38e851f1/scratchpad/content/guides-<name>.json
自己検証: slug 一意、summary 字数、URL 200、links の slug 実在、格付け語なし。報告: 件数 / 出典の内訳 / 書けなかった内容・要判断
