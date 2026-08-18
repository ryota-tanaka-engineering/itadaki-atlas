@AGENTS.md

# Itadaki Atlas

日本食を超細分類し、歴史と発祥地を日本地図にマッピングして紹介するWebサイト。主対象は海外（英語圏）ユーザー。将来的にはブランド牛・地鶏・酒・土産品まで含む「**日本の食の地理データベース**」を目指す。

## North Star

全社の「信頼関係の総量最大化」を、本プロダクトでは**3層の信頼**として具体化する。

読者（正確で深い）／事業者（中立な媒体）／送客先（薦めた先だから間違いない）——**3つ揃って初めて送客が成立する**。

- **KGI は PV ではなく「既存事業への送客数」。** PVを頂点に置くとバズ狙いへ判断が歪むため
- 判断に迷ったら **正確さ > 網羅性 > 速度**
- 詳細: `.doc/00_concept/01_north_star.md`

## 規約

- **実装規約: `ia-nextjs-standards` Skill**（コードを書く前に必ず参照）
- **ドキュメント: `ia-doc-sync` Skill**（`.doc` の差分主義・SSOT）
- マイグレーション: `supabase-migration` Skill
- 共通方針（インフラ・i18n・型生成・セキュリティ）は Platform `../.doc/` が正。**Product側に再掲しない**

## コマンド

| コマンド | 内容 |
| :--- | :--- |
| `npm run dev` | 開発サーバー（**ポート3300**。3000=deep-local / 3100=oyster-media / 3200=food-recommend と衝突回避） |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | 型チェック |
| `npm run test` | Vitest 単体（`src/**/*.test.ts(x)` にソース併置） |
| `npm run test:watch` | Vitest ウォッチ |
| `npm run test:e2e` | Playwright E2E（`tests/`。devサーバーは自動起動） |
| `npm run build` | 本番ビルド |
| `NEXT_OUTPUT=standalone npm run build` | ポータビリティ規約の確認用 |

## 現在の状態

**フェーズ1のページ型は全て実装済み・未デプロイ。** データ投入だけでサイトが伸びる（ジャンル追加にコード変更不要）。投入済み: 5ジャンル91件（ラーメン58・焼き鳥14・寿司7・和牛10・牡蠣2）・40都道府県。

| ページ型 | 状態 |
| :--- | :--- |
| トップ（地図 + ボトムシート + 3軸索引 + ディフォルメ地図） | ✅ |
| `/[genre]`（系統別一覧 + 図鑑 + 地域チップ） | ✅ |
| `/[genre]/[slug]`（三点セット・出典・つながり） | ✅ |
| `/region/[pref]`（ジャンル横断。データがある県のみ生成） | ✅ |
| OGP共有カード（詳細・ジャンル） | ✅ |
| i18n（/ja /en・hreflang・sitemap） | ✅ |

| 項目 | 状態 |
| :--- | :--- |
| デプロイ先 | **未作成**（Cloudflare Workers / OpenNext を予定） |
| 公開URL | **なし** |
| Supabase プロジェクト | **未作成**（東京 `ap-northeast-1` / Free で作る） |
| ドメイン | `itadakiatlas.com` **未取得**（Cloudflare Registrar） |
| Sentry | **未導入**（初回デプロイ時） |

次の作業は `.doc/99_management/01_roadmap.md` の M1（スキーマ実装 + CSVインポート）。

## 意図的な制約（勝手に外さない）

いずれも理由と解禁条件を `.doc` に記録済み。**必要になったら解禁する**もので、忘れられているわけではない。

| 封印 | 解禁条件 | 記録先 |
| :--- | :--- | :--- |
| **PostGIS** | 半径検索・距離ソートが要件化したとき | `.doc/10_system/01_architecture.md` §2.1 |
| **ORM（Prisma/Drizzle）** | 採用しない。`supabase gen types` + zod + View/RPC で構成する | 同 §2.3 |
| **認証（Supabase Auth）** | 制覇マップを実装するとき（フェーズ3） | 同 §4 |
| **写真・イラスト** | フェーズ2。スタイル確定プロセスを経てから | `.doc/40_operation/01_strategy.md` §2 |
| **コメント欄** | 設けない。交流はSNS側で起こす | 同 §4.1 |

座標は `lat`/`lng` の**素の数値列**で持つ（PostGIS解禁コストを低く保つため。`geography` 型で保存しない）。

## 固有の実装方針

- **地図**: MapLibre GL JS + Protomaps（PMTiles）を R2 から配信。ベースマップとピン（自社データ）は別レイヤーで、アイテム追加でタイル再生成は不要
- **i18n**: `next-intl` / サブパス方式（`/ja/` `/en/`）。**自動リダイレクトはしない**（Platform `../.doc/10_system/10_growth_infra.md` §3）
- **名称表記**: 全アイテムで「**日本語名 — ローマ字 — 英訳（説明訳）**」の三点セット。装飾ではなく機能要件
- **リンクをボタン風にする場合**は `Button` コンポーネントではなく `buttonVariants()` をクラスとして当てる。`Button` + `nativeButton={false}` は `<a>` に `role="button"` を付け、スクリーンリーダーがリンクをボタンとして読み上げるため（WCAG 2.2 AA を要件に掲げている）
