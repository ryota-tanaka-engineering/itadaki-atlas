import { Link } from "@/i18n/navigation";
import { RowList } from "@/components/RowList";
import { ArrowLink } from "@/components/ui/text-link";

import { GROUP_COLORS } from "./styles";

/**
 * 詳細ページ「つながり」= 2軸の分岐点（CLAUDE.md「詳細ページの確定構造」4節）。
 *
 * ページの主役なので最下部の小リンク集にしない。データの組み立て（訳語・href）は
 * 呼び出し側（page.tsx）が済ませ、このコンポーネントは表示専用に留める
 * （SP本文内 / PCサイドバーの2箇所で描画される想定 — 詳細は ItemBody.tsx 参照）。
 *
 * 2026-09-30 デザイン刷新: 項目ごとのカード枠をやめ、罫線で区切った「名前＋一行」の行にする。
 * 関係ラベル（対比／派生／源流／同じ○○県）は項目ごとに繰り返さず、同じラベルの項目を
 * 1つの小見出し（濃橙の眉）の下にまとめる。並びは各ラベルが最初に現れた順を保つ。
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

/** 同じ badge を持つカードを、最初に現れた順を保ってまとめる。badge なしは1群。 */
function groupByBadge(cards: ConnectionCard[]): { badge: string | null; cards: ConnectionCard[] }[] {
  const groups: { badge: string | null; cards: ConnectionCard[] }[] = [];
  for (const card of cards) {
    const badge = card.badge ?? null;
    const found = groups.find((g) => g.badge === badge);
    if (found) found.cards.push(card);
    else groups.push({ badge, cards: [card] });
  }
  return groups;
}

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

  const landGroups = groupByBadge(landItems);

  return (
    <div className={className}>
      {hasStyleAxis && (
        <section aria-labelledby="connections-style-heading" className="mb-section">
          <h2
            id="connections-style-heading"
            className="type-small border-rule-strong mb-1 flex items-center gap-2 border-b pb-2 font-semibold"
          >
            {/* 2026-09「丸だけで色分け」決定: 料理側（同じ系統を、もっと）は橙 */}
            <span aria-hidden className="text-xs" style={{ color: GROUP_COLORS.dish }}>
              ●
            </span>
            {styleTitle}
          </h2>
          <RowList
            rows={styleSiblings.map((c) => ({ key: c.key, href: c.href, title: c.name, meta: c.meta }))}
          />
          {viewAllHref && viewAllLabel && (
            <p className="mt-3">
              <ArrowLink href={viewAllHref}>{viewAllLabel}</ArrowLink>
            </p>
          )}
        </section>
      )}

      {hasLandAxis && (
        <section aria-labelledby="connections-land-heading">
          <h2
            id="connections-land-heading"
            className="type-small border-rule-strong mb-1 flex items-center gap-2 border-b pb-2 font-semibold"
          >
            {/* 2026-09「丸だけで色分け」決定: 食材側（この土地と、この素材）は濃 */}
            <span aria-hidden className="text-xs" style={{ color: GROUP_COLORS.ingredient }}>
              ●
            </span>
            {landTitle}
          </h2>

          {regions.length > 0 && regionsTitle && (
            <div className="mt-3 mb-4">
              <h3 className="type-eyebrow mb-1">{regionsTitle}</h3>
              <ul className="divide-rule divide-y">
                {regions.map((r) => (
                  <li key={r.key} className="py-2">
                    <Link href={r.href} className="group type-small inline-flex items-baseline gap-1.5 font-semibold">
                      <span className="link-underline">{r.label}</span>
                      <span aria-hidden className="text-primary">
                        →
                      </span>
                    </Link>
                    {/* 本場（「どこでも食べられるが、ここのは特別」）の構造的理由。データが入れば自動で現れる */}
                    {r.note && <p className="type-note text-muted-foreground mt-0.5">{r.note}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {landGroups.map((group) => (
            <div key={group.badge ?? "-"} className="mt-3">
              {group.badge && <h3 className="type-eyebrow mb-0.5">{group.badge}</h3>}
              <RowList
                metaLines={1}
                rows={group.cards.map((c) => ({ key: c.key, href: c.href, title: c.name, meta: c.meta }))}
              />
            </div>
          ))}

          {regionPageHref && regionPageLabel && (
            <p className="mt-3">
              <ArrowLink href={regionPageHref}>{regionPageLabel}</ArrowLink>
            </p>
          )}
        </section>
      )}
    </div>
  );
}
