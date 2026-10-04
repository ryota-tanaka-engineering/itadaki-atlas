# 部隊指示書: 47都道府県の伝統野菜・地域野菜の悉皆と束 JSON（全文を読んでから着手）

まず本ファイルの内容に従ってください。出力は scratchpad のみ。リポジトリ `/home/user/itadaki-atlas` は読み取り専用（`data/` の既存ファイルで形式と既存アイテムを参照可。束 JSON の見本: `data/content/nihoncha.json`、`data/content/tsukemono.json`）。サブエージェントへの再委譲は禁止。作業スクリプトは共有ディレクトリなので `build_veg_{{block}}.py` のような一意な名前にする。5件書くごとにファイルへ途中保存する。

**この環境は Web に出られない（curl・WebFetch は失敗する）。** 出典 URL は実在を確認できないので、下記「出典」の規律に従い、確信のある安定した一次資料のページだけを書き、`notes` にその旨を明記する。URL の疎通は投入前にオーケストレーターが手元で検査する。

## 目的

日本食の地理データベース「Itadaki Atlas」（主対象は海外の読者。KGI は送客。「土地と食の因果」を語る媒体。ランキング・煽り禁止）に、**各都道府県で有名な野菜（伝統野菜・地域の銘柄野菜）**を一次資料ベースで列挙し、投入用の束 JSON を作る。ユーザーの依頼（2026-10-04）「各都道府県で有名な野菜の情報追加」。

North Star: 浅い興味の人を「深く」（どんな味か／どう育てるか／なぜこの土地でこの形か）か「広く」（この野菜を使うこの土地の料理）へ一歩動かす。旅行者が市場や品書きで見る「賀茂なす」「下仁田ねぎ」が、土地の水・土・冬・街道と結びついた理由を書く。

## 構造（オーケストレーターが Skill ia-atlas-add §1 に答えた結果。これに従う）

- 層: `ingredient`（土地に結びつく食材）。棚: `vegetables`（野菜）。ジャンル: `local-vegetables`（新設。name_ja「伝統野菜・地域野菜」/ name_en「Heirloom & regional vegetables」/ type `ingredient` / shelf `vegetables`）。**野菜アイテムは `shelf`=`vegetables`、`genre`=`local-vegetables`、`type`=`ingredient`**
- **いも・豆（さつまいも・さといも・じゃがいも・やまのいも・枝豆・黒豆・落花生・こんにゃく芋）は棚が別**（`tubers`）。担当県で外せないもの（例: 鳴門金時・安納芋・だだちゃ豆・丹波黒・落花生）は `shelf`=`tubers`、`genre` は **null**（棚内「その他」）で、担当県あたり最大1件まで入れてよい。きのこ・山菜（`mushrooms`）、果物・柑橘（`fruits`）は今回対象外（`notes` に候補名だけ残す）
- 受け皿: 不要（野菜は品種・銘柄が土地に結びつくので、全件に産地ピンを置く）
- 既存との結び方（既存 slug は `{{all-slugs}}`、名前付き一覧は `{{all-items}}`。重複して作らない）:
  - 既存の**料理**（例 `kamonasu-dengaku` 賀茂なすの田楽、`kaga-futokyuri-no-ankake` 加賀太きゅうりのあんかけ、`manganji-togarashi-jako-taitan`、`mibuna-karashiae` 壬生菜のからし和え、`furofuki-daikon`、`hiroshima-nina` 煮菜、`gunma-neginuta` ねぎぬた、`karashi-renkon` からし蓮根、`hoshiimo` 干しいも 等）は作り直さず、野菜側から「使用食材」で結ぶ（向き: 料理 → 食材。`from_slug` に料理の slug、`to_slug` に自分の slug）。`{{all-items}}` を野菜名で grep して探す
  - 新規同士: 同じ種類の野菜の地方品種は「兄弟」（聖護院かぶ ⇄ 日野菜 ⇄ 津田かぶ）、系統が分かれたものは出典があれば「派生」、無ければ「対比」。他ブロックの新 slug は参照できないので、**同じ出力内か既存 slug** にだけ結ぶ
  - 漬物ジャンル（`tsukemono`。野沢菜漬・すぐき・千枚漬など）が既にある場合、野菜（野沢菜・すぐき菜・聖護院かぶ）から漬物へ「使用食材」の逆（漬物 → 野菜）で結ぶ
- 3章の読み替え（食材）: 何でできているか＝味・食感・見た目・大きさの実体／どう作るのか＝育て方（播種期・土・水・在来種の自家採種・収穫期）と下ごしらえ／なぜこの形になったのか＝なぜこの土地でこうなったか（気候・土質・水・川・街道・城下町・保存の必要・寺社）
- 一覧の見出しは「銘柄と産地」（UI 側）。「ご当地」は使わない

## 採否

- MECE に、実在する語だけ（造語禁止）。都道府県・市町村の「伝統野菜」認定一覧（京の伝統野菜、加賀野菜、なにわの伝統野菜、江戸東京野菜、大和野菜、ひご野菜、飛騨・美濃伝統野菜、信州の伝統野菜、あいちの伝統野菜 等）、農林水産省（GI 登録産品・うちの郷土料理）、JA の銘柄ページに載っているものを優先する
- 担当県ごとに **1〜2件の野菜**（`vegetables`）＋ **0〜1件のいも・豆**（`tubers`、genre null）。全県に最低1件。多すぎる県（京都・石川・大阪・奈良）は代表的なものに絞り、残りは `notes` に候補として残す
- 表記ゆれ・別称は1件にまとめる。単一企業の登録商標品種は対象外（団体・自治体の認定ブランドは可）。保護対象は不掲載
- 「知って食べると一口が変わる」情報を1〜2文で言えるものだけ

## 各アイテムに必要な項目（束 JSON の items[]）

- `slug`（英小文字とハイフン。`<地名>-<野菜>` か固有名（`kamo-nasu`、`shimonita-negi`、`kujo-negi`、`sakurajima-daikon`）。地名だけの slug は禁止。既存と衝突させない）
- `name_ja` / `name_romaji` / `name_en`（説明訳。例 "Shimonita negi — thick, sweet winter leek from Gunma"。固有名詞の転写だけを name_en にしない）
- `type` `ingredient`、`shelf` `vegetables`（いも・豆は `tubers`）、`genre` `local-vegetables`（いも・豆は null）
- `origin_pref` / `origin_city` / `lat` / `lng`（**全件に産地を置く**。都道府県は正式表記「東京都」「京都府」「北海道」。lat/lng は産地の市町村役場など代表地点の小数4桁）
- `primary_style`: 空欄
- `summary_ja`（80〜160字・断定しない）/ `summary_en`（同内容の自然な英語）
- `body_ja` / `body_en`: 3章固定。見出しは一字一句「## 何でできているか」「## どう作るのか」「## なぜこの形になったのか」／「## What it's made of」「## How it's made」「## Why it took this shape」。ja 各章150〜250字（計500〜750字）。en は同内容の自然な英語（直訳不要）。**見出しの前に文を置かない。4章目は書かない**
- `sources`: 1〜2本 `{title,url,publisher,accessed_at}`（下記「出典」）
- `regions`: 産地が複数県にまたがるとき（例 淡路島たまねぎは兵庫のみ、九条ねぎは京都のみ＝不要）だけ「名産地」行を足す。「本場」は野菜では原則書かない
- `relations`: 他アイテムへの名前つき関係を最低1本（行き止まり禁止）。語彙: 源流 / 派生 / 兄弟 / 対比 / 使用食材（料理→食材）。**向き**: 「A → B 派生」= A は B から派生（子→親で書く）。`from_slug` は省略可（省略時は自分）。`basis` に根拠を一文
- `tags`: 既存語彙のみ、客観的に付くものだけ: fermented, spicy（辛い。とうがらし・からし菜等）, miso, soy_sauce, pork, beef, chicken, egg, kelp, offal, insect, smoked, kelp_cured, freeze_dried, no_broth, cold_served, skewered, handheld, street_food, ceremonial（行事食）, meal_ender, souvenir_non_confection, yoshoku, chinese_derived, postwar_us_military, ryukyu（琉球由来）。野菜では多くの場合 `[]` でよい

## 出典（Web 不可環境の規律）

- 1アイテム1〜2本。**ページが実在すると確信できる、変わりにくい URL だけ**を書く: 都道府県・市町村の公式サイトのトップに近い階層、農林水産省のうちの郷土料理の県一覧（`https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/area/<pref>.html`）、農林水産省 GI 登録産品（`https://www.maff.go.jp/j/shokusan/gi_act/register/`）、JA 全農県本部、認定団体の公式（例 金沢市農産物ブランド協会 `https://www.kanazawa-kagayasai.or.jp/`、京都府「京の伝統野菜」）
- 深い階層の URL を「それらしく」作らない。確信が無ければ上の階層のページを出典にし、`notes` に「要確認: <slug> の出典は一覧ページ」と書く
- `accessed_at` は `2026-10-04`。`publisher` は組織名。Wikipedia は最終手段（`notes` に明記）

## 編集規律（本文）

1. 普及史・メディア掲載・受賞・格付け（日本三大◯◯、ランキング、一番人気、No.1、認定）・年表は書かない。自治体の「伝統野菜に認定」「GI 登録」のような制度上の事実は書いてよいが自慢にしない
2. 断定しない（「一説によると」「〜とされる」「〜と伝わる」）。説が割れていれば併記。「〜だ。」の断定終止を使わない
3. 文体は見本と同じ声（常体・感覚描写から入る）。日英とも各言語で書く（直訳しない）。en では日本語の語を初出でローマ字＋短い説明（kabu — a Japanese turnip）
4. 事実と伝承を混ぜない。味・育て方・現在の姿は事実として、起源は伝承として

### 文体見本（深蒸し煎茶 ja・抜粋。食材の章の声）

## 何でできているか
原料は煎茶と同じチャノキの新芽だが、蒸す時間を通常の2〜3倍程度に延ばして仕上げる。長く蒸すことで葉の組織が壊れやすくなり、茶葉は細かい粉状に近づくとされる。この細かさゆえに湯に溶け出す成分が多く、渋みを抑えたまろやかな旨みと、濃い緑色の水色になりやすいという。

## 出力

束 JSON（`data/content/nihoncha.json` と同じ形式）を `{{output}}` に。`genres[]` はジャンル新設を担当するブロックだけが書く（総論 `intro_ja` / `intro_en` 150〜300字・断定しない・宣言型の締め。「日本の野菜は品種名で呼ばれる」ことと、伝統野菜（在来種）と銘柄野菜（産地ブランド）の2種類があることを言う）。対象外（きのこ・山菜・果物の候補名、絞った県の残り）・要判断・出典の確信度は `notes` に書く。

```jsonc
{
  "genres": [ /* 担当ブロックのみ */ ],
  "items": [ { "slug": "kamo-nasu", "name_ja": "賀茂なす", "name_romaji": "Kamo-nasu", "name_en": "Kamo-nasu — Kyoto's round, dense heirloom eggplant",
               "type": "ingredient", "shelf": "vegetables", "genre": "local-vegetables",
               "origin_pref": "京都府", "origin_city": "京都市", "lat": 35.0116, "lng": 135.7681, "primary_style": "",
               "summary_ja": "…", "summary_en": "…", "body_ja": "## 何でできているか\n…", "body_en": "## What it's made of\n…",
               "sources": [ { "title": "…", "url": "https://…", "publisher": "…", "accessed_at": "2026-10-04" } ],
               "regions": [],
               "relations": [ { "from_slug": "kamonasu-dengaku", "to_slug": "kamo-nasu", "relation_type": "使用食材", "basis": "…" } ],
               "tags": [] } ],
  "notes": "…"
}
```

## 自己検証してから報告

見出し一致（3章・一字一句・前置き無し）、字数、slug 重複なし（既存 `{{all-slugs}}` とも）、`to_slug` / `from_slug` 実在（既存か同じ出力内）、関係の重複なし（逆向き含む）、格付け語なし、断定終止「〜だ。」なし、都道府県名が正式表記、担当県すべてに最低1件、`shelf`/`genre` の組が規定どおり（vegetables + local-vegetables ／ tubers + null）。
報告: 県ごとの件数／出典の内訳（確信度の低い URL の一覧）／対象外にしたもの／裏が取れず書けなかった内容・要判断
