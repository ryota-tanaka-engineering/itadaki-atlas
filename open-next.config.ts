// @opennextjs/cloudflare configuration for itadaki-atlas.
//
// ポータビリティ規約（`.doc/10_system/02_infrastructure.md` §5 /
// `../.doc/10_system/02_infrastructure.md` §3）に従い、Workers固有ストレージ
// （KV / D1 / Durable Objects）をアプリの**動作要件**にはしない
// （このR2バケットが無くても各ページは動く。無いとISRの再検証結果が
// キャッシュされず、実質SSRに近い挙動へ自動的にフォールバックするだけ）。
//
// 2026-09: 本番トップの初期応答が約2.4秒（毎リクエストSupabase全件取得）だった
// ため、ISR（`export const revalidate = 300`）を導入。OpenNext CloudflareでISRの
// 再検証結果を永続化するには incremental cache が必要（static-assets実装は
// ビルド時プリレンダー成果物の読み取り専用で、再検証結果を書き戻せずISRが
// 効かない）。R2実装に切り替え、Workerインスタンス内の短命メモリで往復を
// 減らす regional cache を重ねる（公式: https://opennext.js.org/cloudflare/caching ）。
// R2バケットは `.doc/10_system/02_infrastructure.md` §2 の地図タイル用と同じ
// S3互換オブジェクトストレージであり、ロックイン度は低い（同ドキュメント §5）。
//
// 地図タイル配信に使う既存R2（`itadaki-atlas-tiles`）はこの用途に転用しない。
// ブラウザから直接読む静的ファイル置き場であり、Workers のバインディングを
// 経由しないため、別バケット（`itadaki-atlas-next-cache`）を用意した。
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";

export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
});
