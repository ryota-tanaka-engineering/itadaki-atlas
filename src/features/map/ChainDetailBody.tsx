import { Link } from "@/i18n/navigation";

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
  recommendHeading,
  recommendItems,
  otherChainsHeading,
  otherChains,
  genreHref,
  genreLinkLabel,
}: Props) {
  return (
    <div>
      <p className="mb-6 leading-relaxed">{bridge}</p>

      {(style || founded) && (
        <dl className="mb-8 text-sm">
          {style && (
            <div className="flex gap-3 py-1">
              <dt className="text-muted-foreground w-20 shrink-0">{styleLabel}</dt>
              <dd>{style}</dd>
            </div>
          )}
          {founded && (
            <div className="flex gap-3 py-1">
              <dt className="text-muted-foreground w-20 shrink-0">{foundedLabel}</dt>
              <dd>{founded}</dd>
            </div>
          )}
        </dl>
      )}

      {recommendItems.length > 0 && (
        <section aria-labelledby="chain-recommend-heading" className="mb-8">
          <h2 id="chain-recommend-heading" className="mb-3 text-sm font-semibold">
            {recommendHeading}
          </h2>
          <ul className="space-y-2">
            {recommendItems.map((c) => (
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
        </section>
      )}

      {genreHref && genreLinkLabel && (
        <p className="mb-8">
          <Link href={genreHref} className="text-brand-accent-dark text-sm underline">
            {genreLinkLabel}
          </Link>
        </p>
      )}

      {otherChains.length > 0 && (
        <section className="border-border mb-8 border-t pt-6">
          <h2 className="mb-3 text-sm font-semibold">{otherChainsHeading}</h2>
          <ul className="flex flex-wrap gap-2">
            {otherChains.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/chain/${c.slug}`}
                  className="bg-muted text-muted-foreground hover:bg-muted/70 inline-block rounded-full px-3 py-1 text-xs"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
