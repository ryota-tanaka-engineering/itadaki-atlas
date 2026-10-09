import type { ComponentProps, ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * 遷移リンク（チップ3種の3つ目。chip.tsx 参照）。容器（枠・塗り）を持たない下線リンク。
 * 下線は淡 #ffc985・ホバーでブランド橙（globals.css の `link-underline`）。
 */
type Href = ComponentProps<typeof Link>["href"];

type Props = {
  href: Href;
  children: ReactNode;
  className?: string;
};

export function TextLink({ href, children, className }: Props) {
  return (
    <Link href={href} className={cn("link-underline", className)}>
      {children}
    </Link>
  );
}

/** 「次へ進む」ことを示す矢印付きの遷移リンク（一覧の末尾・軸の終わりに置く）。 */
export function ArrowLink({ href, children, className }: Props) {
  return (
    <Link href={href} className={cn("group type-small inline-flex items-baseline gap-1.5", className)}>
      <span className="link-underline">{children}</span>
      <span
        aria-hidden
        className="text-primary inline-block transition-transform group-hover:translate-x-0.5"
      >
        →
      </span>
    </Link>
  );
}

export type LinkCloudItem = {
  key: string;
  href: Href;
  label: string;
  /** 件数など、リンクの後ろに薄く添える数字 */
  count?: number | null;
};

/**
 * 遷移リンクの並び（場面・県・タグ・他のチェーン等）。ピルにせず、下線リンクを
 * ゆったり流し組みにする（押せる領域は上下の余白で 28px 以上を確保）。
 */
export function LinkCloud({ items, className }: { items: LinkCloudItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-x-5 gap-y-1", className)}>
      {items.map((item) => (
        <li key={item.key}>
          <Link href={item.href} className="group type-small inline-flex items-baseline gap-1 py-1">
            <span className="link-underline">{item.label}</span>
            {item.count != null && (
              <span className="type-caption text-muted-foreground tabular-nums">{item.count}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
