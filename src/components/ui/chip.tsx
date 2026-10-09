import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * チップは3種だけ（2026-09-30 デザイン刷新。CLAUDE.md「デザイン」節）。
 * 押せるもの／分類ラベル／遷移先が同じ見た目にならないよう、形と塗りで分ける。
 *
 * 1. 絞り込みチップ（押すと状態が変わる。button + aria-pressed）= `filterChipClass`
 *    丸いピル・橙の細罫。選択中は橙塗り+白字
 * 2. 分類ラベル（押せない）= `LabelChip`
 *    罫なし・淡い紙色の塗り・小さな角丸（ピルにしない）
 * 3. 遷移リンク（別ページへ移る）= `text-link.tsx` の `TextLink` / `ArrowLink`
 *    容器を持たない下線リンク（下線は淡 #ffc985）
 */
export function filterChipClass({
  active = false,
  size = "md",
}: { active?: boolean; size?: "sm" | "md" } = {}) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border whitespace-nowrap transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    size === "md" ? "type-small min-h-8 px-3 py-1" : "type-note min-h-7 px-2.5 py-0.5",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-primary/45 bg-background text-foreground hover:border-primary",
  );
}

type LabelChipProps = {
  children: ReactNode;
  /** 系統色など、色で識別するラベルに添える小さな丸 */
  dotColor?: string | null;
  dotStroke?: string;
  /** 橙カバーの上に置くときは onBrand（白字・半透明の白塗り） */
  tone?: "paper" | "onBrand";
  /** sm=12px（一覧の行末）/ md=13px（カバーの事実） */
  size?: "sm" | "md";
  className?: string;
};

export function LabelChip({
  children,
  dotColor,
  dotStroke,
  tone = "paper",
  size = "sm",
  className,
}: LabelChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[4px] whitespace-nowrap",
        size === "sm" ? "type-caption px-1.5 py-0.5" : "type-note gap-1.5 px-2 py-1",
        tone === "paper" ? "bg-muted text-muted-foreground" : "bg-white/18 text-primary-foreground",
        className,
      )}
    >
      {dotColor && (
        <span
          aria-hidden
          className="inline-block size-2 shrink-0 rounded-full border"
          style={{ backgroundColor: dotColor, borderColor: dotStroke ?? dotColor }}
        />
      )}
      {children}
    </span>
  );
}
