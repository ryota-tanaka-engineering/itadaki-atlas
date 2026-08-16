# 目的

Itadaki Atlas のインフラ構成・コスト試算・スケールトリガー・ベンダ固有依存を記録する。ホスティング方針そのものは Platform で決定済みであり、本ファイルは**その適用結果と本プロダクト固有の数値**のみを持つ。

参照する Platform ファイル:

- `../.doc/10_system/02_infrastructure.md` — ホスティング既定（Cloudflare）・出口戦略（AWS）・ポータビリティ実装ルール・ドメイン/DNS/メール方針
- `../.doc/10_system/01_architecture.md` — 固定スタック

## 1. 構成（Platform 既定の適用結果）

| レイヤ | 採用 | 根拠 |
| :--- | :--- | :--- |
| ホスティング | **Cloudflare Workers**（OpenNext 経由） | Platform §1 の「最初から動的（SSR / API / DB）」経路。Supabase からのデータ取得・問い合わせフォーム・`next-intl` の middleware があるため静的 export では成立しない |
| DB | **Supabase**（Free から開始・東京 `ap-northeast-1`） | Platform 固定スタック |
| 地図タイル | **Cloudflare R2**（Protomaps / PMTiles 形式） | 本プロダクト固有。§2 参照 |
| ドメイン | `itadakiatlas.com`（**Cloudflare Registrar**） | Platform §4（gTLD は Cloudflare Registrar、原価販売） |
| メール | Cloudflare Email Routing（受信転送） | Platform §4。事業者問い合わせフォームの通知先 |

Vercel は Platform §1 で不採用が決定済み（Hobby は非商用利用限定・Pro は月$20の固定費）。

## 2. 地図タイル配信: Protomaps（PMTiles）を R2 から配信

### 方式

日本全域のベクタタイルを**単一の `.pmtiles` ファイル**にまとめて R2 に置き、ブラウザから **HTTP Range リクエスト**で必要なバイト範囲だけを読む。タイルサーバのプロセスも DB も不要で、実体は「オブジェクトストレージ上の静的ファイル1個」となる。

### なぜこの方式か

地図は1回の表示で数十枚のタイルを取得するため、コストは**転送量とリクエスト数に支配される**。SEO でトラフィックを伸ばすことが事業戦略である以上、表示回数に比例して課金される商用タイルサービスは**成功するほど不利になる**。

R2 は **egress（下り転送）が無料**であり、PV が増えても転送費が発生しない。この構造が事業戦略と最も整合する。

### トレードオフ（承知の上で採用）

- 初回に `japan.pmtiles` の生成作業が必要（OSM 日本データの取得 → `planetiler` 等で変換 → R2 へアップロード）。**未経験の作業のため半日〜1日を見込む**
- 地図スタイル（色・線幅）を自前で用意する。Protomaps の既製スタイル（light / dark / white）を起点とする
- 商用サービスなら API キーだけで即日動く。**速度を捨ててコスト構造を取る**判断であり、「急いでいないためコストを優先する」という方針決定に基づく

### 自社データとの分離

ベースマップと掲載アイテムは別レイヤーであり、**アイテム追加でタイルを再生成する必要はない**。

| | 内容 | 取得元 | 更新頻度 |
| :--- | :--- | :--- | :--- |
| ベースマップ | 海岸線・県境・道路・地名 | R2 の `japan.pmtiles` | 年数回（OSM 反映時のみ） |
| ピン | 掲載アイテム（フェーズ1は約180件） | Supabase → GeoJSON → MapLibre レイヤー | コンテンツ追加のたび |

## 3. コスト試算

### 前提（仮定値）

`TODO: [公開後のベースライン計測でトラフィック実績が出た時点で、本試算の前提値を実測値に置き換える]`

| 時点 | 想定 PV/月 | 備考 |
| :--- | ---: | :--- |
| MVP（公開直後） | 5,000 | 仮定値 |
| 1年後 | 100,000 | 仮定値。SEO 育成後 |
| 10倍 | 1,000,000 | 仮定値 |

- タイル取得: **1 PV あたり 50 リクエスト**（地図の1表示で数十枚。パン・ズーム込みの概算）
- Workers 呼び出し: **1 PV あたり 3 リクエスト**（HTML + データ取得の概算）
- `japan.pmtiles` のサイズ: **3 GB** 想定

### 試算結果

単価は **2026-08-15 時点**の Cloudflare 公式価格に基づく。

| 項目 | MVP（5千PV） | 1年後（10万PV） | 10倍（100万PV） |
| :--- | ---: | ---: | ---: |
| Cloudflare Workers | $0（Free） | $0（Free） | $5（Paid） |
| R2 ストレージ 3GB | $0（無料枠 10GB） | $0 | $0 |
| R2 Class B（タイル読取） | $0（25万件） | $0（500万件） | $14.4（5,000万件） |
| R2 egress | $0 | $0 | $0 |
| Supabase | $0（Free） | $0（Free） | $0〜25 |
| **合計（月額）** | **$0** | **$0** | **約$20〜45** |

参照した無料枠・単価:

- Workers Free: 100,000 リクエスト/日。Paid: $5/月（1,000万リクエスト込み）
- R2 無料枠: ストレージ 10 GB-month、Class A 100万/月、**Class B 1,000万/月**、egress 無料
- R2 従量: ストレージ $0.015/GB-month、Class B $0.36/100万リクエスト

**月10万PVまで実質 $0 で運用できる。** 100万PVでも月$20〜45に収まる。

### 商用タイルサービスとの比較

`TODO: [商用タイルサービス（MapTiler / Mapbox 等）の現行単価は未検証。比較を対外的に使う場合は実価格を確認する]`

表示回数ベースの従量課金であるため、月10万PVの水準で**桁が2つ変わる**見込み。ただし具体額は未確認のため、本ファイルでは採用判断の根拠を「コスト構造（従量 vs 固定）」に置き、金額比較には依存しない。

## 4. スケールトリガー（AWS 移行の判断条件）

移行先は Platform §2 のとおり **AWS**（ECS Fargate + ALB / Supabase → RDS）。以下のいずれかに到達した時点で移行を検討する。**到達前に前倒しで移行しない。**

| # | トリガー | 理由 |
| :--- | :--- | :--- |
| 1 | Workers Paid の CPU 時間（3,000万 CPU ms/月）を継続的に超過 | Workers の課金モデルが不利になる水準 |
| 2 | Supabase が Pro プランでも DB 容量・同時接続数の制約に当たる | DB がボトルネックになった時点 |
| 3 | Workers ランタイム非互換のライブラリが必須要件になる | Platform §1 の「最初からAWS」条件3と同じ判断 |

**R2 のコスト増は移行トリガーにしない。** 5,000万リクエスト/月でも月$14程度であり、AWS（S3 + CloudFront）に移しても egress 課金が発生するぶん**むしろ高くなる**ため。

## 5. ベンダ固有依存の記録

Platform §3 のポータビリティ実装ルールの適用状況。

| 依存対象 | ロックイン度 | 移行時の扱い |
| :--- | :--- | :--- |
| **R2** | 低 | S3 互換 API で実装する（Platform §3 ルール2）。エンドポイント差し替えのみで S3 へ移行可能 |
| **PMTiles ファイル** | **なし** | 単なる静的ファイル。S3 へコピーすれば移行完了。形式はオープン仕様 |
| **MapLibre GL JS / Protomaps** | **なし** | いずれも OSS。Mapbox のような商用ライセンス制約を持たない |
| **OpenNext** | 低 | ビルド時アダプタ。AWS アダプタ（Lambda + CloudFront）へ差し替え可能（Platform §2） |
| **Supabase（DB）** | 低 | 標準 Postgres。`pg_dump` で RDS / Aurora へ移行 |
| **Supabase Auth** | **中（将来）** | フェーズ3の認証解禁時に発生する。Platform §3 ルール4 のとおりロックイン項目として記録する。現時点では**未使用のため依存なし**（`.doc/10_system/01_architecture.md` §4） |

Workers 固有ストレージ（KV / D1 / Durable Objects）は**使用しない**（Platform §3 ルール1）。`output: 'standalone'` でビルド可能な状態を維持する（同ルール3）。

## 6. TODO

- `TODO: [ドメイン itadakiatlas.com を Cloudflare Registrar で取得する。SNSハンドル（@itadakiatlas: X / Instagram / TikTok / YouTube）も同時期に確保する。実装着手前に実施]`
- `TODO: [japan.pmtiles を生成し R2 へ配置する。生成手順とデータ更新頻度を確定して本ファイルに追記する。M2（地図表示）着手前]`
- `TODO: [Supabase プロジェクトを作成し（東京 ap-northeast-1 / Free）、URL・anon key・service_role key を .env.local と .env.local.example に反映する]`
- `TODO: [Sentry の DSN を発行し導入する。Platform 10_system/08_observability.md のとおり初回デプロイ時に実施]`
