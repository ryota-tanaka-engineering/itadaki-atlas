# 郷土料理 Tier2（本文3章）部隊指示書（全文を読んでから着手）

出力は scratchpad のみ。リポジトリ /Users/tanakaryouta/workspace/ia-miracolo/itadaki-atlas は読み取り専用。再委譲禁止。一意なスクリプト名（build_tier2_<pref>.py）。取得した HTML は自分専用ディレクトリ（scratchpad/raw_<pref>/）に置く。5件ごとに途中保存。WebSearch の枠が無ければ curl だけで進める。

## 目的
農林水産省「うちの郷土料理」由来の Tier1 アイテム（概要のみ投入済み）に、詳細ページの本文3章（ja/en）を書く。

## 入力
- 担当県のアイテム: /Users/tanakaryouta/workspace/ia-miracolo/itadaki-atlas/data/content/kyodo-<pref>.json の items[]（slug, name_ja, origin_pref/city, summary_ja/en, sources[0].url＝農水省の詳細ページ）。**本文が既にあるもの（body_ja が空でない）は対象外**
- 主資料: sources の農水省詳細ページを curl で取得して全文を読む（「歴史・由来・関連行事」「食習の機会や時季」「飲食方法」「保存・継承の取組」「主な使用食材」）。丸写し禁止
- 可能なら自治体・観光協会・漁協・JA の公式ページを1本追加（curl -sI 200 のみ。無ければ主資料だけでよい）

## 本文の規律（ia-atlas-content Skill と同じ）
- 見出しは一字一句「## 何でできているか」「## どう作るのか」「## なぜこの形になったのか」／「## What it's made of」「## How it's made」「## Why it took this shape」
- ja 各章150〜250字（計500〜750字）。en は同内容の自然な英語（直訳不要）
- 断定しない（「〜とされる」「〜と伝わる」「〜だという」）。**文末「〜である。」「〜のだ。」の断定調は禁止**（2026-09-15 の4県分で173文が混入し、機械検査 `data/ledgers/check-tier2.js` で落とすようにした）。感覚描写（味・香り・食感）から入る。「なぜこの形になったのか」は気候・地形・産業・保存の必要・行事など構造的理由
- 普及史・受賞・格付け（三大・一番・日本一・No.1・百選・認定・遺産・記念日）・年表・店名は書かない

## 出力（本文投入用。data/bodies3/*.json と同形）
`{"items":[{"slug":"...","body_ja":"## 何でできているか\n...","body_en":"## What it's made of\n...","sources":[{"title","url","publisher","accessed_at":"YYYY-MM-DD"}],"relations":[]}]}`
（sources は農水省詳細ページ＋追加1本まで。relations は投入済みなので空配列）
出力先: /private/tmp/claude-501/-Users-tanakaryouta-workspace-ia-miracolo/98c0ed5c-406a-480f-a772-02af38e851f1/scratchpad/content/tier2-<pref>.json（担当が複数県なら県ごと）

## 自己検証してから報告
見出し一致・字数・URL 200・格付け語なし。報告: 件数 / 出典の内訳 / 裏が取れず書けなかった内容
