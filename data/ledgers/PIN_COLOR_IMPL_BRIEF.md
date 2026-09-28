# 実装指示書: 地図ピンと群の記号を「丸だけ・3色」に統一する

対象: /Users/tanakaryouta/workspace/ia-miracolo/itadaki-atlas。作業前に `CLAUDE.md`（「デザイン」「体験原則」「固有の実装方針」）と `ia-nextjs-standards` Skill を読む。**作業ツリーを分ける**: `git worktree add /private/tmp/claude-501/-Users-tanakaryouta-workspace-ia-miracolo/98c0ed5c-406a-480f-a772-02af38e851f1/scratchpad/wt-pins -b feature/pin-colors main` → `npm ci`。`.env.local` と `public/tiles/japan.pmtiles` は本体からシンボリックリンク。本番・デプロイ・push 禁止。E2E はこの部隊が走らせてよい（ポート3300）。

## 決定（ユーザー 2026-09-28「丸だけで色分けのがいい」）
形で分ける（●料理／■食材／◆仕込み）のをやめ、**すべて丸**にして色で分ける。本場（○中抜き）だけは形のまま。

| 群（shelves.grp） | 色 | 名称キー |
| :--- | :--- | :--- |
| dish（生まれた料理） | `#ff8f00`（ブランド橙。`PIN_BASE`） | 既存 |
| ingredient（育てる食材） | `#e56000`（濃） | 既存 |
| preparation（仕込む） | `#ffc985`（淡。輪郭 `#5b4a37` で締める） | 既存 |
| 本場 | 中抜き（紙 `#fffdf7` 塗り・橙リング・輪郭）。現状のまま | 既存 |
| ラーメンの系統色（醤油/味噌/塩/豚骨） | ラーメンで絞ったときだけ上書き（現状のまま） | 既存 |

`src/features/map/styles.ts` に `GROUP_COLORS = { dish, ingredient, preparation }` と `groupColor(grp)` を追加し、全画面がここを参照する（色の直書き禁止）。

## 変更箇所
1. **地図ピン** `src/features/map/MapView.tsx` `drawPins`（725行付近）: `item.itemType === "ingredient" ? "rounded-[3px]" : "rounded-full"` を廃止し常に `rounded-full`。塗りは `styleColor(item.primaryStyle)` がラーメン系統色を返すときはそれ、それ以外は `groupColor(grp)`。**grp はピンの `shelfSlug` から引く**。MapView は `shelves` を持っていないので、BrowseShell（`shelves` prop を既に持つ。`prefContext.ts` の `grpOfShelf` と同じ引き方）で `MapPin` に `grp` を付けて渡すか、`shelfGrpBySlug: Record<string,"dish"|"ingredient"|"preparation">` を MapView の prop に足す（後者が薄い。どちらでも可、報告に明記）。選択時の拡大・輪郭・本場の描画は変えない。
2. **凡例** MapView の `showLegend` ブロック（821行付近）: 現状はラーメン系統のみ。個別ピン表示（`!isClusterView`）のときは常に凡例を出し、中身を「● 生まれた料理／● 育てる食材／● 仕込む／○ 本場」の4行（色付きの丸＋語）にする。ラーメンで絞っているときは、その下に区切りを入れて系統4色を続ける（今の内容）。文言は `browse.legendDish` 等を messages の ja/en に追加（「生まれた料理」「育てる食材」「仕込む」「本場」／"Born here" "Grown here" "Made here" "At its best here"）。体験原則3の語彙（土地との関係）。凡例の位置・見た目は今のまま（`top-16 left-4`、SP でも邪魔にならないよう `max-w-[9rem]` 程度）。
3. **クラスタ**（`drawClusters`）: 変更なし（数字の丸のまま）。
4. **UI の記号** ●■◆ を使っている箇所を、色付きの ● に置き換える:
   - `src/features/browse/BrowseShell.tsx` 1142/1154/1194行付近（土地／種類／興味のカード見出しの記号）: ここは「土地・種類・興味」の3入口の記号で群の記号ではない。**土地＝● 橙、種類＝● 濃、興味＝● 淡** に読み替える（形は全部丸、色で分ける）。`bg-primary` の四角い枠は丸（`rounded-full`）にする
   - `src/app/[locale]/region/[pref]/page.tsx` 51〜53行 `GROUP_SYMBOL = { dish:"●", ingredient:"■", preparation:"◆" }`: 全部 "●" にし、見出しの記号 span に `groupColor(grp)` を `style.color` で当てる（文字の ● に色）。第4の群（「棚カテゴリではなく第4の群」のコメント参照）は記号なしのまま
   - `src/features/map/ItemConnections.tsx` 70/106行（詳細ページ「つながり」の見出し記号）: ● に統一し、料理側＝橙／食材側＝濃 を `style.color` で
   - `src/features/browse/BrowseShell.tsx` の県の一行文脈（`prefContextDish` 等の messages: 「●生まれた料理 {count}件」「■育てる食材…」「◆仕込む…」）: messages の記号を全部 ● にし、表示側で3色を当てられるなら当てる（文字列結合で出しているなら、記号は ● のままで色は付けなくてよい。報告に明記）
   - `src/components/SiteHeader.tsx` の `MonMark`（三つ紋ロゴ）と `MobileNav.tsx` のメニュー記号: **触らない**（ロゴは未決の暫定。CLAUDE.md「マーク」節）
5. **CLAUDE.md「デザイン」節の「記号」行**を新しい規則に書き換える: 「● 3色（料理 `#ff8f00`／食材 `#e56000`／仕込み `#ffc985`）＋ ○本場（中抜き）。識別は色が主。ラーメンの系統色は絞り込み時のみ上書き。凡例を個別ピン表示時に常時出す」。体験原則4の「地図ピンの記号 ●■◆」の記述も「● 3色」に直す。

## テスト
- 単体: `styles.test.ts`（あれば）に `groupColor` の3値と未知値のフォールバック（`PIN_BASE`）を追加
- E2E（tests/smoke.spec.ts）: 既存で `rounded-[3px]`・「■」「◆」を前提にしている箇所があれば新仕様に更新。追加: 「県クラスタをタップして個別ピンになると凡例に『生まれた料理』『育てる食材』『仕込む』『本場』が出る（SP 390px）」「/en では "Born here" 等」の2本
- `npm run lint && npx tsc --noEmit && npm run test && npx playwright test --workers=2` を通す（E2E が dev サーバー起動待ちで落ちたら1回だけ再実行）
- 目視: PC/SP で全国→県→個別ピンのスクリーンショットを scratchpad/ux-review/pins/ に保存（淡い橙 `#ffc985` のピンが紙の地図で見えるか。見えにくければ報告に書く。色は勝手に変えない）

## やらないこと
- 色の値を変えない・増やさない（緑青紫禁止）。本場の形・クラスタ・ロゴは触らない。DB は触らない。

## 報告
変更ファイル一覧／検証結果／体験原則（3・4・7）とデザイン規約の自己点検／要判断事項（淡い橙の視認性の所見を含む）。コミットは feature/pin-colors に。終わったら dev サーバーを止め、作業ツリーは残す。
