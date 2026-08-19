import { getTranslations, setRequestLocale } from "next-intl/server";

import { BrowseShell } from "@/features/browse/BrowseShell";
import { Link } from "@/i18n/navigation";
import { fetchGenres, fetchMapItems, type Locale } from "@/features/map/queries";

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
  const [items, genres] = await Promise.all([
    fetchMapItems(locale as Locale),
    fetchGenres(),
  ]);

  return (
    <main>
      <h1 className="sr-only">
        {t("title")} — {t("tagline")}
      </h1>
      {/* ジャンルチップ。genres に行を足すだけでここに増える */}
      <nav
        aria-label={t("title")}
        className="absolute top-4 left-4 z-30 flex max-w-[50vw] gap-1 overflow-x-auto"
      >
        {genres.map((g) => (
          <Link
            key={g.slug}
            href={`/${g.slug}`}
            className="bg-background/90 rounded-full border px-3 py-1 text-xs whitespace-nowrap shadow-sm backdrop-blur"
          >
            {locale === "ja" ? g.nameJa : g.nameEn}
          </Link>
        ))}
        <Link
          href="/about"
          className="bg-background/90 text-muted-foreground rounded-full border px-3 py-1 text-xs whitespace-nowrap shadow-sm backdrop-blur"
        >
          {locale === "ja" ? "このサイトについて" : "About"}
        </Link>
      </nav>
      <BrowseShell items={items} locale={locale as Locale} />
    </main>
  );
}
