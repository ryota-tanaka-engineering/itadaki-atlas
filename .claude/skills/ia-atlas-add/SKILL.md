---
name: ia-atlas-add
description: itadaki-atlas に何かを追加するときの唯一の入口。「〜を追加して」「〜を増やして」「〜のジャンル/カテゴリを作って」「タグを足して」「日本酒/土産/駅弁/酒蔵を載せたい」「チェーン/本場を足して」で起動。アイテム・ジャンル・タグ・チェーン・本場・新カテゴリ（棚・型の追加）まで、構造判断→部隊起動→投入→検品→本番反映を一本の手順で回す。何を書くかの規約は ia-atlas-content が正典で、このSkillは「どう足すか」だけを持つ。
---

# itadaki-atlas 追加手順（何を足すときもこの一本）

## 目的

追加のたびに手順を組み直さない。「日本酒」「駅弁」のように今の形に無いものでも、**構造の問い → 部隊 → 1コマンド投入 → 機械検査 → 導線検品 → 本番** の同じ道を通す。

規約の正典は `ia-atlas-content`（採否・文体・3種別・Tier・データ規律）。体験の正典は `CLAUDE.md`「体験原則」。ここではそれらを繰り返さず、参照する。

## 0. 追加の種類を見分ける（最初の1分）

| 足したいもの | 種類 | 通る手順 |
| :--- | :--- | :--- |
| 既存ジャンルにアイテムを足す（例: ラーメンを増やす） | アイテム追加 | 2 → 3 → 4 → 5 |
| 同型が20件以上になる新しい塊（例: 丼物・寿司ネタ） | ジャンル追加 | 1 → 2 → 3 → 4 → 5 |
| 今の棚・型に無いもの（例: 日本酒・駅弁・土産・酒蔵） | カテゴリ追加 | 1（拡張版）→ 1.5 → 2 → 3 → 4 → 5 |
| タグ語彙を足す | タグ追加 | 1.7 → 3 → 4 |
| チェーン・本場・関係だけ足す | 結びつき追加 | 3 → 4（部隊不要なことが多い） |

## 1. 構造の問い（部隊を起動する前に、全問に答えて指示書へ転記する）

「同型20件」は昇格の必要条件であって、構造の判断ではない。

1. **層はどれか。** 料理（土地から生まれた型）／食材（銘柄・品種・魚介＝土地に結びつく）／部位・ネタ（土地に依らない図鑑）。`genres.type` = `dish` / `ingredient` / `cut`。層が違うものを同じジャンルに混ぜない（銘柄豚と豚肉の部位、寿司と寿司ネタは別ジャンル）
2. **棚はどれか。** 既存28棚（`shelves`。麺・ごはんもの・…・酒・茶飲料・土産菓子・練り物など）のどれに入るか。入らなければカテゴリ追加（1.5）
3. **受け皿は要るか。** 体験原則5（全国区の料理・型は発祥地なしの「そのもの」アイテムを持つ）
4. **本場は2箇所以上取れるか。** 体験原則5。取れなければ「辿る」装置に出ないことを了解して進める
5. **チェーンの橋渡しはあるか。** 全国チェーンが存在するなら `chains` に橋渡し文を書く
6. **総論は書くか。** ジャンル追加なら `genres.intro_ja/en`（150〜300字・断定しない・宣言型の締め）。絞り込み直後の画面に出る
7. **既存とどう結ぶか。** 新規は全件、既存アイテムへ名前つき関係を1本以上（語彙: 源流／派生／兄弟／対比／使用食材／代表ネタ）。同じ魚・同じ料理の別層は「兄弟」、仕込みの違い（酢締め・ヅケ等）は出典があれば「派生」、無ければ「対比」
8. **一覧の見出しは何と読ませるか。** 「ご当地」は使わない。層に応じて「土地から生まれた型」「銘柄と産地」「一覧」
9. **UI に新しい表示は要るか。** 既存の型（カバー・位置帯・3章・つながり・図）で足りるか。足りなければ 1.5 の「型の追加」

### 1.5 カテゴリ追加（棚・型が無いとき）

- **棚を足す**: `shelves` に行を足すマイグレーション（`supabase-migration` Skill）。既存棚で代替できるなら足さない（例: 日本酒→`sake`、駅弁→`rice` か `processed`、土産→`confections`/`processed`/`cured`。迷ったら棚は広く、ジャンルで狭く）
- **列を足さない**: 酒蔵名・精米歩合・販売駅のような固有の事実は、まず本文（3章）と概要・タグ・`regions`（名産地/本場）・`sources` で持つ。**UI で絞り込みや並べ替えに使う必要が出たときだけ**列を足す（`.doc/20_data/01_models.md` を先に更新）
- **章の読み替え**: 3章見出しは固定。カテゴリごとの読み替えを `ia-atlas-content` §2.4.5 に1行追加してから部隊を起動する（例: 日本酒=何でできているか＝米・水・酵母と味／どう作るのか＝醸造／なぜこの形＝水系と気候）
- **新しい表示型**: 図（部位図・系統図）や位置帯で足りないなら、`design-flow` で1枚作ってから `ia-builder` へ。体験原則に照らす

### 1.7 タグ追加

`tags` は語彙を一元管理する（既存26語彙、`data/tags.json`）。足す前に「客観的に付くか」「既存語で言えないか」を確認し、束 JSON の `tags` で足す。付与は `items[].tags`。

## 2. 部隊を起動する（量産は `research-fleet` の規律で）

- 指示書は `references/fleet-brief.md` を**全文転記**し、`{{ }}` を埋める（部隊は会話文脈を持たない）。1 の答えを「構造」節に転記する
- 部隊の出力は束 JSON 1本（形式は `references/content-json.md`）。**5件ごとに途中保存・一意なスクリプト名**（共有ディレクトリで `build.py` が上書きされた事故あり）
- 起動前に `scratchpad` の `all-slugs.txt` / `existing-relation-pairs.txt` を DB から更新する（下記 3.0）
- 規模: 1部隊10〜15件目安、同時5部隊以内、部隊内の再委譲禁止。落ちたら `SendMessage` で再開（成果は途中保存から復旧）

## 3. 投入（1コマンド）

```bash
cd itadaki-atlas
# 3.0 部隊起動前の突合用リスト（DB から）
DBC=$(docker ps --format '{{.Names}}' | grep -E '^supabase_db_' | head -1)
docker exec -i $DBC psql -U postgres -d postgres -At -c "select slug from food_items where status='published' order by 1" > <scratchpad>/all-slugs.txt
docker exec -i $DBC psql -U postgres -d postgres -At -c "select a.slug||' '||b.slug from food_item_relations r join food_items a on a.id=r.from_id join food_items b on b.id=r.to_id" > <scratchpad>/existing-relation-pairs.txt

# 3.1 束 JSON をリポジトリに置く（正データ。scratchpad に残さない）
cp <scratchpad>/…/<name>.json data/content/<name>.json

# 3.2 検証と展開だけ（DB に触らない）→ 展開された data/content/<name>/ を目視（name_en のカンマ、見出し）
npm run content:import -- --file data/content/<name>.json --dry-run

# 3.3 ローカル投入（genres→tags→items→regenre→regions→item-tags→bodies→chains の順。途中で止まれば段名が出る）
npm run content:import -- --file data/content/<name>.json

# 3.4 機械検査（✗ がゼロになるまで投入完了としない）
npm run content:lint -- --strict
```

投入前に格付け語（三大・一番・No.1・ランキング・受賞・認定）を grep し、あれば書き換えてから投入する（`ia-atlas-content` §1）。

- **複数の束を同じ波で投入するとき**（県ブロックの部隊が互いのアイテムを参照する等）は、束をまたぐ関係が「参照先未投入」で relations 段だけ失敗する。全束を投入したあとに `npm run content:import -- --file <束> --skip-expand --only relations` を束ごとに流し直し、最後に `content:lint --strict` で行き止まりゼロを確認する
- 部隊の生成物はキー名がぶれることがある（`type`/`note` → `relation_type`/`basis`、`null`）。投入前に `scratchpad/kyodo/normalize_tier1.py` 相当で正規化してから `--dry-run` にかける

## 4. 検品（差分ではなく導線で）

1. `npm run test:e2e`。データ量で前提が変わるテスト（件数・同名リンク・URL）は**テスト側を直す**
2. 新ページを実際に開く: ジャンル一覧（`/ja/<genre>` `/en/<genre>`）、詳細2〜3件、本場のあるもの、図が出るもの
3. UI や情報構造に触れた変更なら `ia-atlas-ux-reviewer` エージェントを起動し、指摘に答えてから先へ進む
4. `CLAUDE.md`「現在の状態」の件数・ジャンル一覧を更新する

## 5. 本番反映とコミット

```bash
# 本番 DB へ同じ束を投入（フォアグラウンドで。supabase CLI はバックグラウンドだと固まる）
bash scripts/prod-env.sh node scripts/import-content.ts --file data/content/<name>.json --skip-expand
# コードに触れていなければデプロイ不要（ページは動的描画）。触れていれば
bash scripts/deploy-prod.sh
git add data/content/<name>.json data/content/<name>/ data/genres.csv data/tags.json data/chains.json CLAUDE.md
git commit   # メッセージ: feat(content): <何を何件> 。本番投入済みなら本文に明記
```

## 6. 終わりに必ず

- 束 JSON の `notes`（対象外にしたもの・要判断）を報告に写す。見送ったものは次の追加候補として `CLAUDE.md`「次の作業候補」に残す
- 同じ指摘が2回出たら、このSkillか `CLAUDE.md`「体験原則」を直す（心がけに戻さない）
