# 実装指示書: スマホのヘッダーに 土地／種類／興味／ガイド の導線を付ける

対象: /Users/tanakaryouta/workspace/ia-miracolo/itadaki-atlas。作業前に `CLAUDE.md`（「デザイン」「体験原則」）と `ia-nextjs-standards` Skill を読む。**作業ツリーを分ける**: `git worktree add /private/tmp/claude-501/-Users-tanakaryouta-workspace-ia-miracolo/98c0ed5c-406a-480f-a772-02af38e851f1/scratchpad/wt-mobile-nav -b feature/mobile-nav main` → そこで `npm ci`。`.env.local` と `public/tiles/japan.pmtiles` は本体リポジトリからシンボリックリンクする。本番・デプロイ・push 禁止。**E2E（`npx playwright test`）は走らせない**（ポート3300 を別部隊が使う）。手動確認は `npm run dev -- -p 3600` で。

## 症状（体験検品 2026-09-24 / 26）
ヘッダーの 土地／種類／興味／ガイド は `hidden md:flex`（`src/components/SiteHeader.tsx` 31行）で SP では非表示。代替も無いので、詳細ページやガイドから他の入口へ横移動できず、トップに戻ってシートのカードを使うしかない。

## 設計（決定済み。変えない）
1. SP（`md` 未満）にだけメニューボタンを出す。位置は言語切替の左。見た目は紙の上の細罫ボタン（副ボタンの規約: 紙＋細罫。塗りボタン禁止）で、ラベルは文字「メニュー」（en: "Menu"）＋ 三本線ではなく **●■◆の三つ紋を横に小さく並べた記号**（`MonMark` と同じ色。ハンバーガーの定型を避け、ブランドの記号を使う）。`aria-expanded` / `aria-controls` を付ける。
2. 押すとヘッダー直下に紙色のパネルが開く（`position: absolute; top: 100%`、幅いっぱい、下罫 `#eee3d2`、影は薄く）。中身は PC ナビと同じ4リンク（土地 `/#place`、種類 `/#type`、興味 `/tags`、ガイド `/guide`）を縦に並べ、各行に記号（● 土地／■ 種類／◆ 興味／▶ではなく「食べに行く前に」を表す小さな本のアイコンは作らず文字だけ）。文言は既存の `header.navPlace` 等を流用。加えて `header.menuOpen`「メニュー」/「Menu」、`header.menuClose`「閉じる」/「Close」を追加。
3. クライアント部品 `src/components/MobileNav.tsx`（`"use client"`）に状態を閉じ込め、`SiteHeader.tsx`（サーバー部品）は `md:hidden` の位置にそれを置くだけにする。リンクを押したら閉じる。外側クリックと Esc で閉じる。開いている間はパネルの後ろの地図を触れないよう、パネル外を覆う透明なレイヤーを置く（`z-40` のヘッダーより上、`z-50`）。`prefers-reduced-motion` を尊重（開閉アニメは短いフェードだけ、reduce なら無し）。
4. トップの `/#place` `/#type` はBrowseShell が既にハッシュを読む。SP でも `#place` は「地図が見える段階にシートを戻す」挙動（前回の修正）になっているので、そのまま。
5. PC（`md` 以上）は今のナビのまま。ボタンとパネルは `md:hidden`。

## テスト
- 単体（vitest + testing-library があれば）: `MobileNav` が押下で `aria-expanded` を切り替え、リンク4本を持つこと。無ければスキップして E2E に寄せる。
- E2E: `tests/smoke.spec.ts` に「SP 390px でヘッダーのメニューを開くと 土地／種類／興味／ガイド が出て、ガイドを押すと /ja/guide へ遷移し、メニューが閉じている」「PC 1440px ではメニューボタンが無く、ナビが直接見える」の2本を**書くだけ**（実行は指揮者がマージ後に行う）。
- `npm run lint && npx tsc --noEmit && npm run test` を通す。手動確認: 3600 で SP 幅のスクリーンショット（閉じた状態・開いた状態）を1枚ずつ、scratchpad/ux-review/mobile-nav/ に保存。

## やらないこと
- `src/features/map/MapView.tsx`・`src/features/browse/BrowseShell.tsx` は別部隊が触るので変更しない。messages の追加は `header.*` の中だけ。

## 体験原則の自己点検（報告に含める）
4（押せるものは押せるように見えるか。ヘッダーに隠れないか）、6（詳細ページから横移動できるか）、8（/en に日本語が混ざらないか）、デザイン（黒禁止・塗りボタン禁止・偽和風禁止）。

## 報告
変更ファイル一覧／検証結果／体験原則の自己点検／要判断事項。コミットは feature/mobile-nav に。終わったら dev サーバー（3600）を止め、作業ツリーはそのまま残す。
