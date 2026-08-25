import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/features/browse/LanguageSwitcher";

/**
 * 共通ヘッダー（2026-08 デザイン確定。CLAUDE.md「デザイン」節が正典）。
 *
 * 紙色 #fffdf7・下罫 #eee3d2・SP高さ48px / PC(md+)62px。
 * 全ページに設置（layout.tsx）。トップ（地図画面）では BrowseShell がマップを
 * `fixed inset-0` で敷くため、このヘッダーは常にその上に重なって見える。
 *
 * 言語切替は必須機能。右端に必ず置き、SPでも省略しない。
 */
export async function SiteHeader({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "header" });

  return (
    <header className="bg-background sticky top-0 z-40 h-12 border-b border-[#eee3d2] md:h-[3.875rem]">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2">
          <MonMark />
          <span className="text-primary truncate text-sm font-bold tracking-[0.08em] md:text-base">
            ITADAKI ATLAS
          </span>
        </Link>

        {/* PC専用ナビ。遷移先は今後の画面実装で差す（現状はトップへのリンク） */}
        <nav aria-label={t("navLabel")} className="hidden items-center gap-6 text-sm md:flex">
          <Link href="/" className="text-foreground/80 hover:text-foreground">
            {t("navPlace")}
          </Link>
          <Link href="/" className="text-foreground/80 hover:text-foreground">
            {t("navType")}
          </Link>
          <Link href="/" className="text-foreground/80 hover:text-foreground">
            {t("navInterest")}
          </Link>
        </nav>

        <div className="shrink-0">
          <LanguageSwitcher locale={locale} />
        </div>
      </div>
    </header>
  );
}

/** 暫定ロゴ。●■◆の三つ紋（CLAUDE.md「マーク（ロゴ）は未決」節）。 */
function MonMark() {
  return (
    <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true" className="shrink-0">
      <circle cx="16" cy="16" r="15" fill="none" stroke="#ff8f00" strokeWidth="1.5" />
      <circle cx="16" cy="9.5" r="3.2" fill="#ff8f00" />
      <rect x="8.1" y="17.4" width="6" height="6" fill="#e56000" />
      <path d="M23.9 17.4 L27.3 20.7 L23.9 24 L20.5 20.7 Z" fill="#ffc985" />
    </svg>
  );
}
