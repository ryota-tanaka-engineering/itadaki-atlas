import type { ComponentProps } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * 罫線で区切った「見出し＋一行」のリスト（2026-09-30 デザイン刷新。カードの縦積みをやめる）。
 * 詳細ページのつながり・ガイド・チェーンの推薦先などで使う。
 */
export type RowLinkItem = {
  key: string;
  href: ComponentProps<typeof Link>["href"];
  title: string;
  meta?: string | null;
};

export function RowList({
  rows,
  className,
  metaLines = 2,
}: {
  rows: RowLinkItem[];
  className?: string;
  /** 補足を何行で切るか */
  metaLines?: 1 | 2;
}) {
  if (rows.length === 0) return null;
  return (
    <ul className={cn("divide-rule divide-y", className)}>
      {rows.map((row) => (
        <li key={row.key}>
          <Link href={row.href} className="group flex items-baseline gap-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="type-small group-hover:text-brand-accent-dark block font-semibold transition-colors">
                {row.title}
              </span>
              {row.meta && (
                <span
                  className={cn(
                    "type-note text-muted-foreground mt-0.5 block",
                    metaLines === 1 ? "line-clamp-1" : "line-clamp-2",
                  )}
                >
                  {row.meta}
                </span>
              )}
            </span>
            <span
              aria-hidden
              className="text-primary shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
