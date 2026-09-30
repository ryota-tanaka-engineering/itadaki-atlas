import { LabelChip } from "@/components/ui/chip";
import { ArrowLink } from "@/components/ui/text-link";

import type { BrowseItem, Locale } from "@/features/map/queries";

/**
 * トップ「今日の一皿」（作業パッケージ「トップページ情報モジュール」§1）。
 *
 * 本文を持つ全アイテムから、日付で決まる順繰り（dailyPicks.ts）で1件を出す。
 * ランキング・「おすすめ」ではない中立な導線であり、そう読めない文言にする
 * （CLAUDE.md「規律」節）。
 *
 * 見出し・本文はすべて呼び出し側（BrowseShell）が翻訳・整形済みの文字列を渡す
 * （ChainBridgeSection と同じ流儀。next-intl の useTranslations はここでは呼ばない）。
 */
type Props = {
  heading: string;
  /** bodyExcerpt は BrowseItem には無い（RSCペイロード削減。queries.ts の BrowseItem
   * docコメント参照）ため、選定後にサーバー側（page.tsx）が fetchItemExcerpts で
   * 1件分だけ合流させたものを渡す。 */
  item: BrowseItem & { bodyExcerpt: string | null };
  locale: Locale;
  originCaption: string;
  originLabel: string;
  detailLabel: string;
};

export function TodayDishSection({ heading, item, locale, originCaption, originLabel, detailLabel }: Props) {
  return (
    <section aria-labelledby="today-dish-heading" className="border-rule mb-stack border-t pt-stack">
      <h2 id="today-dish-heading" className="type-title mb-3">
        {heading}
      </h2>
      <div className="border-primary border-l-[3px] pl-3">
        <p className="type-heading">{locale === "ja" ? item.nameJa : item.nameRomaji}</p>
        {item.bodyExcerpt && <p className="type-small text-muted-foreground mt-1">{item.bodyExcerpt}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <LabelChip>
            <span className="sr-only">{originCaption}: </span>
            {originLabel}
          </LabelChip>
          <ArrowLink href={`/${item.genreSlug ?? item.shelfSlug}/${item.slug}`}>{detailLabel}</ArrowLink>
        </div>
      </div>
    </section>
  );
}
