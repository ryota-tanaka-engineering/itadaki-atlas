# 実装指示書: 県クラスタのタップを「県の絞り込み」にする

対象: /Users/tanakaryouta/workspace/ia-miracolo/itadaki-atlas。作業前に `CLAUDE.md`（「体験原則」「デザイン」「固有の実装方針」）と `ia-nextjs-standards` Skill を読む。ブランチ `feature/pref-filter` を切って作業する（main で直接作業しない）。

## 症状（体験検品 2026-09-24）
トップの全国地図で県クラスタ（数字ピン）をタップすると、地図がその県へズームするだけで、下のシートは「2,198件」のまま変わらない。「土地からさがす: 地図をタップ、またはピンを選んで探せます」の説明と食い違い、県単位の文脈（体験原則2）が地図経由では出てこない。

## 目的
県クラスタのタップを、ジャンル・タグと同じ「絞り込み」として扱う。地図は今どおりその県へ寄り（既存 `flyToPrefecture`）、同時にシートがその県の結果ビューになる。

## 設計（決定済み。変えない）
1. **状態**: `src/features/browse/BrowseShell.tsx` に `prefFilter: string | null`（都道府県の日本語名。`food_items.origin_pref` と同じ規約）を `genreFilter` / `tagFilter` と並べて追加。`visibleItems` / `visiblePins` は既存の AND に `prefFilter` を加える（items は `originPref === prefFilter`。本場ピンは、その本場の県が一致するもの。`mapPins` の生成箇所を見て、本場ピンが持つ県フィールドで絞る）。
2. **MapView → 親**: `src/features/map/MapView.tsx` に `onPrefSelect?: (pref: string) => void` と `onPrefClear?: () => void` を追加（他のコールバックと同じく ref に逃がす）。クラスタの click で `flyToPrefecture(pref)` の後に `onPrefSelectRef.current?.(pref)`。「全国に戻る」ボタン（`flyToJapan`）で `onPrefClearRef.current?.()`。手動で縮小してクラスタ表示に戻ったとき（`onClusterViewChange(true)`）も親側で `prefFilter` を解除する（地図とシートが食い違わないように）。
3. **親側ハンドラ**: `handleSelectPref(pref)` = `setPrefFilter(pref); setSelectedSlug(null); setSnap("peak")`。`handleClearAllFilters` と `#place/#type` のハッシュ処理は `prefFilter` も解除し、解除時は地図を全国へ戻す（MapView に `flyToJapan` を外から呼ぶ手段が無ければ、`resetToJapanSignal` のような数値プロップを増やして useEffect で `fitJapan` を呼ぶ。既存の `lastFitRef` の流儀に合わせる）。
4. **結果ヘッダー（体験原則2「選択の直後に必ず文脈を出す」）**: `filteredGenre || filteredTag` の分岐に `prefFilter` を加える。見出しは県名（`label.prefecture(pref)`、/en は英語県名）＋ `t("count", …)`。その下に県の一行文脈を出す。県には DB の総論が無いので、`visibleItems` から機械的に作る: 「●生まれた料理 N・■育てる食材 N・◆仕込む N」（`food_items.type` と棚の3群。region ページ `src/app/[locale]/region/[pref]/page.tsx` の3群の分け方を流用する。0 の群は出さない）。その右または下に「この土地のページへ →」リンク（`/region/${PREF_SLUGS[pref]}`。`buttonVariants()` をクラスで当てる。`Button` に `<a>` を入れない）。ジャンル絞り込みと県絞り込みが同時のときは、ジャンル総論を優先し、県は見出しに「福島県 × ラーメン」のように併記して構わない（`filterLabel` の組み立てを拡張）。
5. **絞り込み中チップ**（地図上 `top-16` のチップ列）: 県のチップも並べる（×で県だけ解除 → 全国へ戻す）。
6. **文言**: messages の ja/en に追加（`browse.prefFilterClear`「福島県の絞り込みを解除」/「Clear {pref}」、`browse.prefContext`「●生まれた料理 {dish}・■育てる食材 {ingredient}・◆仕込む {prep}」相当を ICU で。`browse.prefPageLink`「この土地のページへ」/「See this prefecture's page」）。クラスタの aria-label `browse.clusterAriaLabel` は現状「{pref} {count}件。選ぶと拡大します」→「{pref} {count}件。選ぶとこの県に絞り込みます」/ en 相当に改める。日本語だけ・英語だけのハードコード禁止。
7. **触らないこと**: ピン選択（`handleSelectFromMap`）の挙動、ジャンル・タグ絞り込みの見え方、地図の縮小率（`compact` は `!isClusterView` で既に true になる）。

## テスト
- `tests/smoke.spec.ts`: クラスタの aria-label を変えるので、既存の `/件。選ぶと拡大します/` を参照している箇所を新文言に更新する。追加: 「福島県クラスタをタップするとシート見出しが『福島県』になり件数が総数より小さく、県の一行文脈と『この土地のページへ』リンクが出る。『絞り込みを解除』で見出しが総数に戻り、クラスタ表示に戻る」（SP 390px）。/en でも見出しが英語県名になることを1本。
- 単体: 県の一行文脈を作る関数を純関数として切り出し（`src/features/browse/prefContext.ts` など）、`.test.ts` で3群の数え方を確認。
- `npm run lint && npx tsc --noEmit && npm run test && npm run test:e2e` を全て通す。E2E は初回に dev サーバー起動待ちで落ちることがあるので、その場合は1回だけ再実行して結果を報告。

## やらないこと
- 県ページ（/region）の変更、DB・マイグレーション、本番投入・デプロイ・push（コミットは feature ブランチに）。`.env*` は読まない・書かない。

## 体験原則の自己点検（報告に含める）
1（地図は退く: 県選択で地図が帯になるか）、2（選択直後の文脈: 県名＋一行＋リンクが件数より前に見えるか）、3（ラベルは土地との関係。「その他」を出していないか）、6（行き止まり: 県の結果ビューから県ページ・全国へ戻れるか）、8（/en に日本語が混入しないか）。

## 報告フォーマット
変更ファイル一覧 / 実行した検証コマンドと結果 / 体験原則の自己点検結果 / 要判断事項（指示書に無い判断が必要だった箇所は勝手に決めず列挙）
