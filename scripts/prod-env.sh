#!/bin/bash
# 本番 Supabase の環境変数を注入して任意のコマンドを実行するラッパー。
#
# フォアグラウンド実行前提（バックグラウンド化しない）。npx supabase projects api-keys が
# CLIログイン状態を要求するため、非対話環境では失敗しうる。鍵は標準出力・ログに一切出さない。
#
# 使い方:
#   bash scripts/prod-env.sh node scripts/import-content.ts --file data/content/<name>.json
#   bash scripts/prod-env.sh node scripts/content-lint.ts --strict
set -eo pipefail
cd "$(dirname "$0")/.."

REF=xzkvvdldovgbuutttmzj
export NEXT_PUBLIC_SUPABASE_URL="https://${REF}.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY=$(npx supabase projects api-keys --project-ref "$REF" -o json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s.slice(s.indexOf('['))); console.log(j.find(x=>x.name==='service_role').api_key);})")

"$@" 2>&1 | grep -v "Warning\|Reparsing\|type.*module\|trace-warnings"
