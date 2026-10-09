"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/**
 * 言語切り替え。
 *
 * **切り替えは常にリンク遷移**にする（Platform 10_growth_infra.md §3.2）。
 * 自動判定によるリダイレクトは行わない方針なので、これが唯一の切り替え手段になる。
 */
export function LanguageSwitcher({ locale }: { locale: string }) {
  const t = useTranslations("language");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className="flex gap-0.5 md:gap-1">
      {routing.locales.map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          hrefLang={l}
          aria-label={t(l)}
          aria-current={l === locale ? "true" : undefined}
          className={`rounded px-1.5 py-1 text-xs md:px-2 ${
            l === locale ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {/* SP（390px以下）はヘッダーに収めるため短い表記（EN）にする。
              アクセシブルネームは常にフル表記（aria-label）。 */}
          <span aria-hidden="true" className="md:hidden">
            {t(`${l}Short`)}
          </span>
          <span aria-hidden="true" className="hidden md:inline">
            {t(l)}
          </span>
        </Link>
      ))}
    </nav>
  );
}
