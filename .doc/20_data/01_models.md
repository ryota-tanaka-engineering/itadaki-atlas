# 目的

Itadaki Atlas のデータモデルを定義する。テーブル定義・リレーション・フェーズ別の実装範囲の一次情報源であり、マイグレーション作成時は本ファイルを先に更新する（Platform `../.doc/20_data/02_migrations.md` §1）。

## 1. 設計方針

### 1.1 共通コア + タイプ別詳細テーブル

ジャンル（ラーメン / 寿司 / 焼き鳥 …）ごとに必要な属性が異なるが、**JSONB で可変属性を持つ設計は採らない**。後から型安全化するコストが、初期のスキーマ設計コストを上回るためである。

```
food_items（共通コア）── dish_details（dish型の詳細）
                     └─ 将来: ingredient_details 等（ジャンルごとに要否を判断）
```

他ジャンル展開時は、既存の詳細テーブルで賄えるか（例: 洋食は `dish_details` を流用可）を都度判断する。**構成合わせのために空のテーブルを作らない。**

### 1.2 座標は素の数値列で持つ

`lat` / `lng` は `double precision` の素の列とする（PostGIS封印の理由と解禁条件は `.doc/10_system/01_architecture.md` §2.1）。

### 1.3 言語の扱い

`food_items` は**言語非依存の情報のみ**を持ち、翻訳は別テーブルに分離する（`.doc/10_system/01_architecture.md` §6.2.2）。

- `slug` は英語ベース1本で言語共通
- `name_romaji` は「言語」ではなく「転写」のためコア側に置く

### 1.4 複雑クエリは View + RPC

多対多の辿りは ORM ではなく Postgres の View / RPC（関数）で解く（`.doc/10_system/01_architecture.md` §2.3）。

## 2. ER図

```mermaid
erDiagram
    genres ||--o{ food_items : "分類"
    food_items ||--o{ food_item_translations : "翻訳"
    food_items ||--o{ food_item_sources : "出典"
    food_items ||--o| dish_details : "詳細(dish型)"
    food_items ||--o{ food_item_regions : "地域"
    food_items ||--o{ food_item_relations : "from"
    food_items ||--o{ food_item_relations : "to"
    food_items ||--o{ shops : "店舗"
```

## 3. テーブル定義

### 3.1 `food_items` — 共通コア

地図・索引・検索が読む唯一のソース。

| カラム | 型 | 制約 | 内容 |
| :--- | :--- | :--- | :--- |
| `id` | uuid | PK | |
| `slug` | text | UNIQUE, NOT NULL | URL に使う。英語ベース1本で言語共通 |
| `type` | text | NOT NULL | `dish` \| `ingredient` |
| `genre_id` | uuid | FK → `genres` | |
| `name_romaji` | text | NOT NULL | ローマ字転写。言語ではなく転写のためコア側 |
| `origin_pref` | text | **NULL可** | 発祥地（都道府県） |
| `origin_city` | text | **NULL可** | 発祥地（市町村） |
| `lat` | double precision | **NULL可** | §1.2 |
| `lng` | double precision | **NULL可** | §1.2 |
| `status` | text | NOT NULL, default `draft` | `draft` \| `published` |

**発祥地・座標が NULL 可である理由:** 焼き鳥の部位（せせり・ぼんじり）や串カツの定番種（紅生姜）など、**発祥地の物語を持たないアイテム**に対応するため。地域性ありは「地図＋索引」、地域性なしは「索引＋親ジャンルページ」に表示する。

### 3.2 `food_item_translations` — 自由記述の翻訳

| カラム | 型 | 制約 | 内容 |
| :--- | :--- | :--- | :--- |
| `food_item_id` | uuid | FK | |
| `locale` | text | | `ja` \| `en`（将来 `zh-Hant` \| `ko`） |
| `name` | text | NOT NULL | |
| `summary` | text | | 一言説明 |
| `history` | text | | 歴史（フェーズ2） |

複合ユニーク `(food_item_id, locale)`。

マスタラベルの扱いは `.doc/10_system/01_architecture.md` §6.2.2。

### 3.3 `food_item_sources` — 出典

| カラム | 型 | 内容 |
| :--- | :--- | :--- |
| `food_item_id` | uuid | FK |
| `url` | text | |
| `title` | text | |
| `publisher` | text | |
| `accessed_at` | date | 参照日 |

記事末尾に参考文献として自動表示する。`genres` 側にも `default_source` を持たせ、ジャンル共通出典の一括適用に対応する。

**参照するのは事実のみで、文章表現は必ず書き直す**（転載禁止。`.doc/40_operation/01_strategy.md`）。

### 3.4 `genres` — ジャンルマスタ

| カラム | 型 | 内容 |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `slug` | text | **URLルーティングにそのまま使う**（`/ramen`） |
| `name_ja` / `name_en` | text | マスタ小規模のためカラム方式のまま持つ |
| `type` | text | `dish` \| `ingredient` |
| `sort_order` | int | |
| `default_source` | text | ジャンル共通の出典 |
| `intro_ja` / `intro_en` | text | **NULL可**。国民食型ジャンル（寿司など）の総論。あるジャンルだけヒーロー下に描画される（`ia-atlas-content` Skill §2.4） |

### 3.5 `dish_details` — dish型の詳細（フェーズ2で本格使用）

| カラム | 型 | フェーズ1 | 内容 |
| :--- | :--- | :--- | :--- |
| `food_item_id` | uuid | ✅ | PK / FK |
| `primary_style` | text | **✅ 入力する** | 主系統（醤油 \| 味噌 \| 塩 \| 豚骨 \| その他）。単一選択 |
| `feature_tags` | — | スキーマのみ | 特徴タグ（複数可）。別テーブルで持つ |
| `noodle_thickness` | — | スキーマのみ | 麺の太さ |
| `noodle_curl` | — | スキーマのみ | 麺の縮れ |
| `richness` | — | スキーマのみ | あっさり⇔こってりの段階値 |
| `originator_shop` | — | スキーマのみ | 元祖店 |

**フェーズ1で入力するのは `primary_style` のみ。** 他はスキーマだけ用意する。

属性は読み物ではなく**フィルタとして機能する構造化タグ**として設計する（「こってり × 太麺だけ表示」を成立させるため）。

### 3.6 `food_item_regions` — 地域リレーション（型付き）

| カラム | 型 | 内容 |
| :--- | :--- | :--- |
| `food_item_id` | uuid | FK |
| `pref` / `city` | text | |
| `lat` / `lng` | double precision | |
| `relation_type` | text | `発祥` \| `名産地` \| `主要提供圏` \| `本場` |
| `note_ja` / `note_en` | text | **NULL可**。`本場` では必須＝「構造的理由の一文」（`ia-atlas-content` Skill §2.4）。詳細・地域ページに表示される |
| `is_representative` | boolean | **代表名物フラグ（フェーズ2）** |

1アイテムが複数の地域と異なる関係を持つ場合を表現する。

- 讃岐うどん = 発祥:香川 + 主要提供圏:全国
- マグロ = 複数の名産地（大間 / 那智勝浦 / 三崎）
- 海鮮丼（国民食型・発祥ピンなし）= 複数の本場（釧路 / 小樽 / 函館 / 金沢）

`本場`の意味・編集要件・表示方針は `ia-atlas-content` Skill §2.4 が正。`source_url` 付きで投入すると `food_item_sources` にも記録される（`scripts/import-regions.ts`）。

**代表名物フラグ**は「秋田＝きりたんぽ」のような看板アイテムを地域ページ冒頭・県タップ時に最優先表示するためのもの。県レベルとエリアレベルで代表が変わる（石川県 / 金沢 / 能登）ため、`food_items` ではなく本テーブル側に持たせる。

### 3.7 `food_item_relations` — アイテム間リンク（全ジャンル横断）

| カラム | 型 | 内容 |
| :--- | :--- | :--- |
| `from_id` / `to_id` | uuid | FK → `food_items` |
| `relation_type` | text | `代表ネタ` \| `使用食材` \| `派生` など |

江戸前寿司↔コハダ、味噌カツ↔八丁味噌、ラーメン↔ブランド地鶏のような**双方向回遊**を実現する。ジャンル横断回遊率（`.doc/20_data/03_log_design.md`）を支える中核テーブル。

### 3.8 `shops` — 店舗（フェーズ2以降。スキーマ予約のみ）

| カラム | 型 | 内容 |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `name` | text | |
| `food_item_id` | uuid | FK |
| `lat` / `lng` | double precision | |
| `role` | text | `originator`（元祖・編集掲載） \| `sponsored`（広告枠） |
| `sponsored_until` | date | 広告枠の掲載期限 |

`sponsored` は**ページ最上部の1枠限定 + 「PR」表記を必須表示**する。編集掲載（元祖店）とは別枠として扱い、中立性を保つ（`.doc/00_concept/01_north_star.md` §2）。

### 3.9 `chains` / `chain_recommendations` — チェーン橋渡し

企業単一ブランドは図鑑アイテム（`food_items`）にしない原則のまま、有名チェーンを「このチェーンの味が好きなら、この系統・ご当地へ」という入口装置として別枠で持つ（`ia-atlas-content` Skill §3）。

| カラム（chains） | 型 | 内容 |
| :--- | :--- | :--- |
| `slug` | text | UNIQUE |
| `name_ja` / `name_en` | text | |
| `style_ja` / `style_en` | text | 味の系統（説明的でよい） |
| `bridge_ja` / `bridge_en` | text | 橋渡しの一文（事実ベース・断定しない・優劣なし） |
| `genre_slug` | text | セクションを出すジャンル（データ駆動。ジャンル固有のハードコードをしない） |
| `pref_limited` | text | **NULL可**。地域限定チェーン（静岡のさわやか等）の都道府県。該当地域ページにも出す（将来） |
| `source_url` / `source_note` | text | 内部検証用。**UI非表示** |

`chain_recommendations` は `chain_id` → `food_item_id` の推薦リンク（表示はアイテムリンクのみ。系統レベルの推薦は bridge 文が担う）。投入は `data/chains.json` → `scripts/import-chains.ts`。チェーンのロゴ・画像は使わない（商標。テキストのみ）。

## 4. 粒度の方針

データは最初から**市町村 + 座標**で保持する。表示は当面県単位とし、地図のズームでエリア表示に切り替える。座標は市町村役場等の代表点でよい。

## 5. フェーズ別の実装範囲

| テーブル | フェーズ1 | 備考 |
| :--- | :--- | :--- |
| `genres` | ✅ 作成・投入 | ラーメン1件のみ |
| `food_items` | ✅ 作成・投入 | 約180件 |
| `food_item_translations` | ✅ 作成・投入 | `ja` / `en` |
| `food_item_sources` | ✅ 作成・投入 | |
| `dish_details` | ✅ 作成 | `primary_style` のみ投入 |
| `food_item_regions` | ⬜ 作成のみ | フェーズ1は `food_items` の発祥地で足りる |
| `food_item_relations` | ⬜ 作成のみ | ジャンル横断が発生するフェーズ2から |
| `shops` | ⬜ **作成しない** | スキーマ予約のみ。フェーズ2で作成 |

`TODO: [食材展開型（寿司×ネタ等）の詳細テーブル構造は、フェーズ3のジャンル選定時に設計する。ネタ固有情報（魚種・旬・仕込み方）を専用詳細テーブルで持ち、産地は food_item_regions（relation_type=名産地）、スタイル↔ネタの紐付けは food_item_relations で表現する方針まで決定済み]`

## 6. RLS

全テーブルに RLS を有効化する（Platform `../.doc/10_system/06_security.md`）。フェーズ1〜2は認証を持たないため、ポリシーは「`status = 'published'` の行のみ匿名読み取り可・書き込み全拒否」となる。詳細は `.doc/10_system/01_architecture.md` §4（セキュリティ）。

## 7. マイグレーション計画・Seed方針

共通方針: `../.doc/20_data/02_migrations.md`（マイグレーション運用・型生成 `supabase gen types`・ORMを採らない方針・Seedデータ方針）

Itadaki Atlas の初期マイグレーション内容・マスタデータ投入計画・Seedデータを定義する。共通のマイグレーション運用・型生成方針は Platform が正であり、本節は**本プロダクト固有の内容のみ**を持つ。**スキーマ変更時は本ファイル §1〜§6 を先に更新してから**マイグレーションを作成する。

### 7.1 PostgreSQL 拡張

**フェーズ1では追加しない**（PostGIS の封印理由と解禁条件は `.doc/10_system/01_architecture.md` §2.1）。全文検索は Postgres 組み込みの FTS を使う。

### 7.2 初期マイグレーションの順序

RLS ポリシーはテーブル作成と**同一コミット**に含める（Platform §1、`.doc/10_system/01_architecture.md` §4）。

| # | 内容 |
| :--- | :--- |
| 1 | `genres` 作成 + RLS |
| 2 | `food_items` 作成 + RLS（`genres` への FK） |
| 3 | `food_item_translations` 作成 + RLS |
| 4 | `food_item_sources` 作成 + RLS |
| 5 | `dish_details` 作成 + RLS |
| 6 | `food_item_regions` 作成 + RLS（フェーズ1は投入なし・器のみ） |
| 7 | `food_item_relations` 作成 + RLS（同上） |
| 8 | 索引・検索用のインデックス（`slug`、`genre_id`、FTS） |

`shops` は**フェーズ1では作成しない**（本ファイル §5）。スキーマ予約のみで、実際の作成はフェーズ2。

作成手順・命名規則・冪等性の担保は **`supabase-migration` Skill** に従う。

### 7.3 本番マスタデータの投入計画

#### 7.3.1 対象

| データ | 件数 | 投入方式 |
| :--- | ---: | :--- |
| `genres`（ラーメン） | 1 | マイグレーション内に直接記述 |
| `food_items` + 翻訳 + 出典 + `dish_details` | 約180 | **CSVインポートスクリプト** |

#### 7.3.2 CSVインポートフロー

1. スプレッドシートでテンプレを作成する
   - 列: `name_ja` / `name_en` / `origin_pref` / `origin_city` / `lat` / `lng` / `primary_style` / `summary_ja` / `summary_en` / 出典メモ
2. 約180種を調査・入力する（座標は市町村役場等の代表点でよい）
3. インポートスクリプトでDBへ流し込む
4. `status = 'draft'` で投入し、確認後に `published` へ

#### 7.3.3 インポート時のバリデーション（`zod`）

**投入時点で弾く**ことで、公開後の修正コストを避ける。

| 項目 | ルール |
| :--- | :--- |
| `slug` | 必須・一意・英小文字とハイフンのみ |
| `name_ja` / `name_en` | **両方必須。** 片方欠けたレコードを入れない |
| `name_romaji` | 必須 |
| 出典 | **1件以上必須**（`.doc/40_operation/01_strategy.md` §1.1） |
| `lat` / `lng` | 数値。NULL可だが、**片方だけの入力を禁止**する |
| `lat` | 20〜46 の範囲（日本国内の妥当性チェック） |
| `lng` | 122〜154 の範囲（同上） |
| `primary_style` | 醤油 / 味噌 / 塩 / 豚骨 / その他 のいずれか |
| `origin_pref` | 都道府県名マスタと一致すること |

**三点セット（日本語名 — ローマ字 — 英訳）の欠けと、出典なしは投入を通さない。** この2つはブランドの機能要件であり、後から埋める運用にすると必ず抜ける（`.doc/00_concept/05_brand.md` §5）。

#### 7.3.4 スクリプトの置き場所

インポートスクリプトは本番データ投入という**一度きりに近い運用**だが、フェーズ2以降のジャンル追加でも再利用する。使い捨てにせず、`scripts/` 配下に残してバリデーションごと保守する。

`TODO: [インポートスクリプトの具体的な実装場所とCLI引数（ジャンル指定・dry-run）を、M1 着手時に確定する]`

### 7.4 開発/CI用 Seedデータ

`supabase/seed.sql` に少数のダミーデータを用意し、E2Eテスト（Platform `../.doc/10_system/07_testing.md`）から参照できるようにする。

| 内容 | 件数 | 目的 |
| :--- | ---: | :--- |
| `genres` | 1 | ジャンルルーティングの検証 |
| `food_items`（`published`） | 3〜5 | 地図・索引・詳細の表示検証 |
| `food_items`（`draft`） | **1以上** | **RLS の検証。** `anon` で取得できないことを確認するために必須 |
| 翻訳（`ja` / `en`） | 全件分 | 言語切替の検証 |
| 翻訳欠け（`en` のみ無し） | 1件 | **フォールバック（`en` → `ja`）の検証** |

`draft` レコードと翻訳欠けレコードを**意図的に含める**のが要点。正常系だけのSeedでは、RLSとフォールバックという最も壊れやすい2箇所を検証できない。
