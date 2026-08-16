// @opennextjs/cloudflare configuration for itadaki-atlas.
//
// ポータビリティ規約（`.doc/10_system/02_infrastructure.md` §5 /
// `../.doc/10_system/02_infrastructure.md` §3）に従い、Workers固有ストレージ
// （KV / D1 / Durable Objects、およびキャッシュ用途のR2）をアプリの動作要件にしない。
//
// incrementalCache には static-assets 実装（読み取り専用・プリレンダー成果物を
// アセットバンドルから配信）を使う。no-op の dummy キャッシュにすると SSG ページが
// 毎リクエストのオンデマンド描画になるため採らない。
//
// 制約: この構成では ISR（再検証）が使えない。フェーズ1のコンテンツは更新頻度が
// 低くSSGで足りるため問題にならないが、ISRが必要になった場合は
// `.doc/10_system/02_infrastructure.md` の再評価を経てから導入すること。
//
// 地図タイル配信に使う R2（`.doc/10_system/02_infrastructure.md` §2）は
// ブラウザから直接読む静的ファイル置き場であり、Workers のバインディングとしては
// 使わない。したがってポータビリティ規約に抵触しない。
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
