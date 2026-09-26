# 実装指示書: 県クラスタの数字を「その県で生まれた件数」に揃える

対象: /Users/tanakaryouta/workspace/ia-miracolo/itadaki-atlas。作業前に `CLAUDE.md`（「体験原則」「デザイン」「固有の実装方針」）と `ia-nextjs-standards` Skill を読む。**作業ツリーを分ける**: `git worktree add /private/tmp/claude-501/-Users-tanakaryouta-workspace-ia-miracolo/98c0ed5c-406a-480f-a772-02af38e851f1/scratchpad/wt-cluster -b feature/cluster-count main` → そこで `npm ci`。`.env.local` と `public/tiles/japan.pmtiles` は本体リポジトリからシンボリックリンクする（前回の部隊と同じ）。本番・デプロイ・push 禁止。E2E はこの部隊が走らせてよい（ポート3300）。

## 症状（体験検品 2026-09-26）
「福島」で検索すると、シートの見出しは「48件」なのに地図の県クラスタの数字は「51」。県クラスタをタップしたときも見出し「福島県 48件」に対してクラスタは 51。差分は、その県が**本場**として結びついている料理のピン（発祥は他県）3件。

## 原因
`src/features/map/MapView.tsx` の `prefClusters`（471行付近）は `items`（= BrowseShell の `visiblePins`。発祥ピン `kind:"origin"` と本場ピン `kind:"honba"` の合流）を県ごとに数えている。一方シートの件数は発祥アイテム（`visibleItems`、origin_pref 一致）だけ。数える母集団が違う。

## 設計（決定済み。変えない）
体験原則3「ラベルは土地との関係で言う」に沿って、クラスタの数字は**その県で生まれた件数（origin）**にする。本場は数字に足さず、記号で示す。
1. `prefClusters` は `kind === "origin"` のピンだけを数える（`count`）。あわせて `honbaCount`（その県の `kind === "honba"` のピン数）と、重心の計算はこれまでどおり全ピンで行う（位置の真実は変えない）。
2. 発祥ピンが1つも無く本場ピンだけの県（例: 石川県。既存 E2E「本場ピン対応で、発祥ピンの無い石川県もクラスタとして選べる」が前提にしている）は、クラスタを**残す**が見た目を本場記号に合わせる: 中抜き（塗り＝紙 `#fffdf7`、リング橙 `#ff8f00`、外周輪郭 `#5b4a37`。CLAUDE.md「記号」節の ○本場と同じ）にし、数字は `honbaCount`。aria-label は「{pref} 本場 {count}件。選ぶとこの県に絞り込みます」（en: "{pref}: {count} specialties at their best here. Select to filter by this prefecture"）。messages に `browse.clusterHonbaAriaLabel` を追加。
3. 発祥ピンがある県は今の塗りクラスタのまま数字＝origin 件数。`honbaCount > 0` のとき、クラスタの右上に小さな中抜きの丸（直径8px 程度、リング橙・輪郭 `#5b4a37`）を添えて「本場もある」ことを示す。数字には含めない。
4. タップしたときの絞り込み（`onPrefSelect`）は今のまま。本場だけの県を選んだときは、シート側で `visibleItems` が 0 件になるので、結果ヘッダーの見出し「石川県 0件」の下に「この県が本場の料理」として `honbaGroups`（BrowseShell が既に持つ本場の一覧）からその県の本場を一覧する。既に「本場を辿る」モジュール（HonbaTrailSection）が近い表示を持つので部品を流用し、新しい見た目を作らない。0件のままにしない（体験原則6）。
5. `BrowseShell.tsx` の県絞り込み時の結果ヘッダー件数（`visibleItems.length`）はそのまま。これでクラスタの数字と一致する。

## テスト
- 単体: `prefClusters` の数え方を純関数に切り出す（例: `src/features/map/prefClusters.ts` の `buildPrefClusters(pins)`）。origin だけ数える／honbaCount／本場だけの県が残る、を `.test.ts` で確認。
- E2E（tests/smoke.spec.ts）: 既存の石川県クラスタのテスト2本を新しい aria-label・見た目に合わせて更新。追加: 「福島県クラスタの数字とタップ後の見出しの件数が一致する」「『福島』で検索したときのクラスタの数字とシートの件数が一致する」（SP 390px）。
- `npm run lint && npx tsc --noEmit && npm run test && npx playwright test --workers=2` を通す（E2E が dev サーバー起動待ちで落ちたら1回だけ再実行）。

## やらないこと
- 本場ピン自体の表示・選択、県ページ、DB。`src/components/SiteHeader.tsx` は別部隊が触るので変更しない。messages の追加は `browse.*` の中だけ。

## 体験原則の自己点検（報告に含める）
3（土地との関係で言う。「その他」を出さない）、5（本場は複数・理由付き。数字に混ぜていないか）、6（本場だけの県で行き止まりになっていないか）、7（記号で伝えているか。黒を使っていないか）。

## 報告
変更ファイル一覧／検証結果／体験原則の自己点検／要判断事項。コミットは feature/cluster-count に。終わったら dev サーバーを止め、作業ツリーはそのまま残す。
