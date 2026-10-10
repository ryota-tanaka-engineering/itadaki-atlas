# 目的

Itadaki Atlas のやることリスト（バックログ）。会話で出た要望・検品で見つかった課題・既存の作業候補を1か所に集め、優先順をつける。**次の作業候補はここが正**（CLAUDE.md には再掲しない）。

優先順は「正確さ > 網羅性 > 速度」と KGI（送客）で決める。上から順に着手する。

担当の印:

| 印 | 意味 |
| :--- | :--- |
| 【手元】 | DB・本番・Web が要る。クラウドセッションからはできない |
| 【判断】 | ユーザーが決める |
| 【実装】 | セッションで実装・執筆できる |

更新: 2026-10-10（2）

## 0. 今すぐ（溜まっているものを本番に出す）

- [ ] 【手元】本番デプロイ（`bash scripts/deploy-prod.sh`）。公開URLの注入・robots・canonical・JSON-LD・llms.txt・詳細ページの麺/濃さチップ・チェーン逆引きが反映される
- [ ] 【手元】デプロイ後、構造化データを Google「リッチリザルト テスト」と schema.org の検証ツールで確認（詳細・ジャンル・県・ガイドを1つずつ。Search Console のアカウントは要らない）。**Search Console と sitemap 送信は独自ドメイン移行後**（2026-10-10 決定。workers.dev に評価を貯めない）
- [ ] 【手元】マイグレーション `20261004000000_dish_details_noodle_vocab.sql` をローカルと本番に適用
- [ ] 【手元】出典URLの疎通検査 `node scripts/check-source-urls.ts data/content/soy-foods-*.json data/content/vegetables-*.json`。200 以外を直す
- [ ] 【手元】投入（この順）: ラーメン4章目161件（`bash data/ledgers/ingest-howto.sh`）→ ガイド（`scripts/import-guides.ts`）→ 大豆 `soy-foods-1→3` → 野菜 `vegetables-1→8`（7 は 5 に依存）。各段のあと `npm run content:lint -- --strict`
- [x] 【実装】産地の英語表記を `data/place-names.json` に49件追加（2026-10-10。束の郡名・括弧つき地名は既存の流儀に正規化）
- [ ] 【手元】`node --env-file=.env.local scripts/import-place-names.ts --file data/place-names.json`（ローカル・本番）。大豆・野菜の投入と同じタイミングで
- [ ] 【手元】`npm run test:e2e`（4章目・麺濃さの2本は howto 投入後に通る）
- [ ] 【手元】`ia-atlas-ux-reviewer` で SP/PC の導線検品: 詳細ページの新しい節、`/soy-foods`・`/local-vegetables`・`/tubers`、県ページの「育てる」群、新ガイド
- [ ] 【手元】投入後に `data/ledgers/slugs-by-genre.txt` を DB から作り直し、CLAUDE.md「現在の状態」の件数（ジャンル30・総件数・ガイド76）を揃える
- [ ] 【手元】本番反映後、詳細ページの CPU 超過（Cloudflare 1102）を監視。チェーン逆引きと同名件数で問い合わせが3本増えた

## 1. 公開前に必須（正確さ）

- [ ] 【手元】**チェーンの文字化けが本番に出ている**（2026-10-10 発見。00946bd で ramen/soba/udon/donburi の23件に「醒油」「丸亀製麦」「そじ坤」「家族中」等が混入）。`data/chains.json` は校正済み。マイグレーション `20261010100000_chain_tag_style_texts.sql` 適用 → `node --env-file=.env.local scripts/import-chains.ts --file data/chains.json`（ローカル・本番）。同じタイミングで `import-tags.ts --file data/tags.json`・`import-genre-styles.ts --file data/genre-styles.json`
- [ ] 【手元】チェーン校正で決めきれなかった箇所を公式で確認: ゆで太郎の1号店「湊店」（蒲田店の化けか）、山田うどんの親会社名（山田製麺店／所）、魁力屋「北白川周辺」（周辺と推定して直した）、8番らーめん「野菜を炒めて乗せる」（「ひやして」を推定で直した）

- [ ] 【判断】新規コンテンツの「要判断」を確認（大豆・野菜・ラーメン4章目の各束 `notes`）。例: つと豆腐の発祥地、岩津ねぎ→九条ねぎ・三浦大根→練馬大根を「派生」とするか、島らっきょうの代表地点、充填豆腐を残すか
- [ ] 【判断】タグ・チェーン・系統の部隊の要判断（生出力は `data/ledgers/extensions/`）: タグ定義と実データのずれ（豚・牛・鶏タグに銘柄アイテムが入る、kelp_cured にバッテラ、meal_ender、no_broth のそばがき、洋食タグに江戸期のもの）／チェーン創業者名の読み（未確認のローマ字）、磯丸水産の2026-07合併日、大吉の宣伝文句／系統: 鮭を「赤身」に入れている、塩ラーメンに白湯が混じる
- [ ] 【判断】ラーメン4章目で既存本文に無い一般知識の記述（燕の刻み玉ねぎ、須崎鍋焼きの雑炊、竹岡式の玉ねぎ等）を残すか削るか
- [ ] 【判断】「濃さ」の尺度。塩辛さを含めるか（今は富山ブラックが 2）、汁なし・カレー・あんかけは null に揃えるか、チップの語を「こってり度」に変えるか
- [ ] 【手元】Web に出られる環境で、新規131件と4章目161件の検証専任の部隊を1回回す（出典・由来・製法の照合）
- [ ] 【実装】差分が増えたら `/security-review` を再実施（2026-10-06 実施、指摘なし）
- [ ] 【実装】（任意）`scripts/check-source-urls.ts` を http(s) 限定・プライベートアドレス拒否にする（手元専用で今は実害なし）

## 2. 集客の土台

- [x] 【実装】県ページの総論。47都道府県の一行＋石川（金沢）の地の文（2026-10-10。テーブル `prefecture_intros`・`data/prefecture-intros.json`・県ページの一覧の前に総論／一覧の後に読み物・トップの県絞り込みに総論）
- [ ] 【手元】マイグレーション `20261010000000_prefecture_intros.sql` → `node --env-file=.env.local scripts/import-prefecture-intros.ts --file data/prefecture-intros.json`（ローカル・本番）。**大豆・野菜の投入のあとに**（総論が桜島大根・五箇山の堅豆腐・静岡の水わさび等、未投入の名前を挙げているため）
- [ ] 【判断】県の総論の要判断（部隊の生出力は `data/ledgers/pref-intros/` の各県 `notes`）: 沖縄の「琉球王国」を使わない語「王国」に当たるとして「かつて琉球として」に言い換えた（英語は Ryukyu Kingdom）。「琉球王国」は固有名なので許可するか／栃木で「宇都宮は餃子の本場」と市名を出した（データは県単位）／石川の読み物は Markdown の生の字数で2,319字（画面上は1,790字）
- [x] 【実装】県・タグ・場面ページの OGP 画像（2026-10-10。県は総論の冒頭を添える。辞書は `src/lib/ogLabels.ts`）
- [x] 【実装】英語の詳細ページのカバーに日本語名を添える（2026-10-10。三点セット: H1 ローマ字・日本語名 · 説明訳・概要文。JSON-LD は alternateName 済み）
- [ ] 【判断】4章目・ガイドの見出しを質問文に寄せるか（AI の回答に拾われやすい。今は「どう食べるのか」等の固定見出し）
- [ ] 【手元】独自ドメイン `itadakiatlas.com` 一式。順番: (1) `.env.production.local` に `NEXT_PUBLIC_SITE_URL=https://itadakiatlas.com` を置いてデプロイ（workers.dev からの 301 は `src/lib/hostRedirect.ts` で自動的に効く。**workers.dev は無効化しない**）(2) R2 カスタムドメイン (3) Search Console にドメインプロパティ（DNS 確認）で登録し sitemap を送信 (4) workers.dev を登録していた場合は「アドレス変更」も
- [ ] 【手元】計測ID（GA4・Cloudflare Web Analytics）の設定
- [ ] 【判断】【実装】イラストのスタイル確定（`.doc/40_operation/01_strategy.md` §2・ロードマップ §5）。描き分けの難しい5〜10種でストレステスト、合否ラインは茶系スープの区別。合格したスタイルをプロンプトテンプレと参照画像として Skill 化してから量産。部位図の SVG 線画の延長から始められる

## 3. コンテンツ拡張

- [ ] 【実装】4章目「どう食べるのか」を寿司・うどん・そば・焼き鳥へ（`data/ledgers/HOWTO_BRIEF.md` を流用）
- [ ] 【実装】いも・豆を2件以上足して「いも・豆」ジャンルへ昇格（今は棚 `tubers` のその他18件で、野菜ジャンルから安納芋等が見つからない）
- [ ] 【実装】各束 `notes` の追加候補: 金時草・東京うど・ひともじ・島にんじん・仙台雪菜・民田なす・田辺大根・大豆の品種 ほか
- [x] 【実装】ジャンルページの系統ごとの一文解説（2026-10-10。`genre_styles`・`data/genre-styles.json` 35系統）
- [x] 【実装】チェーン創業メモの英訳列（2026-10-10。`chains.founded_note_en`、`data/chains.json` の `founded_en` 133件）
- [x] 【実装】タグの総論と英語の定義（2026-10-10。`tags.definition_en/intro_ja/intro_en`、`data/tags.json` 26件。/en に日本語の定義が出ていたのも解消）
- [ ] 【実装】麺・濃さのような構造化属性をラーメン以外へ（元祖店 `originator_shop` は表示方針が未決）
- [ ] 【実装】ラーメン協会一覧との差分109件（台帳は手元の scratchpad/ramen-master）
- [ ] 【実装】とんかつ・天ぷら・焼肉の本場の複数化、寿司ジャンルの系統（郷土/型/現代/ネタ）付与
- [ ] 【実装】鶏の部位図の線画改善

## 4. 後回し

- [ ] `ia-atlas-deploy` Skill の作成
- [ ] `src/middleware.ts` を Next 16 の `proxy.ts` に改名（middleware は非推奨。OpenNext Cloudflare での proxy の動作を確認してから）
- [ ] 出典の発行元名だけを脚注で出す折衷案（今は出典を UI 非表示）
- [ ] 実写への差し替え（収益化後。`.doc/40_operation/01_strategy.md` §2.3）

## 運用メモ

- 部隊は同時5本以内。2026-10-04 に11本同時でレート制限に当たった。2件ごとに途中保存させると落ちても再開できる
- クラウドセッションは Web と DB に出られない。出典は指示書の「Web 不可環境の規律」で書き、投入前に手元で `check-source-urls` を流す

## 完了（直近）

| 日付 | 内容 |
| :--- | :--- |
| 2026-10-04 | 詳細ページを厚く（4章目「どう食べるのか」の仕組み、麺・濃さチップ、チェーン逆引き）、ラーメン161件の4章目を執筆 |
| 2026-10-04 | ガイド「初めての味は、まず気軽な店で試す」 |
| 2026-10-05 | 大豆食品31件・伝統野菜/地域野菜100件（47都道府県）の束 |
| 2026-10-06 | SEO/AIO（公開URL注入・robots・canonical・JSON-LD・llms.txt・同名タイトルの県区別）、セキュリティレビュー |
