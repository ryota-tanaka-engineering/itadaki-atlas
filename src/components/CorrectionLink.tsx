import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * 「内容の訂正を送る」導線（出典は UI 非表示。訂正の窓口だけを残す）。
 * 2026-09-30 デザイン刷新: 中央寄せの橙リンクをやめ、本文の終わりに左寄せ・サブ文字色で控えめに置く。
 */
export function CorrectionLink({ label, className }: { label: string; className?: string }) {
  return (
    <p className={cn("type-caption text-muted-foreground", className)}>
      <Link href="/contact" className="link-underline">
        {label}
      </Link>
    </p>
  );
}
