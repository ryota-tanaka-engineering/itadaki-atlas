import { Link } from "@/i18n/navigation";

import type { BrowseItem, Locale } from "@/features/map/queries";

/**
 * トップ「土地の物語から」（作業パッケージ「トップページ情報モジュール」§4）。
 *
 * 本文を持つアイテムから、日付オフセットの順繰り（dailyPicks.ts）で3件を出す。
 * 各カードは3章目「なぜこの形になったのか」の冒頭1文（bodyExcerptCh3）を見せる
 * （1章目は「今日の一皿」が使うため、ここは章を変えて重複を避ける）。
 */
type Props = {
  heading: string;
  /** bodyExcerptCh3 は BrowseItem には無い（RSCペイロード削減）ため、選定後に
   * サーバー側（page.tsx）が fetchItemExcerpts で合流させたものを渡す。 */
  items: (BrowseItem & { bodyExcerptCh3: string | null })[];
  locale: Locale;
  detailLabel: string;
};

export function LandStoriesSection({ heading, items, locale, detailLabel }: Props) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="land-stories-heading" className="border-border mb-8 border-t pt-6">
      <h2 id="land-stories-heading" className="font-serif mb-2 text-lg">
        {heading}
      </h2>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.slug} className="border-border bg-background rounded-2xl border p-3">
            <p className="font-medium">{locale === "ja" ? item.nameJa : item.nameRomaji}</p>
            {item.bodyExcerptCh3 && (
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{item.bodyExcerptCh3}</p>
            )}
            <Link
              href={`/${item.genreSlug ?? item.shelfSlug}/${item.slug}`}
              className="mt-2 inline-block text-sm underline"
            >
              {detailLabel}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
