import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { localeAlternates } from "@/lib/seo";

/**
 * 当サイトについて（About）。
 *
 * 何のサイトか・編集方針・広告方針を公開の場で約束するページ。
 * 資料集としての信頼の根拠であり、開発時の「ブレ止め」でもある。
 * 内容の正典は .doc/00_concept/（vision / north_star）と .doc/40_operation/01_strategy.md。
 */
type Params = { locale: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  return {
    title: locale === "ja" ? "このサイトについて" : "About Itadaki Atlas",
    description:
      locale === "ja"
        ? "Itadaki Atlas は、日本の食がどこで生まれ、なぜそこで生まれたのかを地図に記録する資料集です。編集方針と運営について。"
        : "Itadaki Atlas is a geographic reference of Japanese food — where each dish was born, and why there. Our editorial policy.",
    alternates: localeAlternates("/about"),
  };
}

export default async function AboutPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const ja = locale === "ja";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <article className="space-y-10">
        <header>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
        </header>

        <section className="space-y-3">
          {ja ? (
            <>
              <p className="leading-relaxed">
                Itadaki Atlas（イタダキ アトラス）は、日本の食の地理データベースです。日本の食文化は驚くほど粒度が細かく、「ラーメン」とひとことで呼ばれるものの中に、土地ごとの理由を持った何十もの型があります。当サイトはそれらを細かく分類し、
                <strong>どこで生まれ、なぜそこで生まれたのか</strong>
                を地図の上に記録します。
              </p>
              <p className="leading-relaxed">
                口コミサイトでもレシピサイトでもありません。土地と食の因果を記録する資料集です。
              </p>
            </>
          ) : (
            <>
              <p className="leading-relaxed">
                Itadaki Atlas is a geographic database of Japanese food. Japanese food culture is
                astonishingly fine-grained: inside the single word &ldquo;ramen&rdquo; live dozens
                of regional forms, each with a reason rooted in its land. This site classifies
                them and records <strong>where each was born, and why there</strong> — on a map.
              </p>
              <p className="leading-relaxed">
                This is not a review site and not a recipe site. It is a reference for the
                relationship between land and food.
              </p>
            </>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("pillarsTitle")}</h2>
          <ul className="list-disc space-y-2 pl-5 leading-relaxed">
            {ja ? (
              <>
                <li>
                  <strong>発祥と産地の地図</strong> — 料理は「この土地で生まれた」、食材は「この土地が育てる」。土地との関係ごと記録します
                </li>
                <li>
                  <strong>メニューの解読</strong> —
                  全項目を「日本語名 — ローマ字 — 英訳」の三点セットで表記します。店のメニューと照合でき、注文できることを目指します
                </li>
                <li>
                  <strong>土地の物語</strong> — 「コメがうまい土地は飯も酒もうまい」。土地を主語に、食のつながりを辿れるようにします
                </li>
              </>
            ) : (
              <>
                <li>
                  <strong>Mapping origins</strong> — dishes are recorded where they were born,
                  ingredients where they are raised
                </li>
                <li>
                  <strong>Decoding menus</strong> — every entry carries its Japanese name, romaji,
                  and a descriptive English gloss, so you can match it against a real menu and
                  order it
                </li>
                <li>
                  <strong>Stories of the land</strong> — regions are first-class here: from any
                  place, you can trace everything it gave to the table
                </li>
              </>
            )}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("policyTitle")}</h2>
          <ul className="list-disc space-y-2 pl-5 leading-relaxed">
            {ja ? (
              <>
                <li>掲載内容は一次情報にもとづいて検証しています（出典は編集部で管理）</li>
                <li>文章はすべて書き下ろします。他サイトからの転載は行いません</li>
                <li>
                  <strong>ランキングや優劣はつけません。</strong>
                  どの土地の食にも、そこで生まれた理由があります。当サイトは事実の記録に徹します
                </li>
                <li>誤りに気づかれた場合の指摘を歓迎します</li>
              </>
            ) : (
              <>
                <li>Every entry is verified against primary sources, which we keep on file internally</li>
                <li>All text is written by us. We never copy from other sites</li>
                <li>
                  <strong>We do not rank.</strong> Every regional food has its own reason for
                  existing; our job is to record the facts
                </li>
                <li>Corrections are always welcome</li>
              </>
            )}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("adsTitle")}</h2>
          <p className="leading-relaxed">
            {ja
              ? "現在、広告は掲載していません。将来掲載する場合も「PR」表記を必須とし、編集内容とは明確に分離します。"
              : "We currently carry no advertising. If we ever do, it will be clearly marked as sponsored and kept separate from editorial content."}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("operatorTitle")}</h2>
          <p className="leading-relaxed">
            {ja ? "株式会社IA MIRACOLO が運営しています。" : "Operated by IA MIRACOLO Inc."}
          </p>
        </section>

        <p>
          <Link href="/" className="text-sm underline">
            {t("backToMap")}
          </Link>
        </p>
      </article>

      <SiteFooter locale={locale} />
    </main>
  );
}
