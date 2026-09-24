# 実装指示書: ガイドの「場面」軸と、場面 ⇄ ジャンル ⇄ 料理 ⇄ ガイド の相互遷移

対象: /Users/tanakaryouta/workspace/ia-miracolo/itadaki-atlas（Next.js 16 App Router / next-intl / Supabase）。作業前に `CLAUDE.md`（特に「体験原則」「デザイン」「固有の実装方針」）と `ia-nextjs-standards` Skill を読む。ブランチは `feature/guide-scenes` を切って作業する（main で直接作業しない）。

## 目的（North Star への寄与）
旅行者の問いは「ラーメン屋に入る前に何を知ればいいか」であり、話題（注文・支払い・作法…）より場面で束ねたほうが深く届く。ガイドに「場面」の軸を足し、場面 → ガイド／ジャンル、ジャンル → 場面／ガイド、料理詳細 → 場面、ガイド → 場面 の相互遷移を作る（体験原則6「行き止まりを作らない」）。

## 設計（決定済み。変えない）
1. **場面のマスタはコード定数** `src/features/guide/scenes.ts`（`kinds.ts` と同じ流儀）。ラベルと一行説明は i18n 辞書 `messages/ja.json` / `messages/en.json` の `guide.scene.<slug>` / `guide.sceneIntro.<slug>`（DB の二層方式: マスタラベルは辞書。CLAUDE.md「i18n」）。
   ```ts
   export const GUIDE_SCENES = [
     { slug: "ramen-shop",        genres: ["ramen"] },
     { slug: "soba-udon-shop",    genres: ["soba", "udon"] },
     { slug: "sushi-restaurant",  genres: ["sushi", "sushi-neta"] },
     { slug: "izakaya",           genres: ["yakitori", "nihonshu", "shochu"] },
     { slug: "teishoku-shokudo",  genres: ["machi-chuka", "donburi", "fried", "yoshoku"] },
     { slug: "yakiniku-nabe",     genres: ["wagyu", "beef-cuts", "pork-cuts", "jidori"] },
     { slug: "tabehodai",         genres: [] },
     { slug: "kissa-kanmi",       genres: ["wagashi", "nihoncha"] },
     { slug: "konbini-super",     genres: ["gohan-no-otomo", "tsukemono", "nerimono"] },
     { slug: "depachika-bussanten", genres: ["wagashi", "tsukemono", "nihonshu"] },
     { slug: "station-airport",   genres: [] },
     { slug: "market",            genres: ["fish", "shellfish"] },
     { slug: "festival-yatai",    genres: ["yakisoba", "konamono"] },
     { slug: "brewery-factory",   genres: ["nihonshu", "shochu", "nihoncha"] },
   ] as const;
   ```
   genres の slug は `data/genres.csv` に実在するものだけ（実在しない slug があれば `beef-cuts`/`pork-cuts`/`jidori`/`fried` の実際の slug を genres.csv で確認して置き換える）。
   ラベル（ja / en）: ラーメン屋 / Ramen shops、そば・うどん屋 / Soba & udon shops、寿司屋 / Sushi restaurants、居酒屋・焼き鳥屋 / Izakaya & yakitori、定食屋・食堂・町中華 / Teishoku, shokudo & neighborhood Chinese、焼肉・しゃぶしゃぶ・鍋 / Yakiniku, shabu-shabu & hot pot、食べ放題・飲み放題 / All-you-can-eat & drink、喫茶・カフェ・甘味処 / Kissaten, cafés & sweets shops、コンビニ・スーパー / Convenience stores & supermarkets、デパ地下・物産展・アンテナショップ / Depachika, regional fairs & antenna shops、駅・空港 / Stations & airports、市場・朝市・道の駅 / Markets, morning markets & michi-no-eki、祭り・屋台・フェス・ビアガーデン / Festivals, street stalls & beer gardens、酒蔵・工場見学 / Breweries & factory tours。sceneIntro は各1文（「注文から支払いまで、ラーメン屋で迷わないための一式です」程度。煽らない）。
2. **ガイドと場面の紐づけは `guide_links` に `target_kind = 'scene'` を追加**。マイグレーション1本（`supabase/migrations/20260924000000_guide_links_scene.sql`）で check 制約を `('genre','shelf','tag','pref','item','scene')` に広げる。既存の `20260912200000_guide_places.sql` の書き方に倣う。ローカルは `npx supabase db push --local`（または `supabase migration up`）で当てる。**本番には当てない**（指揮者が行う）。
3. `src/features/guide/schemas.ts` の link kind に `"scene"` を追加し、slug は `GUIDE_SCENES` の slug 集合との突合で検証（pref と同じ流儀）。`scripts/import-guides.ts` の参照先実在チェック（`slugsOf`）にも scene を追加（DB ではなく定数と突合）。
4. **`data/guides.json` の既存47本に scene の links を足す**（`{"kind":"scene","slug":"..."}`）。対応表:
   - ramen-shop: ticket-machine, cash-only, vertical-menu
   - soba-udon-shop: ticket-machine, cash-only
   - sushi-restaurant: vertical-menu, cash-only
   - izakaya: vertical-menu, cash-only
   - teishoku-shokudo: ticket-machine, cash-only, vertical-menu
   - konbini-super: convenience-store-basics, supermarket-basics
   - depachika-bussanten: depachika-basics, bussanten-basics, antenna-shop-basics
   - station-airport: ekiben-and-station-food, soraben-and-airport-food
   - market: michinoeki-and-markets と kind=market の7本
   - festival-yatai: kind=festival の5本、kind=beer-garden の2本、tanabata-and-festival-stalls
   - brewery-factory: kind=brewery-tour の3本、kind=factory-tour の2本
   - food-town の7本と seasons の残りは場面を付けない
   ローカルへ `node --env-file=.env.local scripts/import-guides.ts --file data/guides.json` で投入して確認する。
5. **クエリ** `src/features/guide/queries.ts` に追加: `fetchGuidesForScene(scene, locale)`（guide_links から逆引き、kind→sort_order 順）、`fetchSceneCounts(locale)`（場面ごとの件数。`/guide` で0件の場面を出さないため）、`fetchScenesForGuide(slug)`。既存の `fetchGuidesForItem` は genre/shelf/tag のまま。全件系は `fetchAllRows` を通す（CLAUDE.md）。`/guide` 系は現状 `createClient`（動的）なのでそれに合わせる。
6. **画面**（デザイン規約: 橙・紙・黒禁止・チップは既存の系統チップ／タグチップと同じ部品を使う。新しい見た目を発明しない）
   - `/guide`（`src/app/[locale]/guide/page.tsx`）: CoverHeader の直下に「場面からさがす」節。件数>0 の場面をチップで並べ、`/guide/scene/<slug>` へ。その下は既存の話題別一覧のまま
   - **新規** `/guide/scene/[scene]/page.tsx`: 未知の slug は notFound。CoverHeader（場面名 + sceneIntro）→ その場面のガイドを kind ごとにグループ表示（`/guide` の一覧と同じ見た目）→ 「この場面の食べもの」節: `GUIDE_SCENES` の genres をジャンル名のチップで `/<genre>` へ（ジャンル名は既存のジャンル名取得の仕組みを使う。genres が空の場面はこの節を出さない）→ 末尾に「他の場面」チップ（行き止まり禁止）。`generateMetadata` で title/description、`sitemap.ts` に場面ページを追加、hreflang は既存パターン
   - ジャンルページ `src/app/[locale]/[genre]/page.tsx`: 「地図で見る」CTA（`mapCta`）の後に「食べに行く前に」節を追加: この genre を含む場面のチップ（`/guide/scene/<slug>`）＋ この genre に紐づくガイド（`fetchGuidesForItem({genreSlug, shelfSlug, tagSlugs: []})` の上位3件、タイトル+summary のリスト）。どちらも0件なら節ごと出さない
   - 料理詳細 `src/app/[locale]/[genre]/[slug]/page.tsx` の既存「食べに行く前に」節: ガイド一覧の下に、この item の genreSlug を含む場面のチップを追加（場面が無ければ出さない）
   - ガイド詳細 `src/app/[locale]/guide/[slug]/page.tsx`: 「関係する食べもの」節の並びに「この場面で」チップ（`fetchScenesForGuide`）。無ければ出さない
   - 文言は全て messages の ja/en に追加（`guide.scenesHeading` 「場面からさがす」/「By scene」、`guide.sceneFoodsHeading` 「この場面の食べもの」/「Foods you'll meet here」、`guide.otherScenesHeading` 「他の場面」/「Other scenes」、`genre.beforeYouGoHeading` 「食べに行く前に」/「Before you go」等。既存の detail 側の見出しキーがあれば流用）。日本語だけ・英語だけのハードコード禁止
7. **テスト**: `src/features/guide/scenes.test.ts`（全 slug に ja/en の scene と sceneIntro のキーがある、genres が genres.csv に実在する）。`tests/smoke.spec.ts` に E2E を4本: `/ja/guide` に「場面からさがす」とラーメン屋チップ、`/ja/guide/scene/ramen-shop` に券売機ガイドとラーメンのジャンルチップ、`/ja/ramen` に「食べに行く前に」とラーメン屋チップ、`/en/guide/scene/ramen-shop` が英語で表示。`npm run lint && npx tsc --noEmit && npm run test && npm run test:e2e` を全て通す（既存 E2E は件数非依存なので壊れないはず。壊れたら原因を報告）

## やらないこと
- 新しい guide kind は作らない。`guides` テーブルに列は足さない
- 新しいガイド本文は書かない（別部隊が執筆中。`data/guides.json` に無いガイドへのリンクは作らない）
- 本番へのマイグレーション適用・デプロイ・`git push` はしない（コミットは feature ブランチに行う）
- `.env*` は読まない・書かない

## 体験原則に照らした自己点検（報告に含める）
CLAUDE.md「体験原則」1〜7 を読み、「この原則に照らして他に該当箇所は無いか」を実装後に確認する。特に 2（選択直後に文脈: 場面ページの冒頭に一行説明があるか）、3（ラベルは土地との関係で。「その他」で片づけていないか）、6（行き止まり: 場面ページ末尾に次があるか）、8（/en に日本語が混入していないか）。

## 報告フォーマット
変更ファイル一覧 / 実行した検証コマンドと結果 / 体験原則の自己点検結果 / 要判断事項（指示書に無い判断が必要だった箇所は勝手に決めず列挙）
