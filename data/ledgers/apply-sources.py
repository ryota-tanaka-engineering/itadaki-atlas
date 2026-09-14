"""出典差し替えJSON（items[].slug/sources/body_ja_replace/body_en_replace）を data/content/*.json の該当アイテムへ反映する。
使い方: python3 apply-sources.py <sources.json> <bundle1.json> [<bundle2.json>...]  → 変更した束ファイル名を出力"""
import json,sys
src=json.load(open(sys.argv[1])); patches={it['slug']:it for it in src['items']}
touched=[]; applied=set()
for bp in sys.argv[2:]:
    d=json.load(open(bp)); hit=False
    for it in d.get('items',[]):
        p=patches.get(it['slug'])
        if not p: continue
        if p.get('sources'): it['sources']=p['sources']
        for a,b in p.get('body_ja_replace',[]) or []:
            if a in (it.get('body_ja') or ''): it['body_ja']=it['body_ja'].replace(a,b)
            else: print('  WARN ja not found', it['slug'], a[:30])
        for a,b in p.get('body_en_replace',[]) or []:
            if a in (it.get('body_en') or ''): it['body_en']=it['body_en'].replace(a,b)
            else: print('  WARN en not found', it['slug'], a[:30])
        hit=True; applied.add(it['slug'])
    if hit: json.dump(d,open(bp,'w'),ensure_ascii=False,indent=1); touched.append(bp)
print('applied', len(applied), 'of', len(patches), 'missing:', sorted(set(patches)-applied)[:10])
print('TOUCHED', ' '.join(touched))
