import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 節の見出し（2026-09-30 デザイン刷新。タイプスケールは globals.css）。
 *
 * - title: 明朝の節見出し（type-title）＋細罫。一覧の群・本文の節
 * - label: 小さなゴシックの見出し（type-label）。ページ末尾の「次の入口」群
 */
type Props = {
  children: ReactNode;
  variant?: "title" | "label";
  /** 見出しの右に添える件数 */
  count?: number | null;
  /** 見出しの左に置く記号（系統色の丸・●■◆ 等） */
  mark?: ReactNode;
  id?: string;
  className?: string;
  as?: "h2" | "h3";
};

export function SectionHeading({ children, variant = "title", count, mark, id, className, as = "h2" }: Props) {
  const Tag = as;
  if (variant === "label") {
    return (
      <Tag id={id} className={cn("type-label mb-3 flex items-center gap-2", className)}>
        {mark}
        {children}
        {count != null && <span className="font-normal tabular-nums">{count}</span>}
      </Tag>
    );
  }
  return (
    <Tag
      id={id}
      className={cn("type-title border-rule mb-2 flex items-center gap-2.5 border-b pb-3", className)}
    >
      {mark}
      <span>{children}</span>
      {count != null && (
        <span className="type-caption text-muted-foreground font-sans tabular-nums">{count}</span>
      )}
    </Tag>
  );
}
