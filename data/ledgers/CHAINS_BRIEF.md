# チェーン店（橋渡しコンテンツ）部隊指示書（全文を読んでから着手）

Itadaki Atlas（日本食の地理データベース。英語圏の旅行者が主対象）の「その味の、生まれた土地へ」装置を埋める。有名チェーンは図鑑の一員ではなく **橋渡し**（「このチェーンの味が好きなら、この系統・このご当地へ」）として載せる。事実ベース・優劣なし・推薦先は DB に実在するアイテムのみ。

出力は scratchpad のみ。リポジトリ /Users/tanakaryouta/workspace/ia-miracolo/itadaki-atlas は読み取り専用。再委譲禁止。一意なスクリプト名（build_chains_<担当>.py）。5件ごとに途中保存。WebSearch の枠が無ければ curl / WebFetch だけで進める。

## 採否
- 対象: そのジャンルの料理を主力にする外食チェーン。全国規模（複数地方に展開）を中心に、**地域限定でよく知られたチェーン**（例: 静岡のさわやか、名古屋のスガキヤ、福岡の牧のうどん）も含める（`pref_limited` に都道府県名を入れる）
- 1ジャンル 8〜12 件。ランキングや売上順ではなく、味の系統が分かれるよう選ぶ（例: うどんなら 讃岐系セルフ／関西だし／武蔵野・肉汁／立ち食い）
- 除外: 単一店舗、閉業したもの、料理よりも業態が主のもの（居酒屋総合・ファミレス）。ただし業態がそのジャンル料理に特化しているなら可（回転寿司・牛丼・とんかつ・から揚げ専門など）
- 既存19件（data/chains.json）と重複させない

## 各チェーンに書くこと（data/chains.json の既存要素と同じ形）
```
{"slug":"marugame-seimen","name_ja":"丸亀製麺","name_en":"Marugame Seimen — self-serve Sanuki-style udon chain",
 "genre_slug":"udon","founded":"2000年・兵庫県加古川市（1号店。運営会社の沿革による）",
 "style_ja":"讃岐系・セルフ","style_en":"Sanuki-style, self-serve",
 "bridge_ja":"丸亀製麺の店内製麺と釜揚げは、讃岐の製麺所やセルフうどん店の形式を全国に広めたものとされる。",
 "bridge_en":"Marugame Seimen's in-store noodle making and kamaage service are said to carry the format of Sanuki's noodle-shop and self-serve udon culture nationwide.",
 "recommend":[{"kind":"item","slug":"sanuki-udon"},{"kind":"item","slug":"kamaage-udon"}],
 "pref_limited":null,
 "source_url":"https://www.toridoll.com/company/history/","source_note":"トリドールHD 沿革ページ"}
```
- `name_en`: 「ローマ字 — 説明訳」の形（既存に合わせる）
- `founded`: 年と創業地。運営会社の公式沿革で確認できる範囲だけ。分からなければ「（創業地は公式沿革に記載なし）」のように書き、推測しない
- `style_ja` / `style_en`: 味の系統。ラーメンなら 醤油/味噌/塩/豚骨 の語を含める（絞り込みに使う）
- `bridge_ja` / `bridge_en`: 1〜2文。「〜の流れを汲むとされる」「〜を全国に広めたとされる」のように断定しない。優劣・「日本一」「元祖」「本家」「No.1」「行列」「人気」は書かない。系統とご当地の名前を必ず入れる
- `recommend`: kind は "item" のみ。slug は **data/ledgers/slugs-by-genre.txt**（`ジャンル|slug|日本語名` の一覧）に実在するものだけ。2〜3件。系統の元になったご当地の料理・型・受け皿（例: 牛丼チェーン→ gyudon、回転寿司→ nigiri-zushi と地域の寿司、カレー→ curry-rice）
- `pref_limited`: 地域限定なら都道府県名（例 "静岡県"）、全国なら null
- `source_url`: 運営会社の公式沿革・会社概要・ブランドページ。`curl -sI` で 200 のもの（403 が返るサイトは UA を付けて再確認。Wikipedia 不可）

## 出力
/private/tmp/claude-501/-Users-tanakaryouta-workspace-ia-miracolo/98c0ed5c-406a-480f-a772-02af38e851f1/scratchpad/content/chains-<担当>.json に `{"chains":[...],"notes":"対象外にしたものと理由"}`。

## 自己検証してから報告
全 recommend slug が slugs-by-genre.txt に存在／source_url 200／禁止語なし／既存 slug と重複なし／genre_slug は担当ジャンルの slug（棚扱いのものは指示された shelf slug）。報告: ジャンルごとの件数と一覧（slug・系統・地域限定）／出典の内訳／外したものと理由。
