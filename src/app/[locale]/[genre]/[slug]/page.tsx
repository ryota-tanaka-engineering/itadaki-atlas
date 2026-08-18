import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import {
  fetchItemBySlug,
  fetchRelated,
  fetchSamePref,
  type Locale,
} from "@/features/map/queries";
import { PIN_STROKE, styleColor } from "@/features/map/styles";
import { localeAlternates } from "@/lib/seo";
import { PREF_SLUGS, type Prefecture } from "@/lib/prefectures";

type Params = { locale: string; genre: string; slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale, genre, slug } = await params;
  const item = await fetchItemBySlug(genre, slug, locale as Locale);
  if (!item) return {};

  // 三点セットをタイトルにも出す（.doc/00_concept/05_brand.md §5）
  const title =
    locale === "ja"
      ? `${item.nameJa}（${item.nameRomaji}）`
      : `${item.nameRomaji}${item.nameEn ? ` — ${item.nameEn}` : ""}`;

  return {
    title,
    description: item.summary ?? undefined,
    alternates: localeAlternates(`/${genre}/${slug}`),
    openGraph: {
      type: "article",
      title,
      description: item.summary ?? undefined,
      locale,
    },
  };
}

export default async function ItemPage({ params }: { params: Promise<Params> }) {
  const { locale, genre, slug } = await params;
  setRequestLocale(locale);

  const item = await fetchItemBySlug(genre, slug, locale as Locale);
  if (!item) notFound();

  const t = await getTranslations("item");
  const tp = await getTranslations("prefecture");
  const ts = await getTranslations("style");
  const tr = await getTranslations("relation");
  const trr = await getTranslations("regionRelation");

  // 行き止まり禁止（回遊が価値の中核）。relations に行を足すと双方向で増え、
  // 同県リンクはデータを足すだけで自動で増える
  const [related, samePrefAll] = await Promise.all([
    fetchRelated(slug, locale as Locale),
    item.originPref
      ? fetchSamePref(slug, item.originPref, locale as Locale)
      : Promise.resolve([]),
  ]);
  // 名前つき関係で既に出ているアイテムは同県リストから外す（重複表示を避ける）
  const relatedSlugs = new Set(related.map((r) => r.slug));
  const samePref = samePrefAll.filter((r) => !relatedSlugs.has(r.slug));

  // 英訳は「名前」ではなく説明訳なので、英語表示でも見出しはローマ字にする
  // （.doc/00_concept/05_brand.md §5）。説明訳は副題として添える。
  const displayName = locale === "ja" ? item.nameJa : item.nameRomaji;
  const subtitle = locale === "ja" ? item.nameRomaji : item.nameEn;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <article>
        <header className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block size-4 rounded-full border"
              style={{
                backgroundColor: styleColor(item.primaryStyle),
                borderColor: PIN_STROKE,
              }}
            />
            <span className="text-muted-foreground text-sm">
              {item.primaryStyle ? ts(item.primaryStyle) : t("unknown")}
            </span>
          </div>

          {/* 三点セット: 日本語名 — ローマ字 — 英訳 */}
          <h1 className="text-2xl font-semibold">{displayName}</h1>
          {subtitle && <p className="mt-1 text-base">{subtitle}</p>}
          {/* 三点セット: 日本語名 — ローマ字 — 英訳（説明訳） */}
          <p className="text-muted-foreground mt-2 text-xs">
            {item.nameJa} — {item.nameRomaji}
            {item.nameEn ? ` — ${item.nameEn}` : ""}
          </p>
        </header>

        <dl className="mb-6 text-sm">
          <div className="flex gap-3 py-1">
            <dt className="text-muted-foreground w-20 shrink-0">{t("origin")}</dt>
            <dd>
              {item.originPref
                ? `${tp(item.originPref)}${item.originCity ? ` / ${item.originCity}` : ""}`
                : t("unknown")}
            </dd>
          </div>
          <div className="flex gap-3 py-1">
            <dt className="text-muted-foreground w-20 shrink-0">{t("style")}</dt>
            <dd>{item.primaryStyle ? ts(item.primaryStyle) : t("unknown")}</dd>
          </div>
        </dl>

        {item.summary && <p className="mb-8 leading-relaxed">{item.summary}</p>}

        {/* 名産地など。発祥を1つに決められないアイテム（ネタ・食材）が土地と結びつく */}
        {item.regions.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-2 text-sm font-semibold">{t("regions")}</h2>
            <ul className="flex flex-wrap gap-2">
              {item.regions.map((r) => (
                <li key={`${r.pref}-${r.relationType}`}>
                  <Link
                    href={`/region/${PREF_SLUGS[r.pref as Prefecture]}`}
                    className="bg-muted hover:bg-muted/70 inline-block rounded-full px-3 py-1 text-xs"
                  >
                    {tp(r.pref)}
                    {r.city ? ` ${r.city}` : ""}
                    <span className="text-muted-foreground ml-1">{trr(r.relationType)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* つながり: 名前のついた関係リンク。押す前に一つ学べる形にする */}
        {(related.length > 0 || samePref.length > 0) && (
          <section className="mb-8 border-t pt-4">
            <h2 className="mb-3 text-sm font-semibold">{t("connections")}</h2>
            <ul className="space-y-2">
              {related.map((r) => (
                <li key={`${r.relationType}-${r.slug}`}>
                  <Link
                    href={`/${genre}/${r.slug}`}
                    className="hover:bg-muted/50 block rounded-lg border p-3"
                  >
                    <span className="text-muted-foreground block text-xs">
                      {tr(`${r.relationType}.${r.otherIsFrom ? "otherIsFrom" : "otherIsTo"}`)}
                    </span>
                    <span className="block font-medium">
                      {locale === "ja" ? r.nameJa : r.nameRomaji}
                    </span>
                    {r.summary && (
                      <span className="text-muted-foreground block text-xs">{r.summary}</span>
                    )}
                  </Link>
                </li>
              ))}
              {samePref.map((r) => (
                <li key={`same-${r.slug}`}>
                  <Link
                    href={`/${r.genreSlug ?? genre}/${r.slug}`}
                    className="hover:bg-muted/50 block rounded-lg border p-3"
                  >
                    <span className="text-muted-foreground block text-xs">
                      {t("samePref", { pref: tp(item.originPref as string) })}
                    </span>
                    <span className="block font-medium">
                      {locale === "ja" ? r.nameJa : r.nameRomaji}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {item.originPref && (
              <p className="mt-3">
                <Link
                  href={`/region/${PREF_SLUGS[item.originPref as Prefecture]}`}
                  className="text-sm underline"
                >
                  {t("regionPage", { pref: tp(item.originPref) })}
                </Link>
              </p>
            )}
          </section>
        )}

        {/* 出典は記事末尾に自動表示する（.doc/40_operation/01_strategy.md §1.1） */}
        <section className="border-t pt-4">
          <h2 className="mb-2 text-sm font-semibold">{t("sources")}</h2>
          <ul className="text-muted-foreground space-y-1 text-xs">
            {item.sources.map((s, i) => (
              <li key={i}>
                {s.url ? (
                  <a href={s.url} className="underline" rel="noreferrer" target="_blank">
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
                {s.publisher ? ` / ${s.publisher}` : ""}
                {s.accessedAt ? ` / ${t("accessedAt")}: ${s.accessedAt}` : ""}
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-8">
          <Link href="/" className="text-sm underline">
            {t("viewOnMap")}
          </Link>
        </p>
      </article>
    </main>
  );
}
