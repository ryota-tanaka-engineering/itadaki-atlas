import { setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { localeAlternates } from "@/lib/seo";

/**
 * 利用規約（Terms of Use）。
 *
 * about ページと同じ構造の静的バイリンガルページ。文言は発注側で確定済み
 * のため、勝手に増減しない。
 */
type Params = { locale: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  return {
    title: locale === "ja" ? "利用規約 — Itadaki Atlas" : "Terms of Use — Itadaki Atlas",
    description:
      locale === "ja"
        ? "Itadaki Atlas の利用規約です。"
        : "The terms of use for Itadaki Atlas.",
    alternates: localeAlternates("/terms"),
  };
}

export default async function TermsPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ja = locale === "ja";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <article className="space-y-8">
        <header>
          <h1 className="text-2xl font-semibold">{ja ? "利用規約" : "Terms of Use"}</h1>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{ja ? "1. 適用" : "1. Scope"}</h2>
          {ja ? (
            <p className="leading-relaxed">
              本規約は、Itadaki Atlas（以下「本サイト」）の利用に適用されます。本サイトを利用した時点で、本規約に同意したものとみなします。
            </p>
          ) : (
            <p className="leading-relaxed">
              These terms apply to your use of Itadaki Atlas (&ldquo;the site&rdquo;). By using
              the site, you agree to these terms.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            {ja ? "2. 知的財産" : "2. Intellectual property"}
          </h2>
          {ja ? (
            <p className="leading-relaxed">
              本サイトに掲載する文章・図版・データベースの著作権は、運営者または正当な権利者に帰属します。出典を明記しリンクを付す引用は歓迎しますが、無断転載・複製はお断りします。
            </p>
          ) : (
            <p className="leading-relaxed">
              All text, figures, and the database published on this site are the property of the
              operator or the rightful owners. Quotation with clear attribution and a link back is
              welcome; wholesale reproduction or copying is not permitted.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{ja ? "3. 免責" : "3. Disclaimer"}</h2>
          {ja ? (
            <p className="leading-relaxed">
              掲載内容の正確性には努めますが、その完全性・最新性を保証するものではありません。本サイトの情報を利用したことによる損害について、運営者は責任を負いません。外部リンク先の内容についても同様です。
            </p>
          ) : (
            <p className="leading-relaxed">
              We strive for accuracy, but we do not guarantee the completeness or currency of
              anything published here. The operator is not liable for damages arising from your
              use of the information on this site, including the content of external links.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            {ja ? "4. 禁止事項" : "4. Prohibited conduct"}
          </h2>
          {ja ? (
            <p className="leading-relaxed">
              本サイトの運営を妨害する行為、不正アクセス、サーバーに過度な負荷をかける行為を禁止します。
            </p>
          ) : (
            <p className="leading-relaxed">
              You may not interfere with the operation of the site, attempt unauthorized access,
              or place excessive load on our servers.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{ja ? "5. 規約の変更" : "5. Changes"}</h2>
          {ja ? (
            <p className="leading-relaxed">
              本規約は予告なく変更することがあります。変更後の規約は本ページに掲載した時点で効力を生じます。
            </p>
          ) : (
            <p className="leading-relaxed">
              These terms may change without notice. Changes take effect as soon as they are
              posted on this page.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            {ja ? "6. 準拠法・管轄" : "6. Governing law"}
          </h2>
          {ja ? (
            <p className="leading-relaxed">
              本規約は日本法に準拠し、本サイトに関する紛争は運営者所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。
            </p>
          ) : (
            <p className="leading-relaxed">
              These terms are governed by the laws of Japan. Any dispute relating to this site is
              subject to the exclusive jurisdiction of the court with jurisdiction over the
              operator&rsquo;s place of business as the court of first instance.
            </p>
          )}
        </section>

        <p>
          <Link href="/" className="text-sm underline">
            {ja ? "地図へ戻る" : "Back to the map"}
          </Link>
        </p>
      </article>

      <SiteFooter locale={locale} />
    </main>
  );
}
