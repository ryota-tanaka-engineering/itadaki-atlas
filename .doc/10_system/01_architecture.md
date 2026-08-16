# 目的

Itadaki Atlas の技術構成のうち、**Platform の固定スタックからの差分**だけを定義する。共通部分（Next.js App Router / TypeScript strict / Tailwind + shadcn/ui / Supabase / zod + react-hook-form / date-fns / Vitest + Playwright）は再掲しない。

参照する Platform ファイル:

- `../.doc/10_system/01_architecture.md` — 固定スタックと構成戦略（本ファイルの前提）
- `../.doc/10_system/05_libraries.md` — 固定スタックライブラリ一覧
- `../.doc/10_system/02_infrastructure.md` — ホスティング方針・ポータビリティ規約
- `../.doc/10_system/10_growth_infra.md` — 国際化（i18n）の共通方針
- `../.doc/20_data/02_migrations.md` — マイグレーション運用・**型生成**・ORMを採らない共通方針

## 1. 追加ライブラリ（Platform に無いもの）

本プロダクトは「地図を主UIとする地理データベース」であり、Platform が想定していない領域のライブラリを要する。

| ライブラリ | 用途 | 選定理由 |
| :--- | :--- | :--- |
| **MapLibre GL JS** | 地図描画 | ベクタタイルによる滑らかなズーム。Mapbox GL のOSSフォークで**ベンダロックインが無く**、タイル提供元を差し替え可能（ポータビリティ規約に適合） |
| **Framer Motion** | ボトムシート・地図切替のアニメーション | ドラッグ可能な3段階スナップシート（`.doc/30_features/02_ui_ux.md`）は CSS transition では実装が破綻する。ジェスチャとスプリング物理が必要 |

これらは本プロダクト固有であり、2プロダクト目で必要になった時点で Platform への昇格を検討する（`../.doc/documentation_rules.md` §6A）。

## 2. データ層の差分

### 2.1 PostgreSQL 拡張

**フェーズ1では拡張を追加しない。** 素の PostgreSQL で構成する。

| 機能 | フェーズ1の実装 | 判断 |
| :--- | :--- | :--- |
| 地図表示（約180件のピン描画） | `lat` / `lng` を素の数値列（`double precision`）で保持。絞り込みが要る場合は緯度経度の範囲比較（バウンディングボックス） | **PostGIS 不要。** フェーズ1のUXは「全件をピン表示」「索引で引く」であり、半径検索・距離ソートがスコープに無い |
| 検索（アイテム名・説明文） | Postgres 組み込みの FTS | 標準機能。拡張のインストール不要 |

#### PostGIS の封印と解禁条件

| 項目 | 内容 |
| :--- | :--- |
| **封印するもの** | PostGIS 拡張、`geography` / `geometry` 型の列、地理インデックス |
| **理由** | フェーズ1に半径検索・距離ソートの要件が無く、約180件の規模では素の数値比較で足りる。最初から入れるとローカル開発環境・ホスティング選定の前提が1つ増える |
| **解禁条件** | 「現在地から近いものを探す」「距離順に並べる」が要件化した時点（フェーズ2以降を想定） |
| **解禁コスト** | 低い。拡張を有効化し、既存の `lat`/`lng` から生成列とインデックスを足すだけで移行できる。**この移行しやすさを保つため、座標は最初から素の数値列で持つ**（`geography` 型で保存しない） |

- **Elasticsearch は不採用。** 約180件〜将来数千件の規模に対して運用コストが見合わない
- 検索精度が要件を満たさなくなった場合に限り **Meilisearch の後乗せ**を検討する。そのため検索処理はアプリ層で1箇所に隔離し、差し替え可能に保つ

### 2.2 JSONB を採用しない

ジャンルごとに異なる詳細属性を JSONB で持つ設計は**採らない**。後から型安全化するコストが、初期のスキーマ設計コストを上回るためである。

代わりに「**共通コア + タイプ別詳細テーブル**」構成を取る。詳細は `.doc/20_data/01_models.md`。

### 2.3 ORM は採用しない（決定）

計画書は Prisma or Drizzle による「スキーマ→型の一気通貫」を想定していたが、**ORM は導入しない**。期待されていた役割が ORM 無しで満たせるうえ、導入コストが実益を上回るため。

#### 期待されていた役割と、その代替

| 期待していた役割 | 代替手段 |
| :--- | :--- |
| スキーマ→型の一気通貫 | **`supabase gen types typescript`**（Supabase標準機能）。DBスキーマから型定義を生成する。運用ルールは Platform `../.doc/20_data/02_migrations.md` |
| 入力・境界のバリデーション | `zod`（Platform 固定スタック。変更なし） |
| 多対多の辿り・複雑クエリ | **Postgres の View + RPC（Postgres関数）** |

#### 導入しない理由

- **マイグレーションの正が2つになるのを避ける。** Platform は SQL マイグレーション（`supabase/migrations` + `supabase-migration` Skill）を運用の正と定めている。ORM は自前のマイグレーション体系を持つため、スキーマの真実の所在が二重化する
- **実装規約との衝突を避ける。** `ia-nextjs-standards` は「Supabaseへのアクセスは `src/lib/supabase/` 経由のみ」と定めている
- **移行耐性はむしろ ORM 無しの方が高い。** 生成型 + 素のSQL は、ホスティングやBaaSを移しても資産がそのまま残る（ポータビリティ規約）

#### 複雑クエリの解き方

ORM が欲しくなる唯一の場面は `food_item_relations` / `food_item_regions` の多対多の辿りである（例: 江戸前寿司↔コハダ、讃岐うどん＝発祥:香川＋主要提供圏:全国）。PostgREST ベースの Supabase クライアントは深いジョインが書きにくいため、ここは **View + RPC** で解く。

SQL に寄せることで `supabase-migration` Skill の運用にそのまま乗り、標準Postgres互換も保てる。具体的な View / RPC の設計は `.doc/20_data/01_models.md`。

## 3. 国際化（i18n）

**差分なし。** ライブラリ（`next-intl`）・サブパス方式・手動切り替え・翻訳の二層方式は、いずれも Platform の共通方針（`../.doc/10_system/10_growth_infra.md` §3）に従う。

本プロダクトが多言語を要する第一号だったため、方針の策定は本プロダクトを起点に行い、**共通化して Platform に還元済み**である。

対象言語と翻訳テーブルの具体的な実装は `.doc/10_system/10_growth_infra.md`。

## 4. 認証の封印

**フェーズ1〜2は認証を実装しない。** 理由と解禁条件を差分として記録する（`../.doc/documentation_rules.md` §4B）。

| 項目 | 内容 |
| :--- | :--- |
| **封印するもの** | Supabase Auth、ユーザーテーブル、ログイン導線、RLSのユーザー単位ポリシー |
| **理由** | フェーズ1〜2に認証を要する機能が無い。注目度分析は GA のページトラッキングで足り、お気に入りは localStorage（端末内保存）で提供できる |
| **解禁条件** | **制覇マップ**（食べたご当地グルメの塗りつぶし）を実装する時点。端末を跨いで永続させたいデータであり、ユーザーが自発的に登録する動機になる唯一の機能 |
| **前提の固定** | 解禁時は **Supabase Auth** を使う（Platform 既定どおり）。将来 `deep-local` / `food-recommend` と IA MIRACOLO 共通アカウント化する構想があり、DBと同一基盤で複数サービス共有が可能なため |

公開データのみを扱う間も、**テーブルには RLS を必ず設定する**（Platform `06_security.md`。匿名読み取り許可 + 書き込み拒否）。RLS ポリシーの詳細は `.doc/10_system/06_security.md`。

## 5. ホスティング

**差分なし。Platform 既定に従う。**

- **Cloudflare Workers（OpenNext 経由）** — `../.doc/10_system/02_infrastructure.md` §1「最初から動的（SSR / API / DB）」の経路。Supabase からのデータ取得と事業者問い合わせフォーム、および `next-intl` の middleware（初回訪問時の言語誘導）があるため、静的 export（Pages）では成立しない
- 出口戦略は Platform §2 のとおり **AWS**（ECS Fargate + ALB / Supabase → RDS）
- ポータビリティ実装ルール（Platform §3）をそのまま適用する

計画書は Vercel を想定していたが、**Platform が Vercel を不採用と決定済み**のため採らない（理由: Hobbyプランは非商用利用限定・Proは月$20の固定費）。計画書 §13「ホスティング（Vercel想定だが未確定）」は本決定で解消とする。

### 本プロダクト固有の変数: 地図タイル配信

Platform が想定していない固有のコスト要因であり、**ここだけが実質的な選定対象**となる。

地図は1回の表示で数十枚のタイルを取得するため、コストは転送量に支配される。SEO でトラフィックを伸ばすことが事業戦略であるため、**表示回数に比例して課金される方式は成功するほど不利になる**。

| 方式 | コスト構造 | 判断 |
| :--- | :--- | :--- |
| **Protomaps（PMTiles）を R2 から配信** | 保管料のみ。**R2 は egress 無料**のため、トラフィックが増えても金額がほぼ動かない | **本命。** 単一ファイルへの HTTP Range リクエストで読むため、タイルサーバのプロセスが不要 |
| 商用タイルサービス（Mapbox / MapTiler 等） | 表示回数ベースの従量課金 | 導入は速いが、事業戦略と逆行するコスト構造 |
| OSM 公式タイル | 無料 | **不可。** 利用規約が商用・高負荷利用を禁止している |

R2 を使う場合も Platform §3 ルール2 に従い、**S3 互換 API で実装**して移行時にエンドポイント差し替えで済む状態を保つ。

コスト試算（MVP / 1年後 / 10倍）・スケールトリガー・ドメイン・ベンダ固有依存の記録は `.doc/10_system/02_infrastructure.md`（Platform §5 の要求事項）。

## 6. アーキテクチャ概要

Platform の構成（`../.doc/10_system/01_architecture.md` §3）に、地図タイル配信を加えたもの。

```mermaid
graph TD
    User[User / Browser] -->|HTTPS| CF[Cloudflare Workers<br/>OpenNext]
    CF -->|SSG / ISR| Next[Next.js App Router]
    Next -->|Server Components / View + RPC| Supabase[(Supabase<br/>PostgreSQL + FTS<br/>PostGISは封印)]
    User -->|ベクタタイル HTTP Range| R2[(Cloudflare R2<br/>Protomaps PMTiles)]
    Next -.->|フェーズ3で解禁| Auth[Supabase Auth]
```

Platform の原則（データ取得はサーバー側 / 外部境界に zod / ベンダ固有APIを直書きしない）はそのまま適用する。

## 7. TODO 一覧

- [x] ~~ORM を導入するか決定する~~ → **不採用**に決定（§2.3）。`supabase gen types` + zod + View/RPC で構成する
- [x] ~~i18n ライブラリを選定する~~ → `next-intl` に決定し、Platform `10_growth_infra.md` §3 へ還元済み
- [x] ~~PostGIS を初期から入れるか~~ → **フェーズ1では封印**（§2.1）。解禁条件は「半径検索・距離ソートの要件化」
- [x] ~~ホスティングを選定する~~ → Platform 既定どおり **Cloudflare Workers（OpenNext）**（§5）
- [x] ~~地図タイルの配信構成を確定する~~ → **Protomaps（PMTiles）を R2 から配信**に決定（§5）。コスト試算3点は `.doc/10_system/02_infrastructure.md` §3。**ユーザー承認待ち**
- [ ] ディフォルメ地図の実装方式を決定する（自前SVG or ライブラリ。M4 着手前。`.doc/30_features/02_ui_ux.md`）
