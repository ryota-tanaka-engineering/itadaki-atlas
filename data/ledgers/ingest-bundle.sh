#!/bin/bash
# 使い方: bash ingest-bundle.sh <name> [<name>...]  — scratchpad/content/<name>.json をリポジトリへ写し、格付け語検査→ローカル投入→本番投入→検査。フォアグラウンドで実行
set -u
S=/private/tmp/claude-501/-Users-tanakaryouta-workspace-ia-miracolo/98c0ed5c-406a-480f-a772-02af38e851f1/scratchpad
cd /Users/tanakaryouta/workspace/ia-miracolo/itadaki-atlas
for n in "$@"; do cp "$S/content/$n.json" data/content/; done
python3 - "$@" <<'PY'
import json,re,sys
bad=False
BAD=re.compile(r'日本三大|三大|ランキング|一番人気|No\.1|認定された|受賞|全国一|金賞|日本一|全国で初めて')
for n in sys.argv[1:]:
    d=json.load(open(f'data/content/{n}.json'))
    print(n, 'items', len(d.get('items',[])), 'genres', [g['slug'] for g in d.get('genres',[])])
    for it in d.get('items',[]):
        for f in ('summary_ja','body_ja'):
            for m in BAD.finditer(it.get(f) or ''): print('  NG', it['slug'], f, it[f][max(0,m.start()-25):m.end()+25]); bad=True
        for r in it.get('regions') or []:
            for m in BAD.finditer(r.get('note_ja') or ''): print('  NG', it['slug'], 'region', r.get('city'), r['note_ja'][max(0,m.start()-25):m.end()+25]); bad=True
if bad: print('格付け語あり。書き換えてから再実行'); sys.exit(2)
PY
[ $? -eq 0 ] || exit 2
for n in "$@"; do echo "== local $n"; npm run content:import -- --file data/content/$n.json 2>&1 | grep -E "^完了: [0-9]+/[0-9]+$|✗|\[items" | sed -E 's/\[items\.[0-9]+\./[items./' | sort | uniq -c | sort -rn | head -4; done
npm run content:lint -- --strict 2>&1 | grep -E "^対象|✗|E項目"
REF=xzkvvdldovgbuutttmzj
export NEXT_PUBLIC_SUPABASE_URL="https://${REF}.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY=$(perl -e 'alarm 60; exec @ARGV' npx supabase projects api-keys --project-ref "$REF" -o json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s.slice(s.indexOf('['))); console.log(j.find(x=>x.name==='service_role').api_key);})")
[ -n "$SUPABASE_SERVICE_ROLE_KEY" ] && echo "key ok" || { echo "key EMPTY"; exit 1; }
for n in "$@"; do echo "== prod $n"; node scripts/import-content.ts --file data/content/$n.json --skip-expand 2>&1 | grep -E "^完了: [0-9]+/[0-9]+$|✗ import" | tail -2; done
echo "== prod lint"; node scripts/content-lint.ts 2>&1 | grep -E "^対象|✗|E項目"
