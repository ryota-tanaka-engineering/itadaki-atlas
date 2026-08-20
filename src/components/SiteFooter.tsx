import { Link } from "@/i18n/navigation";

/**
 * 共通フッター。
 *
 * 細いヘアライン区切りの控えめな導線（このサイトについて・利用規約・
 * プライバシーポリシー・お問い合わせ）。トップ（フルスクリーン地図）には
 * 置かない。設置先の各ページが自身のコンテナ幅に合わせて内側に置く。
 */
const LABELS = {
  ja: { about: "このサイトについて", terms: "利用規約", privacy: "プライバシーポリシー", contact: "お問い合わせ" },
  en: { about: "About", terms: "Terms", privacy: "Privacy", contact: "Contact" },
} as const;

export function SiteFooter({ locale }: { locale: string }) {
  const t = locale === "ja" ? LABELS.ja : LABELS.en;

  return (
    <footer className="mt-12 border-t pt-6 pb-10">
      <nav aria-label={locale === "ja" ? "フッターナビゲーション" : "Footer navigation"}>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <li>
            <Link href="/about" className="hover:underline">
              {t.about}
            </Link>
          </li>
          <li>
            <Link href="/terms" className="hover:underline">
              {t.terms}
            </Link>
          </li>
          <li>
            <Link href="/privacy" className="hover:underline">
              {t.privacy}
            </Link>
          </li>
          <li>
            <Link href="/contact" className="hover:underline">
              {t.contact}
            </Link>
          </li>
        </ul>
      </nav>
      <p className="mt-4 text-xs text-muted-foreground">© Itadaki Atlas</p>
    </footer>
  );
}
