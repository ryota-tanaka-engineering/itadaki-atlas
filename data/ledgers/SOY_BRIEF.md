# 部隊指示書: 大豆食品（豆腐・油揚げ・湯葉・納豆の型など）の悉皆と束 JSON（全文を読んでから着手）

まず本ファイルの内容に従ってください。出力は scratchpad のみ。リポジトリ `/home/user/itadaki-atlas` は読み取り専用（`data/` の既存ファイルで形式と既存アイテムを参照可。束 JSON の見本: `data/content/nihoncha.json`、`data/content/tsukemono.json`）。サブエージェントへの再委譲は禁止。作業スクリプトは共有ディレクトリなので `build_soy_{{block}}.py` のような一意な名前にする。5件書くごとにファイルへ途中保存する。

**この環境は Web に出られない（curl・WebFetch は失敗する）。** 出典 URL は実在を確認できないので、下記「出典」の規律に従い、確信のある安定した一次資料のページだけを書き、`notes` にその旨を明記する。URL の疎通は投入前にオーケストレーターが手元で検査する。

## 目的

日本食の地理データベース「Itadaki Atlas」（主対象は海外の読者。KGI は送客。「土地と食の因果」を語る媒体。ランキング・煽り禁止）に、**大豆食品（豆腐の型・地方豆腐・油揚げ・厚揚げ・がんもどき・凍み豆腐・湯葉・納豆の型・豆乳・おから・きな粉・豆腐の発酵/保存食）**を一次資料ベースで列挙し、投入用の束 JSON を作る。ユーザーの依頼（2026-10-04）「豆腐とかの大豆食品の情報追加」。

North Star: 浅い興味の人を「深く」（食べてみたい／どんな味か／どう作るのか／なぜこの形か）か「広く」（この土地の他の食・素材）へ一歩動かす。読者は「豆腐」をひとつの食べものだと思っている。日本には水・にがり・凝固の仕方・土地の暮らしで分かれた型が何十もある、と知って一口が変わる書き方をする。

## 構造（オーケストレーターが Skill ia-atlas-add §1 に答えた結果。これに従う）

- 層: `ingredient`（土地に結びつく仕込み物）。棚: `processed`（練り物・豆腐・こんにゃく）。ジャンル: `soy-foods`（新設。name_ja「大豆食品」/ name_en「Soy foods」/ type `ingredient` / shelf `processed`）。**全アイテムの `shelf` は `processed`、`genre` は `soy-foods`、`type` は `ingredient`**（ジャンルの棚と一致しないと投入が止まる）
- 受け皿アイテム（発祥ピンなし＝origin/lat/lng 空。本場を2箇所以上、構造的理由の一文つき）: `tofu`（豆腐）、`aburaage`（油揚げ）、`yuba`（湯葉）。担当ブロックに書いてあるものだけ作る
- 既存との結び方（既存 slug は `{{all-slugs}}`、名前付き一覧は `{{all-items}}`。重複して作らない）:
  - 既存 `natto`（納豆・ごはんのお供ジャンル）は納豆の受け皿として既にある。納豆の型（水戸納豆・浜納豆・大徳寺納豆・干し納豆など）は新規に作り、`natto` へ「派生」（糸引き納豆の系譜）か「対比」（塩辛納豆＝別系統）で結ぶ
  - 既存 `ganmodoki`（がんもどき・揚げ物ジャンル）、`nama-yuba`（生湯葉・惣菜）、`goma-toufu`（ごま豆腐＝大豆でない）、`jiimaami-doofu`（ジーマーミ豆腐＝落花生）、`shimidofu-no-tamagotoji`（凍豆腐の卵とじ）、`tofu-dengaku`、`hitachiomiya`（豆腐みそラーメン）等の**料理**は作り直さない。食材側から「使用食材」で結ぶ（向き: 料理 → 食材。`from_slug` に料理の slug、`to_slug` に自分）。ごま豆腐・ジーマーミ豆腐は「対比」（大豆を使わない豆腐名の食べもの）
  - 既存の味噌・醤油（`fermented-seasonings` ジャンル。`mame-miso`、`shodoshima-shoyu` 等）は作らない。必要なら「兄弟」（同じ大豆の別の仕込み）で1本だけ結んでよい
  - 新規同士: 型の違いは「兄弟」（木綿⇄絹ごし）、仕込みの派生は「派生」（豆腐 → 凍み豆腐、豆腐 → 油揚げ）、受け皿へは「派生」で結ぶ（例: `gokayama-kata-dofu → tofu 派生`）
- 3章の読み替え（食材・仕込み物）: 何でできているか＝大豆・水・凝固剤（にがり／すまし粉）と味・食感の実体／どう作るのか＝浸漬・磨砕・煮る・搾る・固める・揚げる・凍らせる・発酵の工程／なぜこの形になったのか＝水質・寒さ・保存の必要・精進や行事・街道や寺社との関係
- 一覧の見出しは「銘柄と産地」（UI 側）。「ご当地」は使わない

## 採否

- MECE に、実在する語だけ（造語禁止）。農林水産省「うちの郷土料理」、全国豆腐連合会、全国納豆協同組合連合会、自治体・観光協会・JA・生産者組合の公式ページに載っている型・産地を優先し、載っていないものは採らない
- 表記ゆれ・別称は1件にまとめる（例: 凍み豆腐／高野豆腐／凍り豆腐は1件 `koya-dofu` で、地方名は本文で扱う）。単一店舗・単一企業の商品は対象外（地域の複数の作り手が作る型のみ）
- 保護対象・規制種は不掲載。「知って食べると一口が変わる」情報を1〜2文で言えるものだけ

## 各アイテムに必要な項目（束 JSON の items[]）

- `slug`（英小文字とハイフン。地方豆腐は `<地名>-<種類>`（例 `gokayama-kata-dofu`、`shima-dofu`、`tochio-aburaage`）、型・加工品は素の名（`momen-dofu`、`kinugoshi-dofu`、`atsuage`、`koya-dofu`、`okara`、`kinako`、`tonyu`）。既存と衝突させない）
- `name_ja` / `name_romaji` / `name_en`（説明訳。例 "Shima-dofu — Okinawa's firm, pressed island tofu"。固有名詞の転写だけを name_en にしない）
- `type` `ingredient`、`shelf` `processed`、`genre` `soy-foods`
- `origin_pref` / `origin_city` / `lat` / `lng`（地方の型は発祥地・産地。都道府県は正式表記「東京都」「京都府」「北海道」。lat/lng は市役所など代表地点の小数4桁。全国区の型（木綿・絹ごし・厚揚げ・高野豆腐・豆乳・おから・きな粉）は空欄＝図鑑枠）
- `primary_style`: 空欄でよい
- `summary_ja`（80〜160字・断定しない）/ `summary_en`（同内容の自然な英語）
- `body_ja` / `body_en`: 3章固定。見出しは一字一句「## 何でできているか」「## どう作るのか」「## なぜこの形になったのか」／「## What it's made of」「## How it's made」「## Why it took this shape」。ja 各章150〜250字（計500〜750字）。en は同内容の自然な英語（直訳不要）。**見出しの前に文を置かない。4章目は書かない**
- `sources`: 1〜2本 `{title,url,publisher,accessed_at}`（下記「出典」）
- `regions`: 土地との結びつき。`relation_type` は「名産地」「本場」（発祥は origin から自動生成されるので書かない）。本場＝どこでも食べられるがここのは特別。**本場は `note_ja` / `note_en` に構造的理由の一文と `source_url` が必須**（例: 京都の豆腐＝軟水の地下水と寺院の精進料理の集積）。受け皿アイテムには本場を2箇所以上。`lat`/`lng` は市場・寺社など実在ランドマークか市役所
- `relations`: 他アイテムへの名前つき関係を最低1本（行き止まり禁止）。語彙: 源流 / 派生 / 兄弟 / 対比 / 使用食材（料理→食材）/ 代表ネタ。**向き**: 「A → B 派生」= A は B から派生（子→親で書く）、「A → B 源流」= A は B の源流。`to_slug` は既存 slug か同じ出力内の新 slug（他ブロックの新 slug は使わない。受け皿 `tofu` / `aburaage` / `yuba` だけは全ブロック共通で参照してよい）。`from_slug` は省略可（省略時は自分）。`basis` に根拠を一文
- `tags`: 既存語彙のみ、客観的に付くものだけ: fermented（発酵）, spicy, miso, soy_sauce, pork, beef, chicken, egg, kelp, offal, insect, smoked, kelp_cured, freeze_dried（凍み技法）, no_broth, cold_served, skewered, handheld, street_food, ceremonial（行事食）, meal_ender, souvenir_non_confection（土産）, yoshoku, chinese_derived, postwar_us_military, ryukyu（琉球由来）

## 出典（Web 不可環境の規律）

- 1アイテム1〜2本。**ページが実在すると確信できる、変わりにくい URL だけ**を書く: 農林水産省「うちの郷土料理」の品目ページ（`https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/menu/<番号>_<n>_<pref>.html` の形。番号に確信が無ければ県の一覧ページ `https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/area/<pref>.html`）、全国豆腐連合会（`https://www.zentoren.jp/`）、全国納豆協同組合連合会（`http://www.natto.or.jp/`）、都道府県・市町村・観光協会のトップに近い階層のページ、JA 全農の県本部
- 深い階層の URL を「それらしく」作らない。確信が無ければ上の階層のページを出典にし、`notes` に「要確認: <slug> の出典は一覧ページ」と書く
- `accessed_at` は `2026-10-04`。`publisher` は組織名
- Wikipedia は最終手段（`notes` に明記）

## 編集規律（本文）

1. 普及史・メディア掲載・店舗数・受賞・格付け（日本三大◯◯、ランキング、一番人気、No.1、認定）・年表は書かない。「GI（地理的表示）登録」のような制度上の事実は書いてよいが自慢にしない
2. 断定しない（「一説によると」「〜とされる」「〜と伝わる」）。説が割れていれば併記。「〜だ。」の断定終止を使わない
3. 文体は見本と同じ声（常体・感覚描写から入る）。日英とも各言語で書く（直訳しない）。en では日本語の語を初出でローマ字＋短い説明（nigari — the magnesium-rich coagulant left after salt is drawn from seawater）
4. 事実と伝承を混ぜない。材料・製法・現在の姿は事実として、起源は伝承として

### 文体見本（深蒸し煎茶 ja・抜粋。食材・仕込み物の章の声）

## 何でできているか
原料は煎茶と同じチャノキの新芽だが、蒸す時間を通常の2〜3倍程度に延ばして仕上げる。長く蒸すことで葉の組織が壊れやすくなり、茶葉は細かい粉状に近づくとされる。この細かさゆえに湯に溶け出す成分が多く、渋みを抑えたまろやかな旨みと、濃い緑色の水色になりやすいという。

## 出力

束 JSON（`data/content/nihoncha.json` と同じ形式）を `{{output}}` に。`genres[]` はジャンル新設を担当するブロックだけが書く（総論 `intro_ja` / `intro_en` 150〜300字・断定しない・宣言型の締め）。対象外・要判断・出典の確信度は `notes` に書く。

```jsonc
{
  "genres": [ /* 担当ブロックのみ */ ],
  "items": [ { "slug": "…", "name_ja": "…", "name_romaji": "…", "name_en": "…", "type": "ingredient", "shelf": "processed", "genre": "soy-foods",
               "origin_pref": "", "origin_city": "", "lat": "", "lng": "", "primary_style": "",
               "summary_ja": "…", "summary_en": "…", "body_ja": "## 何でできているか\n…", "body_en": "## What it's made of\n…",
               "sources": [ { "title": "…", "url": "https://…", "publisher": "…", "accessed_at": "2026-10-04" } ],
               "regions": [ { "pref": "京都府", "city": "京都市", "lat": 35.0116, "lng": 135.7681, "relation_type": "本場", "note_ja": "…", "note_en": "…", "source_url": "https://…" } ],
               "relations": [ { "to_slug": "tofu", "relation_type": "派生", "basis": "…" } ],
               "tags": [] } ],
  "notes": "対象外にしたもの・要判断・出典の確信度（URL 未確認の旨）"
}
```

## 自己検証してから報告

見出し一致（3章・一字一句・前置き無し）、字数、slug 重複なし（既存 `{{all-slugs}}` とも）、`to_slug` 実在（既存か同じ出力内か受け皿3つ）、関係の重複なし（逆向き含む）、格付け語なし、断定終止「〜だ。」なし、本場に note と source_url、都道府県名が正式表記、`shelf`=`processed` / `genre`=`soy-foods` / `type`=`ingredient` 全件。
報告: 件数／出典の内訳（確信度の低い URL の一覧）／対象外にしたもの／裏が取れず書けなかった内容・要判断
