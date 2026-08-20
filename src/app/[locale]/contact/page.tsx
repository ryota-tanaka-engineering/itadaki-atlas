import { setRequestLocale } from "next-intl/server";

import { SiteFooter } from "@/components/SiteFooter";
import { ContactForm } from "@/features/contact/ContactForm";
import { localeAlternates } from "@/lib/seo";

/**
 * 問い合わせフォーム。
 *
 * 掲載・タイアップの相談、内容の訂正指摘、その他の連絡を受ける唯一の窓口。
 * 送信は features/contact/ContactForm（クライアント）が
 * inquiries テーブルへ直接 INSERT する。
 */
type Params = { locale: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  return {
    title: locale === "ja" ? "お問い合わせ" : "Contact",
    description:
      locale === "ja"
        ? "掲載・タイアップのご相談、内容の訂正のご指摘、その他のご連絡はこちらから。"
        : "Reach out about listings and partnerships, corrections, or anything else.",
    alternates: localeAlternates("/contact"),
  };
}

export default async function ContactPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ja = locale === "ja";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">{ja ? "お問い合わせ" : "Contact"}</h1>
        <p className="mt-3 leading-relaxed">
          {ja
            ? "掲載・タイアップのご相談、内容の訂正のご指摘、その他のご連絡はこちらから。返信が必要な場合は、ご入力いただいたメールアドレスへお返事します。"
            : "Get in touch about listings and partnerships, a correction to something we've published, or anything else. If a reply is needed, we'll write back to the email address you enter below."}
        </p>
      </header>

      <ContactForm locale={locale === "ja" ? "ja" : "en"} />

      <SiteFooter locale={locale} />
    </main>
  );
}
