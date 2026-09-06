import { getTranslations, setRequestLocale } from "next-intl/server";

import { BrowseShell } from "@/features/browse/BrowseShell";
import { pickDailyItems } from "@/features/browse/dailyPicks";
import {
  fetchAllChains,
  fetchGenres,
  fetchHonbaGroups,
  fetchHonbaPins,
  fetchMapItems,
  fetchPrefsWithItems,
  type Locale,
} from "@/features/map/queries";

// データ取得はサーバー側（Platform 01_architecture.md §3）。
// src/app は薄く保ち、ロジックは features に置く（ia-nextjs-standards）。
//
// 2026-08 デザイン確定: ジャンルチップと言語切替はトップ専用の浮遊要素ではなく、
// 共通ヘッダー（言語切替）とボトムシート内「種類からさがす」カード（ジャンル一覧）に
// 統合された（.claude/agents 経由の指示書 §2, §4）。
export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("site");
  const [items, genres, honbaPins, honbaGroups, chains, prefs] = await Promise.all([
    fetchMapItems(locale as Locale),
    fetchGenres(),
    // 本場ピン（2026-09）。発祥ピンとは別経路で取得し、地図側でだけ合流させる
    // （索引・件数表記は従来どおり発祥のみ。BrowseShell 参照）。
    fetchHonbaPins(locale as Locale),
    // トップ情報モジュール「本場をたどる」用（2026-09）。地図ピンとは別に、
    // アイテム単位で集約した本場データ（BrowseShell 参照）。
    fetchHonbaGroups(),
    // トップ情報モジュール「チェーンから、ご当地へ」用（2026-09）。ジャンル非依存の全チェーン。
    fetchAllChains(),
    // トップ情報モジュール「このサイトについて」の件数（DB実数）用。
    fetchPrefsWithItems(),
  ]);

  // 「今日の一皿」「土地の物語から」の日付選定はサーバー側で1回だけ確定させる
  // （dailyPicks.ts。ランキング・「おすすめ」ではない中立な順繰り）。
  const { dish: dailyDish, stories: landStories } = pickDailyItems(items, new Date());

  return (
    <main>
      <h1 className="sr-only">
        {t("title")} — {t("tagline")}
      </h1>
      <BrowseShell
        items={items}
        honbaPins={honbaPins}
        genres={genres}
        locale={locale as Locale}
        dailyDish={dailyDish}
        landStories={landStories}
        honbaGroups={honbaGroups}
        chains={chains}
        siteCounts={{ items: items.length, prefs: prefs.length }}
      />
    </main>
  );
}
