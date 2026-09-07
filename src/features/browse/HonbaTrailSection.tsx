import { Link } from "@/i18n/navigation";

/**
 * トップ「本場をたどる」（作業パッケージ「トップページ情報モジュール」§2）。
 *
 * food_item_regions（relation_type='本場'）を持つアイテムを、アイテムごとに
 * 「名前 + 本場の都市チップ列」で並べる。各都市の note（構造的理由の一文）は
 * ここでは出さない（詳細ページで読める。CLAUDE.md「詳細ページの確定構造」節）。
 * 現在は海鮮丼1件（釧路/小樽/函館/金沢）だが、food_item_regions に行を足すだけで
 * データ駆動で増える設計（ハードコードしない）。
 */
export type HonbaDisplayCity = {
  key: string;
  label: string;
  /** 都道府県マスタに無い値のときは null（リンクにせずテキストのみ出す）。 */
  prefSlug: string | null;
};

export type HonbaDisplayGroup = {
  slug: string;
  name: string;
  cities: HonbaDisplayCity[];
};

type Props = {
  heading: string;
  /** 「本場を持つ食べもの{count}件」のような、選定前の総数ラベル
   * （本番レビュー「本場を辿るはなんでこの仕分け？魚だけ？違和感しかない」対応。
   * groups は最大6件のローテーション選定後だが、見出し横には全体の総数を出す）。
   * 呼び出し側（BrowseShell）が翻訳・整形済みの文字列を渡す（他モジュールと同じ流儀）。 */
  countLabel: string;
  groups: HonbaDisplayGroup[];
};

export function HonbaTrailSection({ heading, countLabel, groups }: Props) {
  if (groups.length === 0) return null;

  return (
    <section aria-labelledby="honba-trail-heading" className="border-border mb-8 border-t pt-6">
      <h2 id="honba-trail-heading" className="font-serif mb-2 text-lg">
        {heading}
        <span className="text-muted-foreground ml-2 text-sm font-normal">{countLabel}</span>
      </h2>
      <ul className="space-y-3">
        {groups.map((g) => (
          <li key={g.slug}>
            <p className="text-sm font-medium">{g.name}</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {g.cities.map((c) => (
                <li key={c.key}>
                  {c.prefSlug ? (
                    <Link
                      href={`/region/${c.prefSlug}`}
                      className="border-border bg-background text-muted-foreground hover:bg-muted/60 rounded-full border px-2 py-0.5 text-xs transition-colors"
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span className="border-border bg-background text-muted-foreground rounded-full border px-2 py-0.5 text-xs">
                      {c.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
