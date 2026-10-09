# 実装指示書: デザイン刷新後の体験検品の指摘を直す

対象: /Users/tanakaryouta/workspace/ia-miracolo/itadaki-atlas。作業前に `CLAUDE.md`（「デザイン」「体験原則」「固有の実装方針」）と `ia-nextjs-standards` Skill を読む。**作業ツリーを分ける**: `git worktree add /private/tmp/claude-501/-Users-tanakaryouta-workspace-ia-miracolo/98c0ed5c-406a-480f-a772-02af38e851f1/scratchpad/wt-fix -b feature/design-fix main` → `npm ci`。`.env.local` と `public/tiles/japan.pmtiles` は本体からシンボリックリンク。ローカル Supabase は起動済み（54331）。本番・デプロイ・push 禁止。E2E はこの部隊が走らせてよい（ポート3300）。

## 直すもの（体験検品 2026-10-09。証拠のスクリーンショットは scratchpad/ux-review/design/）
1. **SP でヘッダー右端の「English」が切れ、ページが横に7px動く**（幅390）。`src/components/SiteHeader.tsx`・`MobileNav.tsx`・`LanguageSwitcher`。SP ではワードマークを縮める／言語切替を「日本語｜EN」の短い表記にする／メニューボタンの文字を消して記号だけにする、のどれか（組み合わせ可）で 390px に収める。360px でも収まることを確認。体全体の横はみ出しが無いこと（`document.documentElement.scrollWidth === innerWidth`）を E2E で検証
2. **件数が画面で食い違う**: 福島県は県ページ「51件」、トップの県絞り込み「48件」。原因を特定し（県ページが本場や fixture を含めている、等）、どちらも「その県で生まれた／育てる／仕込むの合計（発祥ベース）」に揃える。本場は県ページで別群として件数を分けて見せる（見出しの件数に混ぜない）
3. **英語ページに日本語の系統名が出る**（索引の「· 白身」「· 貝」「· エビ・カニ」「· イカ・タコ」「· 黒糖・泡盛」「· 干菓子」「· 羊羹・寒天」等）。`food_items`／`dish_details.primary_style` の**全種類**をローカル DB から列挙し、`messages/en.json` の `styleNames` に英語名を全部足す（料理名の英訳ではなく系統名。例 白身→"White fish"、干菓子→"Dry confections"）。ja の `style` 辞書に無いものは ja ではそのまま表示でよい。足し漏れを機械で検出する単体テスト（DB の値は使えないので、`data/content/*.json` の `primary_style` を集めて `styleNames` に全部あるかを見る）を書く
4. **英語ページで市区町村名が日本語のまま**: ガイド一覧（/en/guide）の「Kanagawa 横浜市」等。`place_names`（`features/map/placeNames.ts` の `translateCityName`）を通す。ガイドの他の場所表示（場面ページ・県ページの「この土地の食体験」・ガイド詳細の位置帯）も同様に確認
5. **英語の詳細ヒーローで「Origin: Fukuoka Fukuoka」**: 県名と市名の英語が同じとき（福岡県福岡市、京都府京都市など）は "Fukuoka City, Fukuoka" のように city を付けて区別するか、重複を1つにする。ja は「福岡県福岡市」のまま
6. **詳細ヒーロー内の下線リンク「中華由来」が何か分からない**: タグへのリンクであることが分かるよう、前に小さな「興味:」（en "Theme:"）ラベルを付ける（分類ラベル `LabelChip` ではなく遷移リンクのまま）
7. **詳細右カラム「同じ福岡県」の項目に要約が無い**: 他の群と同じく一行の要約を付ける（`fetchSamePref` が summary を返しているか確認）
8. **ラーメンの系統チップ・見出し・索引行に「その他」**: 体験原則3（分類名で片づけない）違反。ラーメンの4系統に入らないものの表示名を「4系統の外」（en "Beyond the four styles"）にする。`messages` の `style.その他` を差し替え、索引行末尾のラベルも同じ語にする。他ジャンルで「その他」を出している箇所があれば grep して列挙し、同じ考えで直すか報告する
9. **ジャンル絞り込み時（例: ラーメン）に SP でクラスタの数字が重なる**: 全国表示と同じ重なり緩和を絞り込み時にも効かせる。数字が1〜2桁の小さい県同士が重なる場合は、ずらしの間隔を詰める／小さい件数のクラスタは数字を出さず点にする、などで押し分けられるようにする
10. **県ページに「これは何か」が無い**（体験原則2）: トップの県絞り込みと同じ「●生まれた料理 N件（代表3件 ほか）・●育てる食材…・●仕込む…・○本場 N件」の一行を、県ページのカバー直下に出す（`features/browse/prefContext.ts` を流用）

## 検証
`npm run lint && npx tsc --noEmit && npm run test && npx playwright test --workers=2` を通す（E2E が dev サーバー起動待ちで落ちたら1回だけ再実行）。E2E 追加: 1（横はみ出しなし、390/360）、2（県ページとトップ絞り込みの件数一致）、3（/en/ramen・/en/region/fukushima・/en/fish に CJK の系統名が出ない）、8（/ja/ramen に「その他」が出ない）。

## やらないこと
- 色トークン・ロゴ・地図タイル・文言の大幅変更。DB・データの変更（辞書の追加は可）。

## 報告
変更ファイル一覧／検証結果／指摘ごとの原因と対処／体験原則・デザイン規約の自己点検／要判断事項。コミットは feature/design-fix に。終わったら dev サーバーを止め、作業ツリーは残す。
