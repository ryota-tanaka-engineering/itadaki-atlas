import { Link } from "@/i18n/navigation";

/**
 * トップ「このサイトについて」情報モジュール（作業パッケージ「トップページ情報モジュール」§5）。
 *
 * ヘッダー直下の小さな "aboutLink" テキストリンク（既存・据え置き）とは別に、
 * スクロールした先で件数入りの説明文とAboutページへのリンクを見せる。
 * リンク文言は既存の "このサイトについて" リンクと同名衝突を避けるため別の文言にする
 * （tests/smoke.spec.ts の `sheet.getByRole("link", { name: "このサイトについて" })` が
 * 一意なロケーターであり続けるため）。
 */
type Props = {
  heading: string;
  body: string;
  linkLabel: string;
};

export function AboutBlurbSection({ heading, body, linkLabel }: Props) {
  return (
    <section aria-labelledby="about-blurb-heading" className="border-rule mb-stack border-t pt-stack">
      <h2 id="about-blurb-heading" className="type-title mb-3">
        {heading}
      </h2>
      <p className="type-small text-muted-foreground">{body}</p>
      <Link href="/about" className="type-small link-underline mt-2 inline-block">
        {linkLabel}
      </Link>
    </section>
  );
}
