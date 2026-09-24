# 「看板と品書きの漢字」「知っておくと得すること」ガイド部隊 指示書（全文を読んでから着手）

Itadaki Atlas（日本食の地理データベース。英語圏の旅行者が主対象、日本語も併記）の「食べに行く前に」ガイドを書く。出力は scratchpad のみ。リポジトリ /Users/tanakaryouta/workspace/ia-miracolo/itadaki-atlas は読み取り専用（書き換えない）。再委譲禁止（Agent ツールを使わない）。一意なスクリプト名（build_guides_<担当>.py）。WebSearch の枠が無ければ curl / WebFetch だけで進める。

## 形式（data/guides.json の既存要素と同じ。例: depachika-basics, ticket-machine）
`{"guides":[{slug, kind, sort_order, status:"published", translations:{ja:{title,summary,body_md}, en:{title,summary,body_md}}, sources:[{title,url,publisher,accessed_at:"2026-09-24"}], links:[{kind:"genre"|"shelf"|"tag", slug}]}]}`
- kind は ordering / paying / manners / finding / takeaway のいずれか（新しい kind は作らない）
- body_md で使えるのは `## 見出し`（`###` も可）、段落、`- ` の箇条書き、`**太字**`、`[文字](URL)` のみ。**表は使えない**。漢字リストは箇条書きで「**漢字**（読み）— 意味 — どこで見るか」の1行にする
- 日本語 600〜1,000字（漢字リストは行数優先で1,200字まで可）、英語は同内容の自然な英語。英語側では漢字をそのまま見せ、ローマ字読みと意味を添える（旅行者が看板と照合できるように）
- 最後の節は `## 関係する食べもの` で本サイトの関連ジャンルへ橋渡し。links は既存 slug のみ（ジャンルは data/genres.csv、タグは data/tags.json、棚は既存ガイドの links にある shelf slug）

## 文体と禁止
- 丁寧体（です・ます）。断定しない（「〜ことが多いです」「〜とされています」「店によります」）。旅行者を子ども扱いしない
- ランキング・煽り・格付け語（三大・一番・日本一・No.1・受賞・認定・百選・必訪・絶対・「いい店では」）禁止。特定店の宣伝にしない
- 慣習は「多い／ある」で書き、例外があることを一言添える。金額は「目安」として幅で書く
- 出典: 各ガイドに一次資料を1〜3本（消費者庁・観光庁・自治体・観光協会・業界団体・JNTO など。Wikipedia 不可）。`curl -sI` で 200 確認した URL のみ

## 既存ガイド（重複させない。重なる話題はそちらへ `[券売機の読み方](/guide/ticket-machine)` のようにリンク）
- ticket-machine 券売機の読み方（左上が看板メニュー、買い方、困ったとき）
- vertical-menu 縦書きメニューの読み方（右上から）
- cash-only 支払いは現金が多い店
- convenience-store-basics / supermarket-basics / depachika-basics / ekiben-and-station-food / michinoeki-and-markets / bussanten-basics / antenna-shop-basics / soraben-and-airport-food（買う場所）

## 自己検証してから報告
字数・見出し・禁止語・URL 200・links の slug の実在・表を使っていないこと。報告: 各ガイドの見出し一覧 / 出典 / 裏が取れず外したこと。

## 出力先
/private/tmp/claude-501/-Users-tanakaryouta-workspace-ia-miracolo/98c0ed5c-406a-480f-a772-02af38e851f1/scratchpad/content/guides-<担当>.json
