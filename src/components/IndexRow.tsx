import type { ComponentProps, ReactNode } from "react";

import { Link } from "@/i18n/navigation";

/**
 * 索引行（ジャンル・県・タグ・棚ページの一覧。2026-09-30 デザイン刷新）。
 *
 * 1行目: 名前（太）＋同じ行に薄く副名（ja=ローマ字 / en=日本語名）＋末尾に小さなラベル
 * 2行目: 英訳・説明訳（薄く。名前と重複するものは呼び出し側で `englishGloss` で落とす）
 * 3行目: 要約（2行まで）
 * 名称の三点セット（CLAUDE.md「名称表記」）は機能要件なので削らず、同じ名前を繰り返さない形で見せる。
 */
type Props = {
  href: ComponentProps<typeof Link>["href"];
  name: string;
  aside?: string | null;
  gloss?: string | null;
  summary?: string | null;
  /** 系統色などの丸（名前の左） */
  dot?: { color: string; stroke: string } | null;
  /** 行末の小さなラベル（LabelChip・県名等） */
  labels?: ReactNode;
  /** 本場の理由など、要約の下に添える注 */
  note?: string | null;
};

export function IndexRow({ href, name, aside, gloss, summary, dot, labels, note }: Props) {
  return (
    <Link
      href={href}
      className="group hover:bg-muted/45 -mx-3 block rounded-md px-3 py-3.5 transition-colors md:py-4"
    >
      <span className="flex items-start gap-3">
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          {dot && (
            <span
              aria-hidden
              className="inline-block size-2.5 shrink-0 -translate-y-px self-center rounded-full border"
              style={{ backgroundColor: dot.color, borderColor: dot.stroke }}
            />
          )}
          <span className="type-heading group-hover:text-brand-accent-dark transition-colors">{name}</span>
          {aside && <span className="type-note text-muted-foreground">{aside}</span>}
        </span>
        {labels && <span className="flex shrink-0 flex-wrap justify-end gap-1 pt-0.5">{labels}</span>}
      </span>
      {gloss && <span className="type-note text-muted-foreground mt-0.5 block">{gloss}</span>}
      {summary && <span className="type-small text-foreground/85 mt-1.5 line-clamp-2 block">{summary}</span>}
      {note && <span className="type-note text-muted-foreground mt-1 block whitespace-pre-line">{note}</span>}
    </Link>
  );
}
