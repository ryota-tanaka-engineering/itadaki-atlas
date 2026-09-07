#!/bin/bash
# 本番ビルド + Cloudflare Workers デプロイ（CLAUDE.md「デプロイ先」）。
#
# - ローカル開発用の public/tiles/japan.pmtiles（384MB・gitignore対象）は Workers アセット上限
#   (25MiB) を超えるため、ビルドの間だけ退避する（本番は R2 配信）
# - NEXT_PUBLIC_* はビルド時にインライン化されるため、ここで本番値を注入する。
#   anon key は公開前提のキー（クライアントに埋め込まれる設計）なので env 経由でよい
# - 計測 ID（NEXT_PUBLIC_GA_ID / NEXT_PUBLIC_CF_BEACON_TOKEN）は .env.production.local
#   （gitignore対象）に置く。未設定ならタグは描画されない（src/components/Analytics.tsx）
# - 同ファイルに PROD_SUPABASE_ANON_KEY があれば supabase CLI（キーチェーン待ちで固まることがある）を呼ばない
set -euo pipefail
cd "$(dirname "$0")/.."

TILES=public/tiles/japan.pmtiles
STASH=/tmp/japan.pmtiles.deploy-stash
restore() { [ -f "$STASH" ] && mv "$STASH" "$TILES" && echo "(tiles restored)"; }
trap restore EXIT
[ -f "$TILES" ] && mv "$TILES" "$STASH"

if [ -f .env.production.local ]; then
  set -a; . ./.env.production.local; set +a
fi

REF=xzkvvdldovgbuutttmzj
export NEXT_PUBLIC_SUPABASE_URL="https://${REF}.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="${PROD_SUPABASE_ANON_KEY:-}"
[ -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ] || NEXT_PUBLIC_SUPABASE_ANON_KEY=$(npx supabase projects api-keys --project-ref "$REF" -o json \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s.slice(s.indexOf('['))); console.log(j.find(x=>x.name==='anon').api_key);})")
export NEXT_PUBLIC_SUPABASE_ANON_KEY
export NEXT_PUBLIC_PMTILES_URL="${NEXT_PUBLIC_PMTILES_URL:-https://pub-2b8d1a5772e14d0a812b9b3555ac420a.r2.dev/japan.pmtiles}"
[ -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ] || { echo "anon key empty"; exit 1; }
echo "GA: ${NEXT_PUBLIC_GA_ID:+set}${NEXT_PUBLIC_GA_ID:-unset} / CF beacon: ${NEXT_PUBLIC_CF_BEACON_TOKEN:+set}${NEXT_PUBLIC_CF_BEACON_TOKEN:-unset}"

npm run deploy:cf 2>&1 | tail -25
