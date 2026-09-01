import { getTranslations, setRequestLocale } from "next-intl/server";

import { BrowseShell } from "@/features/browse/BrowseShell";
import { fetchGenres, fetchHonbaPins, fetchMapItems, type Locale } from "@/features/map/queries";

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
  const [items, genres, honbaPins] = await Promise.all([
    fetchMapItems(locale as Locale),
    fetchGenres(),
    // 本場ピン（2026-09）。発祥ピンとは別経路で取得し、地図側でだけ合流させる
    // （索引・件数表記は従来どおり発祥のみ。BrowseShell 参照）。
    fetchHonbaPins(locale as Locale),
  ]);

  return (
    <main>
      <h1 className="sr-only">
        {t("title")} — {t("tagline")}
      </h1>
      <BrowseShell items={items} honbaPins={honbaPins} genres={genres} locale={locale as Locale} />
    </main>
  );
}
