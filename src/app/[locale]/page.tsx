import { getTranslations, setRequestLocale } from "next-intl/server";

import { BrowseShell } from "@/features/browse/BrowseShell";
import { fetchMapItems, type Locale } from "@/features/map/queries";

// データ取得はサーバー側（Platform 01_architecture.md §3）。
// src/app は薄く保ち、ロジックは features に置く（ia-nextjs-standards）。
export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("site");
  const items = await fetchMapItems(locale as Locale);

  return (
    <main>
      <h1 className="sr-only">
        {t("title")} — {t("tagline")}
      </h1>
      <BrowseShell items={items} locale={locale as Locale} />
    </main>
  );
}
