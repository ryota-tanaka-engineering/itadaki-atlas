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
    <nav aria-label={t("label")} className="flex gap-1">
      {routing.locales.map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          hrefLang={l}
          aria-current={l === locale ? "true" : undefined}
          className={`rounded px-2 py-1 text-xs ${
            l === locale ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {t(l)}
        </Link>
      ))}
    </nav>
  );
}
