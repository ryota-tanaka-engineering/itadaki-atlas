import { Link } from "@/i18n/navigation";

/**
 * 詳細ページ「つながり」= 2軸の分岐点（CLAUDE.md「詳細ページの確定構造」4節）。
 *
 * ページの主役なので最下部の小リンク集にしない。データの組み立て（訳語・href）は
 * 呼び出し側（page.tsx）が済ませ、このコンポーネントは表示専用に留める
 * （SP本文内 / PCサイドバーの2箇所で描画される想定 — 詳細は ItemBody.tsx 参照）。
 */
export type ConnectionCard = {
  key: string;
  href: string;
  name: string;
  /** カードの上に小さく出す文脈（関係ラベル・「同じ○○県」等） */
  badge?: string;
  /** カードの下に小さく出す補足（要約の抜粋） */
  meta?: string;
};

export type RegionPill = {
  key: string;
  href: string;
  label: string;
  /** 本場（relationType='本場'）の「構造的理由の一文」。あれば pill の下に添える。 */
  note?: string | null;
};

type Props = {
  styleTitle: string;
  styleSiblings: ConnectionCard[];
  viewAllHref: string | null;
  viewAllLabel: string | null;

  landTitle: string;
  regionsTitle: string | null;
  regions: RegionPill[];
  landItems: ConnectionCard[];
  regionPageHref: string | null;
  regionPageLabel: string | null;

  className?: string;
};

export function ItemConnections({
  styleTitle,
  styleSiblings,
  viewAllHref,
  viewAllLabel,
  landTitle,
  regionsTitle,
  regions,
  landItems,
  regionPageHref,
  regionPageLabel,
  className,
}: Props) {
  const hasStyleAxis = styleSiblings.length > 0 || viewAllHref;
  const hasLandAxis = regions.length > 0 || landItems.length > 0 || regionPageHref;
  if (!hasStyleAxis && !hasLandAxis) return null;

  return (
    <div className={className}>
      {hasStyleAxis && (
        <section aria-labelledby="connections-style-heading" className="mb-8">
          <h2
            id="connections-style-heading"
            className="mb-3 flex items-center gap-2 text-sm font-semibold"
          >
            <span aria-hidden className="text-primary">
              ●
            </span>
            {styleTitle}
          </h2>
          {styleSiblings.length > 0 && (
            <ul className="space-y-2">
              {styleSiblings.map((c) => (
                <li key={c.key}>
                  <Link
                    href={c.href}
                    className="border-border hover:bg-muted/50 block rounded-lg border p-3"
                  >
                    <span className="block font-medium">{c.name}</span>
                    {c.meta && <span className="text-muted-foreground block text-xs">{c.meta}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {viewAllHref && viewAllLabel && (
            <p className="mt-2">
              <Link href={viewAllHref} className="text-brand-accent-dark text-sm underline">
                {viewAllLabel}
              </Link>
            </p>
          )}
        </section>
      )}

      {hasLandAxis && (
        <section aria-labelledby="connections-land-heading">
          <h2
            id="connections-land-heading"
            className="mb-3 flex items-center gap-2 text-sm font-semibold"
          >
            <span aria-hidden className="text-primary">
              ■
            </span>
            {landTitle}
          </h2>

          {regions.length > 0 && regionsTitle && (
            <div className="mb-3">
              <h3 className="text-muted-foreground mb-1.5 text-xs font-semibold">{regionsTitle}</h3>
              <ul className="flex flex-wrap gap-2">
                {regions.map((r) => (
                  <li key={r.key}>
                    <Link
                      href={r.href}
                      className="bg-muted hover:bg-muted/70 inline-block rounded-full px-3 py-1 text-xs"
                    >
                      {r.label}
                    </Link>
                  </li>
                ))}
              </ul>
              {/* 本場（「どこでも食べられるが、ここのは特別」）の構造的理由。データが入れば自動で現れる */}
              {regions.some((r) => r.note) && (
                <ul className="mt-1.5 space-y-1">
                  {regions
                    .filter((r) => r.note)
                    .map((r) => (
                      <li key={`note-${r.key}`} className="text-muted-foreground text-xs">
                        {r.note}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}

          {landItems.length > 0 && (
            <ul className="space-y-2">
              {landItems.map((c) => (
                <li key={c.key}>
                  <Link
                    href={c.href}
                    className="border-border hover:bg-muted/50 block rounded-lg border p-3"
                  >
                    {c.badge && <span className="text-muted-foreground block text-xs">{c.badge}</span>}
                    <span className="block font-medium">{c.name}</span>
                    {c.meta && <span className="text-muted-foreground block text-xs">{c.meta}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {regionPageHref && regionPageLabel && (
            <p className="mt-2">
              <Link href={regionPageHref} className="text-brand-accent-dark text-sm underline">
                {regionPageLabel}
              </Link>
            </p>
          )}
        </section>
      )}
    </div>
  );
}
