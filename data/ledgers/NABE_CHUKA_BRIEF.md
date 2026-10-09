# 鍋料理のジャンル化と町中華の補充 部隊指示書（全文を読んでから着手）

対象リポジトリ: /Users/tanakaryouta/workspace/ia-miracolo/itadaki-atlas（**読み取り専用**。書き換えない）。出力は scratchpad のみ。再委譲禁止。一意なスクリプト名（build_nabe_chuka.py）。5件ごとに途中保存。

## まず読む（正典）
- `.claude/skills/ia-atlas-add/SKILL.md` と `references/fleet-brief.md`・`references/content-json.md`（束 JSON の形式・語彙・関係の向き）
- `.claude/skills/ia-atlas-content/SKILL.md`（採否・文体・3章見出し・禁止語・出典規律）
- 既存の束の例: `data/content/machi-chuka.json`・`data/content/yoshoku.json`（genres / items / regenre / relations の書き方）

## 背景（ユーザー 2026-09-29「鍋料理ある？すき焼きとか関西風と関東風、しゃぶしゃぶなど。あと町中華」）
鍋は棚「鍋・汁もの（hotpot）」に29件ほどあるがジャンルが無く、トップの「種類」に出ない。しゃぶしゃぶ・もつ鍋・湯豆腐などが未収録、すき焼きの関東風／関西風の区別も無い。町中華（genre `machi-chuka`、22件）は定番が抜けている。

## 1. ジャンル「鍋料理」（slug `nabe`）を新設する
- `genres`: `{slug:"nabe", name_ja:"鍋料理", name_en:"Nabe (hot pot)", type:"dish", shelf:"hotpot", intro_ja, intro_en}`。総論（intro）は 200〜300字。「鍋を囲む」食べ方、出汁と具の組み合わせ、すき焼き・しゃぶしゃぶのような全国区の型と、きりたんぽ・石狩・ぼたん鍋のような土地の鍋の両方がある、という構図で。煽らない・断定しない
- 系統（primary_style）を付ける: **割下・すき焼き系／しゃぶしゃぶ系／水炊き・ちり系／味噌仕立て／醤油・寄せ鍋系／おでん** の6つを基本に（無理に当てない。迷うものは近い方）。この系統名は ja のまま入れてよい（英語名は別途こちらで辞書に足す）。報告に系統ごとの件数を書く
- `regenre`: 既存の hotpot の鍋もの（すき焼き `sukiyaki`、おでん `oden`、ちゃんこ鍋、若鶏の水炊き `mizutaki`、きりたんぽ鍋、石狩鍋、ぼたん鍋、かきの土手鍋、鯨のハリハリ鍋、しょっつる鍋、柳川鍋、ねぎま鍋、牛鍋 `gyu-nabe`、鶏肉のすき焼き、かしわのすき焼き、ぶりしゃぶ、各地のおでん など）を `nabe` へ移す。対象 slug の一覧は DB からではなく `data/content/*.json` と `data/bodies*/*.json` を grep して実在を確かめる（slug 一覧: `data/ledgers/slugs-by-genre.txt` の `shelf:hotpot` 行）。汁もの（〜汁・雑煮）は移さない
- 新規アイテム（10〜14件。本文3章・出典・関係つき。形式は content-json.md）:
  - **すき焼き（関東風）** `sukiyaki-kanto`: 割下で煮る。牛鍋（横浜・東京）からの流れ。発祥地は東京都（牛鍋の系譜として）、本場の付け方は fleet-brief の規律どおり
  - **すき焼き（関西風）** `sukiyaki-kansai`: 牛脂で肉を焼き、砂糖と醤油を直接。発祥地は大阪府または兵庫県（出典で確かめた方）
  - 両者は `sukiyaki`（受け皿）に対して「派生」、互いに「対比」、`gyu-nabe` → `sukiyaki-kanto` は「源流」
  - **しゃぶしゃぶ** `shabu-shabu`: 全国区の受け皿（発祥地なし）。本場を2箇所以上、理由文と出典つき（大阪の発祥説・京都の発祥説など、出典で確認できるもの）
  - もつ鍋（福岡）、湯豆腐（京都）、寄せ鍋（受け皿）、鴨鍋（滋賀・長浜など出典で確認）、あんこう鍋（茨城）、てっちり／ふぐちり（大阪・山口のどちらか出典で）、かにすき（出典で確認できる土地）、常夜鍋、たらちり（受け皿か土地か出典次第）、キムチ鍋（日本の鍋としての受け皿。韓国料理の紹介にしない）
  - 既に別 slug であるものは作らない（`burishabu` などを確認）
- 体験原則5: 全国区の型（しゃぶしゃぶ・寄せ鍋・すき焼き）は受け皿＋本場2箇所以上

## 2. 町中華（genre `machi-chuka`）に 8〜10 件を足す
- 候補: ワンタン麺、排骨麺（パーコー麺）、もやしそば、油淋鶏、棒棒鶏、杏仁豆腐、炸醤麺（東京の町中華の型として。盛岡じゃじゃ麺 `jajamen` とは「対比」）、肉野菜炒め、トマトと卵の炒めもの、中華スープ（町中華のセットの汁として）
- 町中華は「日本の町の中華食堂で育った型」として書く。発祥地は出典で確かめられるものだけ入れ、分からないものは受け皿（発祥地なし）にする。中国本土の料理史の紹介にしない
- 系統（primary_style）は既存の machi-chuka の付け方に合わせる（無ければ付けない）
- 既存の `shumai`（homestyle）・`gyoza`（griddle）・`chuka-don`（donburi）・`tenshinhan`・`sanmamen`（ramen）とは関係（兄弟・対比）で結ぶ。移籍はしない

## 出力
`/private/tmp/claude-501/-Users-tanakaryouta-workspace-ia-miracolo/98c0ed5c-406a-480f-a772-02af38e851f1/scratchpad/content/nabe.json` と `machi-chuka-2.json`（どちらも content-json.md の束形式）。

## 自己検証してから報告
3章見出し一字一句・各章150〜250字・断定終止（である。／名詞＋だ。）なし・格付け語なし・英語の "or so" 系なし・出典 URL 200（Wikipedia 不可）・relations の相手 slug が実在・本場は理由文と出典つき。報告: 新規アイテム一覧（slug・名前・発祥地／受け皿・系統）、regenre した slug 一覧、系統ごとの件数、外したものと理由。
