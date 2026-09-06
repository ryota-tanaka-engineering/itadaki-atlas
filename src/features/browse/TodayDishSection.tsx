import { Link } from "@/i18n/navigation";

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
  item: BrowseItem;
  locale: Locale;
  originCaption: string;
  originLabel: string;
  detailLabel: string;
};

export function TodayDishSection({ heading, item, locale, originCaption, originLabel, detailLabel }: Props) {
  return (
    <section aria-labelledby="today-dish-heading" className="border-border mb-8 border-t pt-6">
      <h2 id="today-dish-heading" className="font-serif mb-2 text-lg">
        {heading}
      </h2>
      <div className="border-border bg-background rounded-2xl border p-3">
        <p className="font-medium">{locale === "ja" ? item.nameJa : item.nameRomaji}</p>
        {item.bodyExcerpt && (
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{item.bodyExcerpt}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="border-border bg-background text-muted-foreground rounded-full border px-2 py-0.5 text-xs">
            <span className="sr-only">{originCaption}: </span>
            {originLabel}
          </span>
          <Link href={`/${item.genreSlug ?? item.shelfSlug}/${item.slug}`} className="text-sm underline">
            {detailLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
