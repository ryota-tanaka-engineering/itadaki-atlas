import { RowList } from "@/components/RowList";
import { SectionHeading } from "@/components/SectionHeading";
import { ArrowLink, LinkCloud } from "@/components/ui/text-link";

import type { ConnectionCard } from "./ItemConnections";

/**
 * チェーン独立ページ（/chain/[slug]）の本文セクション群。
 *
 * bridge文（橋渡しの一文）を主役に、系統・創業の事実を添え、「この味が好きなら」で
 * ご当地詳細ページへ、末尾で同ジャンルの他チェーンへ回遊させる（行き止まり禁止）。
 * データの組み立て（訳語・href）は呼び出し側（page.tsx）が済ませ、このコンポーネントは
 * 表示専用に留める（ItemConnections / ChainBridgeSection と同じ方針）。
 */
export type OtherChain = { slug: string; name: string };

type Props = {
  bridge: string;
  style: string | null;
  styleLabel: string;
  /** 創業の事実（founded_note）。日本語のみのカラムのため、呼び出し側が ja のみで渡す想定。 */
  founded: string | null;
  foundedLabel: string;
  /** 地域限定チェーンの表示（例: 「静岡県の地域限定」）。全国展開なら null。 */
  prefLimited?: string | null;
  prefLimitedLabel?: string;
  recommendHeading: string;
  recommendItems: ConnectionCard[];
  otherChainsHeading: string;
  otherChains: OtherChain[];
  genreHref: string | null;
  genreLinkLabel: string | null;
};

export function ChainDetailBody({
  bridge,
  style,
  styleLabel,
  founded,
  foundedLabel,
  prefLimited,
  prefLimitedLabel,
  recommendHeading,
  recommendItems,
  otherChainsHeading,
  otherChains,
  genreHref,
  genreLinkLabel,
}: Props) {
  return (
    <div>
      {/* bridge文（橋渡しの一文）が主役。明朝の引き文として大きく置く */}
      <p className="type-title text-foreground mb-stack max-w-prose">{bridge}</p>

      {(style || founded || prefLimited) && (
        <dl className="border-rule divide-rule mb-section divide-y border-y">
          {style && (
            <div className="flex gap-4 py-2.5">
              <dt className="type-label w-16 shrink-0 pt-0.5">{styleLabel}</dt>
              <dd className="type-small">{style}</dd>
            </div>
          )}
          {founded && (
            <div className="flex gap-4 py-2.5">
              <dt className="type-label w-16 shrink-0 pt-0.5">{foundedLabel}</dt>
              <dd className="type-small">{founded}</dd>
            </div>
          )}
          {prefLimited && (
            <div className="flex gap-4 py-2.5">
              <dt className="type-label w-16 shrink-0 pt-0.5">{prefLimitedLabel}</dt>
              <dd className="type-small">{prefLimited}</dd>
            </div>
          )}
        </dl>
      )}

      {/* 「この味が好きなら」＝ご当地へ進む入口。カード枠は1つにまとめ、中は罫線区切りの行 */}
      {recommendItems.length > 0 && (
        <section
          aria-labelledby="chain-recommend-heading"
          className="border-rule mb-stack rounded-xl border px-4 pt-4 pb-1 md:px-5"
        >
          <SectionHeading id="chain-recommend-heading" variant="label" className="mb-1">
            {recommendHeading}
          </SectionHeading>
          <RowList
            rows={recommendItems.map((c) => ({ key: c.key, href: c.href, title: c.name, meta: c.meta }))}
          />
        </section>
      )}

      {genreHref && genreLinkLabel && (
        <p className="mb-section">
          <ArrowLink href={genreHref}>{genreLinkLabel}</ArrowLink>
        </p>
      )}

      {otherChains.length > 0 && (
        <section className="border-rule mb-stack border-t pt-stack">
          <SectionHeading variant="label">{otherChainsHeading}</SectionHeading>
          <LinkCloud
            items={otherChains.map((c) => ({ key: c.slug, href: `/chain/${c.slug}`, label: c.name }))}
          />
        </section>
      )}
    </div>
  );
}
