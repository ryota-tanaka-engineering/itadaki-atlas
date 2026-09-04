import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

import type { Chain } from "./queries";

/**
 * ジャンルページ「チェーンから、ご当地へ」セクション（チェーン橋渡し装置）。
 *
 * 誰もが知る全国チェーンを入口に「その味が好きなら、この系統・ご当地へ」と渡す
 * （North Star「広く」軸）。chains.genre_slug が一致するチェーンが無いジャンルでは
 * 呼び出し側が渡す chains が空配列になり、このコンポーネントは何も描画しない
 * （データ駆動。特定ジャンルのハードコード禁止）。
 *
 * チェーンのロゴ・画像は使わない（商標）。並びはデータの sort_order のまま
 * （ランキング表現禁止）。source_url / source_note は内部検証用のためここでは扱わない
 * （queries.ts の Chain 型に含めていない）。
 *
 * チェーン名は独立ページ（/chain/[slug]。検索流入起点。CLAUDE.md「意図的な制約」節とは
 * 別件、チェーン橋渡し・本場機構の追補）へのリンク。ここでは要約（bridge文+推薦リンク）
 * のまま残し、詳しい系統・創業の事実は遷移先で見せる。
 */
type Props = {
  heading: string;
  intro: string;
  chains: Chain[];
  locale: string;
};

export function ChainBridgeSection({ heading, intro, chains, locale }: Props) {
  if (chains.length === 0) return null;
  const isJa = locale === "ja";

  return (
    <section aria-labelledby="chain-bridge-heading" className="border-border mb-10 border-t pt-6">
      <h2 id="chain-bridge-heading" className="font-serif mb-2 text-lg">
        {heading}
      </h2>
      <p className="text-muted-foreground mb-4 text-sm">{intro}</p>

      <ul className="space-y-4">
        {chains.map((c) => (
          <li key={c.slug} className="border-border rounded-lg border p-4">
            <p className="font-medium">
              <Link href={`/chain/${c.slug}`} className="hover:underline">
                {isJa ? c.nameJa : c.nameEn}
              </Link>
            </p>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              {isJa ? c.bridgeJa : c.bridgeEn}
            </p>
            {c.recommendations.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {c.recommendations.map((r) => (
                  <li key={r.key}>
                    <Link
                      href={`/${r.genreSlug ?? r.shelfSlug}/${r.slug}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      {isJa ? r.nameJa : (r.nameEn ?? r.nameRomaji)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
