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
    // 2026-09-30 デザイン刷新: 罫は強めの一本（#6e5c47 系の罫トークン）で本文と切り、
    // 文字は注（13px）・コピーライトは添え書き（12px）に揃える
    <footer className="border-rule-strong/40 mt-section border-t pt-6 pb-12">
      <nav aria-label={locale === "ja" ? "フッターナビゲーション" : "Footer navigation"}>
        <ul className="type-note text-muted-foreground flex flex-wrap gap-x-6 gap-y-2">
          <li>
            <Link href="/about" className="hover:text-foreground link-underline decoration-transparent">
              {t.about}
            </Link>
          </li>
          <li>
            <Link href="/terms" className="hover:text-foreground link-underline decoration-transparent">
              {t.terms}
            </Link>
          </li>
          <li>
            <Link href="/privacy" className="hover:text-foreground link-underline decoration-transparent">
              {t.privacy}
            </Link>
          </li>
          <li>
            <Link href="/contact" className="hover:text-foreground link-underline decoration-transparent">
              {t.contact}
            </Link>
          </li>
        </ul>
      </nav>
      <p className="type-caption text-muted-foreground mt-5 tracking-[0.08em]">© Itadaki Atlas</p>
    </footer>
  );
}
