# ラーメン悉皆（協会一覧の未収録分）部隊指示書（全文を読んでから着手）

出力は scratchpad のみ。リポジトリ /Users/tanakaryouta/workspace/ia-miracolo/itadaki-atlas は読み取り専用（data/ramen*.csv、data/bodies/*.json に既存ラーメンの形式と文体見本あり）。再委譲禁止。一意なスクリプト名（build_ramen_<block>.py）。5件ごとに途中保存。
共通規律は同ディレクトリの FLEET_BRIEF.md（採否・項目・文体・出力形式・自己検証）に従う。この指示書はラーメン固有の追加規定。

## 入力
- 台帳: /Users/tanakaryouta/workspace/ia-miracolo/itadaki-atlas/data/ledgers/ramen-kyokai-master.json の `missing`（name_ja, pref, city_hint, style_hint）。担当ブロックの県だけを扱う
- 一次資料: 日本ラーメン協会「日本ご当地ラーメン一覧」に載っていることが採用根拠。各品の由来・特徴は、自治体・観光協会・地元の振興会（○○ラーメン会・研究会等）の公式ページを curl -sI 200 で確認して使う。老舗の公式沿革は発祥説の出典として可（単一店舗の宣伝にしない）。取れなければ Wikipedia は最終手段（notes に明記）
- 既存: scratchpad/all-items-ja.txt と all-slugs.txt（重複禁止。既存の地域名なし汎用「ラーメン」「中華そば」「タンメン」とは別物として作る）

## 項目（FLEET_BRIEF に加えて）
- type dish、shelf noodles、genre `ramen`
- primary_style: 醤油／味噌／塩／豚骨／その他 のいずれか必須（台帳の style_hint は参考。出典で確認）
- slug: `<地名>` が慣例（既存: hakata, kurume, sapporo 等）。地名だけの slug が既存と衝突する場合は `<地名>-ramen`
- origin_pref / origin_city（市町村。台帳の city_hint は参考。出典で確認）/ lat / lng（市役所付近、小数4桁）
- 本文3章は必須（ラーメンは主力ジャンル）。文体見本は FLEET_BRIEF の札幌ラーメン。「なぜこの形になったのか」は気候・産業（炭鉱・港・工場・学生街）・食材（地場の醤油・煮干・豚）・戦後の引揚げ者などの構造的理由
- relations: 同系統の既存ラーメン（例: 久留米→博多「派生」の向きは「子→親」で書く）や、地場の調味料（all-slugs.txt の醤油・味噌）へ「使用食材」を最低1本。チェーンは書かない
- tags: 既存語彙のみ（chinese_derived は付けない。豚骨系に pork、味噌に miso、醤油に soy_sauce など客観的なもの）

## 出力
束 JSON: scratchpad/content/ramen-<block>.json（items[] と notes）。自己検証（見出し・字数・URL 200・slug 重複・to_slug 実在・格付け語なし）のうえ、FLEET_BRIEF の報告フォーマットで。
