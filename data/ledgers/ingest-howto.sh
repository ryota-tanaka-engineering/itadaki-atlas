#!/usr/bin/env bash
# 4章目「どう食べるのか」＋麺・濃さの束（data/howto/<name>.json）を検証→ローカル→本番→lint まで。
# 使い方: bash data/ledgers/ingest-howto.sh ramen-01 ramen-02 ...   （引数なしなら data/howto/*.json 全部）
# 前提: マイグレーション 20261004000000_dish_details_noodle_vocab.sql を当ててあること。
#       本番の鍵は scripts/prod-env.sh が .env.production.local（PROD_SUPABASE_SERVICE_ROLE_KEY）または
#       supabase CLI から取る。bash で実行（fish 不可）。フォアグラウンドで。
set -u
cd "$(dirname "$0")/../.."
if [ $# -eq 0 ]; then set -- $(ls data/howto/*.json | xargs -n1 basename | sed 's/\.json$//'); fi
echo "== dry-run"
for n in "$@"; do printf "%-10s" "$n"; node --env-file=.env.local scripts/import-howto.ts --file "data/howto/$n.json" --dry-run 2>&1 | grep -E "^読み込み|△|^\[|格付け" | head -20; done
read -r -p "ローカルへ投入しますか？ [y/N] " ans; [ "$ans" = "y" ] || exit 0
echo "== local"
for n in "$@"; do printf "%-10s" "$n"; node --env-file=.env.local scripts/import-howto.ts --file "data/howto/$n.json" 2>&1 | grep -E "^完了|✗" | tail -3; done
node --env-file=.env.local scripts/content-lint.ts 2>&1 | grep -E "^対象|✗|△ W1|△ W5|E項目"
read -r -p "本番へ投入しますか？ [y/N] " ans; [ "$ans" = "y" ] || exit 0
echo "== prod"
for n in "$@"; do printf "%-10s" "$n"; bash scripts/prod-env.sh node scripts/import-howto.ts --file "data/howto/$n.json" 2>&1 | grep -E "^完了|✗" | tail -3; done
bash scripts/prod-env.sh node scripts/content-lint.ts 2>&1 | grep -E "^対象|✗|△ W5|E項目"
