import { cn } from "@/lib/utils";

/**
 * 一覧系ページのカバー（棚・ジャンル・地域・タグ・ガイド・チェーン共通）。
 *
 * 2026-09-30 デザイン刷新: 塗りつぶした橙の箱をやめ、紙の上に
 * 「小さな眉（eyebrow）＋大きな明朝の題名＋一行の meta」を置き、左の橙の太い縦罫で締める。
 * 橙の塗り（白文字）のヒーローは詳細ページ（[genre]/[slug]）だけが持つ
 * （CLAUDE.md「デザイン」節「画面の層」）。一覧は紙の上で見出しとして読ませる。
 */
type Props = {
  /** 題名の上の小さい先頭行（棚名・種別。例: 「麺」「チェーン」「支払い」） */
  eyebrow?: string | null;
  title: string;
  /** 題名の右（PC）/ 下（SP）に添える副題（例: 英名・ローマ字） */
  subtitle?: string | null;
  /** 題名の下の一行（件数・説明） */
  meta?: string | null;
  className?: string;
};

export function CoverHeader({ eyebrow, title, subtitle, meta, className }: Props) {
  return (
    <header className={cn("border-rule border-b pb-6 md:pb-8", className)}>
      <div className="border-primary border-l-4 pl-4 md:pl-6">
        {eyebrow && <p className="type-eyebrow mb-2">{eyebrow}</p>}
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="type-display text-foreground">{title}</h1>
          {subtitle && <p className="type-small text-muted-foreground">{subtitle}</p>}
        </div>
        {meta && <p className="type-small text-muted-foreground mt-2 max-w-prose">{meta}</p>}
      </div>
    </header>
  );
}
