import { cn } from "@/lib/utils";

/**
 * 橙カバー（棚・ジャンル・地域・タグページ共通の一等地）。
 *
 * 詳細ページ（src/app/[locale]/[genre]/[slug]/page.tsx）のカバー実装語彙
 * （bg-primary・text-primary-foreground・#ffe9cf のクリーム系・明朝見出し）を
 * そのまま流用し、ページ間で意匠がぶれないようにする。
 */
type Props = {
  /** カバー上の小さい先頭行（パンくず的表記。例: 「麺」「福岡県 — Fukuoka」） */
  eyebrow?: string | null;
  title: string;
  /** タイトル直下の副題（例: 英名・ローマ字） */
  subtitle?: string | null;
  /** 副題の下に添える一言・件数（例: 「土地で生まれたもの」「12件」） */
  meta?: string | null;
  className?: string;
};

export function CoverHeader({ eyebrow, title, subtitle, meta, className }: Props) {
  return (
    <div className={cn("bg-primary md:rounded-2xl md:p-10", className)}>
      <div className="text-primary-foreground px-4 py-8 md:px-0 md:py-0">
        {eyebrow && (
          <p className="text-xs" style={{ color: "#ffe9cf" }}>
            {eyebrow}
          </p>
        )}
        <h1 className="font-serif mt-3 text-3xl md:text-4xl">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-base" style={{ color: "#ffe9cf" }}>
            {subtitle}
          </p>
        )}
        {meta && (
          <p className="mt-2 text-sm" style={{ color: "#ffe9cf" }}>
            {meta}
          </p>
        )}
      </div>
    </div>
  );
}
