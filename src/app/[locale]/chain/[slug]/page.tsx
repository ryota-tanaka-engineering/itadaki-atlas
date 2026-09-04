import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { CoverHeader } from "@/components/CoverHeader";
import { fetchChainBySlug, fetchGenre, fetchOtherChainsInGenre } from "@/features/map/queries";
import { ChainDetailBody } from "@/features/map/ChainDetailBody";
import type { ConnectionCard } from "@/features/map/ItemConnections";
import { localeAlternates } from "@/lib/seo";

/**
 * チェーン独立ページ（SEOの流入起点。/[genre]/[slug] のセクション表示とは別のURL）。
 *
 * チェーン名は検索ボリュームが大きいため、1チェーン=1URLにして検索流入の入口にし、
 * bridge文（橋渡しの一文）を主役に「この味が好きなら→ご当地ラーメンへ」と渡す
 * （North Star「広く」軸の入口装置。ia-atlas-content Skill §3、.doc/20_data/01_models.md §3.9）。
 * 出典（source_url/source_note）はDB内部の検証データのためUIには出さない
 * （詳細ページ src/app/[locale]/[genre]/[slug]/page.tsx と同じ方針）。
 */
type Params = { locale: string; slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  const chain = await fetchChainBySlug(slug);
  if (!chain) return {};

  const isJa = locale === "ja";
  const title = isJa ? chain.nameJa : chain.nameEn;
  const description = isJa ? chain.bridgeJa : chain.bridgeEn;

  return {
    title,
    description,
    alternates: localeAlternates(`/chain/${slug}`),
    openGraph: {
      type: "article",
      title,
      description,
      locale,
    },
  };
}

export default async function ChainPage({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const chain = await fetchChainBySlug(slug);
  if (!chain) notFound();

  const t = await getTranslations("chain");
  const isJa = locale === "ja";

  const [genre, otherChainRows] = await Promise.all([
    fetchGenre(chain.genreSlug),
    fetchOtherChainsInGenre(chain.genreSlug, chain.slug),
  ]);

  const displayName = isJa ? chain.nameJa : chain.nameEn;
  const style = isJa ? chain.styleJa : chain.styleEn;
  // founded_note は日本語のみのカラム（英訳列が無い）。英語ページで日英混在にしないため ja のみで出す。
  const founded = isJa ? chain.foundedNote : null;
  const bridge = isJa ? chain.bridgeJa : chain.bridgeEn;
  const genreName = genre ? (isJa ? genre.nameJa : genre.nameEn) : null;

  const recommendItems: ConnectionCard[] = chain.recommendations.map((r) => ({
    key: r.key,
    href: `/${r.genreSlug ?? r.shelfSlug}/${r.slug}`,
    name: isJa ? r.nameJa : (r.nameEn ?? r.nameRomaji),
  }));
  const otherChains = otherChainRows.map((c) => ({
    slug: c.slug,
    name: isJa ? c.nameJa : c.nameEn,
  }));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-8 md:max-w-3xl">
      <div className="px-4 md:px-0">
        <CoverHeader eyebrow={t("label")} title={displayName} />
      </div>

      <div className="px-4 pt-8 md:px-0">
        <article>
          <ChainDetailBody
            bridge={bridge}
            style={style}
            styleLabel={t("style")}
            founded={founded}
            foundedLabel={t("founded")}
            recommendHeading={t("recommendHeading")}
            recommendItems={recommendItems}
            otherChainsHeading={t("otherChainsHeading")}
            otherChains={otherChains}
            genreHref={genreName ? `/${chain.genreSlug}` : null}
            genreLinkLabel={genreName ? t("genreLink", { name: genreName }) : null}
          />

          {/* 出典はDB内部の検証データ。UIには出さず、訂正導線だけを残す（詳細ページと同じ方針） */}
          <p className="text-center">
            <Link href="/contact" className="text-brand-accent-dark text-xs underline">
              {t("correction")}
            </Link>
          </p>
        </article>
      </div>

      <div className="px-4 md:px-0">
        <SiteFooter locale={locale} />
      </div>
    </main>
  );
}
