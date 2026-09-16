#!/usr/bin/env bash
# 郷土料理 Tier2 本文束を scratchpad から取り込み、検査→ローカル→本番→コミットまで。
# 使い方: bash data/ledgers/ingest-tier2.sh <pref>...
# 前提: supabase CLI は同時1本・フォアグラウンド（memory: supabase-cli-background-hang）。bash で実行（fish 不可）
set -u
cd "$(dirname "$0")/../.."
SP=$(ls -d /private/tmp/claude-501/-Users-tanakaryouta-workspace-ia-miracolo/*/scratchpad/content 2>/dev/null | head -1)
# scratchpad からの取り込みはリポジトリに無い県だけ（リポジトリ側で直した本文を上書きしない）
for p in "$@"; do [ -f "$SP/tier2-$p.json" ] && [ ! -f "data/bodies3/tier2-$p.json" ] && cp "$SP/tier2-$p.json" data/bodies3/; done
node data/ledgers/check-tier2.js "$@" || { echo "検査NG。投入しない"; exit 1; }
echo "== local"
for p in "$@"; do printf "%-10s" "$p"; node --env-file=.env.local scripts/import-bodies.ts --file "data/bodies3/tier2-$p.json" 2>&1 | grep -E "^完了|✗" | tail -3; done
REF=xzkvvdldovgbuutttmzj
export NEXT_PUBLIC_SUPABASE_URL="https://${REF}.supabase.co"
SUPABASE_SERVICE_ROLE_KEY=$(perl -e 'alarm 60; exec @ARGV' npx supabase projects api-keys --project-ref "$REF" -o json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s.slice(s.indexOf("["))); console.log(j.find(x=>x.name==="service_role").api_key);})')
export SUPABASE_SERVICE_ROLE_KEY
[ -n "$SUPABASE_SERVICE_ROLE_KEY" ] || { echo "key EMPTY"; exit 1; }
echo "== prod"
for p in "$@"; do printf "%-10s" "$p"; node scripts/import-bodies.ts --file "data/bodies3/tier2-$p.json" 2>&1 | grep -E "^完了|✗" | tail -3; done
node scripts/content-lint.ts 2>&1 | grep -E "^対象|✗|△ W1|E項目"
git add data/bodies3 data/ledgers && git commit -q -m "feat(content): 郷土料理の本文3章（$*）

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Dy5cdrRCKzPkAiNY3LgEhU" && git push 2>&1 | tail -1
