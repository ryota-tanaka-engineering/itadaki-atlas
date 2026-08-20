import { setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { localeAlternates } from "@/lib/seo";

/**
 * プライバシーポリシー（Privacy Policy）。
 *
 * about ページと同じ構造の静的バイリンガルページ。文言は発注側で確定済み
 * のため、勝手に増減しない。
 */
type Params = { locale: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  return {
    title: locale === "ja" ? "プライバシーポリシー — Itadaki Atlas" : "Privacy Policy — Itadaki Atlas",
    description:
      locale === "ja"
        ? "Itadaki Atlas のプライバシーポリシーです。"
        : "The privacy policy for Itadaki Atlas.",
    alternates: localeAlternates("/privacy"),
  };
}

export default async function PrivacyPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ja = locale === "ja";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <article className="space-y-8">
        <header>
          <h1 className="text-2xl font-semibold">
            {ja ? "プライバシーポリシー" : "Privacy Policy"}
          </h1>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            {ja ? "1. 収集する情報" : "1. Information we collect"}
          </h2>
          {ja ? (
            <p className="leading-relaxed">
              問い合わせフォームから送信された氏名・メールアドレス・問い合わせ内容。および、サイトの配信に伴いホスティング事業者が記録する標準的なサーバーログ（IPアドレス等）。
            </p>
          ) : (
            <p className="leading-relaxed">
              The name, email address, and message you submit through the contact form. We also
              rely on the standard server logs (such as IP addresses) that our hosting provider
              records as part of serving the site.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            {ja ? "2. 利用目的" : "2. How we use it"}
          </h2>
          {ja ? (
            <p className="leading-relaxed">
              問い合わせへの回答のためにのみ利用します。法令に基づく場合を除き、第三者に提供しません。
            </p>
          ) : (
            <p className="leading-relaxed">
              We use it only to respond to your inquiry. We do not share it with third parties
              except where required by law.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{ja ? "3. Cookie" : "3. Cookies"}</h2>
          {ja ? (
            <p className="leading-relaxed">
              本サイトは言語設定の保持のためにCookieを使用します。アクセス解析・広告のためのCookieは現在使用していません。導入する場合は本ポリシーを更新してお知らせします。
            </p>
          ) : (
            <p className="leading-relaxed">
              This site uses only a cookie that remembers your language preference. We do not
              currently use analytics or advertising cookies. If we introduce any, we will update
              this policy before doing so.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            {ja ? "4. 保管と管理" : "4. Storage and handling"}
          </h2>
          {ja ? (
            <p className="leading-relaxed">
              問い合わせデータは適切なアクセス制限のもとで保管し、目的を達したものは順次削除します。
            </p>
          ) : (
            <p className="leading-relaxed">
              Inquiry data is stored under appropriate access controls and deleted once it is no
              longer needed.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{ja ? "5. 改定" : "5. Changes"}</h2>
          {ja ? (
            <p className="leading-relaxed">
              本ポリシーの変更は本ページへの掲載をもってお知らせします。
            </p>
          ) : (
            <p className="leading-relaxed">
              We will announce any changes to this policy by posting them on this page.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{ja ? "6. お問い合わせ" : "6. Contact"}</h2>
          {ja ? (
            <p className="leading-relaxed">
              本ポリシーに関する質問は
              <Link href="/contact" className="underline">
                問い合わせフォーム
              </Link>
              からお寄せください。
            </p>
          ) : (
            <p className="leading-relaxed">
              If you have questions about this policy, please reach out via our{" "}
              <Link href="/contact" className="underline">
                contact form
              </Link>
              .
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
