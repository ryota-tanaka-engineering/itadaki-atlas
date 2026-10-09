"use client";

import { useTranslations } from "next-intl";

import type { BrowseItem, Locale } from "@/features/map/queries";
import { PIN_STROKE, styleColor } from "@/features/map/styles";
import { useMasterLabels } from "@/features/map/labels";
import { filterChipClass } from "@/components/ui/chip";

import { englishGloss, joinDistinct } from "@/lib/names";

import { AXES, groupBy, kanaRomajiLabel, NO_REGION_KEY, type Axis, type Group } from "./axes";

/**
 * グループ見出しの表示文字列（作業パッケージ「トップページ情報モジュール」
 * 「あわせて直す /en の残り」節）。
 *
 * groupBy() が返す group.key/label は日本語（五十音の行・都道府県名・系統名）が
 * そのまま入っている。ja はこれまで通り group.label を使う（現状維持）。
 * en は軸ごとに翻訳する: 五十音行→ローマ字頭文字、地域→prefecture辞書、
 * 系統→style辞書（既存の browse.styleUnknown 等を流用）。
 */
function groupLabel(
  group: Group,
  axis: Axis,
  locale: Locale,
  label: ReturnType<typeof useMasterLabels>,
  t: ReturnType<typeof useTranslations>,
): string {
  // 「その他」は群ごとに言い分ける（ラーメン以外が混ざる群は汎用の語。labels.ts 参照）
  const otherGenre = group.items.every((i) => i.genreSlug === "ramen")
    ? "ramen"
    : (group.items.find((i) => i.genreSlug !== "ramen")?.genreSlug ?? null);
  if (axis === "style" && group.key === "その他") return label.style(group.key, otherGenre) ?? group.key;
  if (locale === "ja") return group.label;
  if (axis === "kana") return kanaRomajiLabel(group.key) ?? t("kanaOther");
  if (axis === "region") {
    if (group.key === NO_REGION_KEY) return t("regionUnknown");
    return label.prefecture(group.key) ?? group.key;
  }
  // style
  if (group.key === "系統不明") return t("styleUnknown");
  return label.style(group.key) ?? group.key;
}

/**
 * 索引（.doc/30_features/01_requirements.md F-03）。
 *
 * 地図と**対等なビュー**として同一データから生成する。地図を使わずに
 * 全アイテムへ到達できることが完了条件であり、スクリーンリーダー向けの
 * 主要動線でもある（F-07）。
 */
type Props = {
  items: BrowseItem[];
  axis: Axis;
  onAxisChange: (axis: Axis) => void;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  /** /en では各行をローマ字主導にする（ja=日本語名先頭は維持。作業パッケージ「トップページ改善」A節）。 */
  locale: Locale;
};

export function IndexList({ items, axis, onAxisChange, selectedSlug, onSelect, locale }: Props) {
  const t = useTranslations("browse");
  const label = useMasterLabels();
  const groups = groupBy(items, axis);

  return (
    <div>
      {/* 軸の切り替え。使われない軸は削る判断材料にするため計測対象
          （.doc/20_data/03_log_design.md の index_axis_change） */}
      <div role="tablist" aria-label={t("axisLabel")} className="mb-3 flex gap-1">
        {AXES.map((a) => (
          <button
            key={a}
            role="tab"
            type="button"
            aria-selected={a === axis}
            onClick={() => onAxisChange(a)}
            className={filterChipClass({ active: a === axis, size: "sm" })}
          >
            {t(`axis.${a}`)}
          </button>
        ))}
      </div>

      {groups.map((group) => (
        <section key={group.key} className="mb-4">
          <h3 className="type-label border-rule bg-background sticky top-0 border-b py-1.5">
            {groupLabel(group, axis, locale, label, t)}
            <span className="ml-2 font-normal tabular-nums">{group.items.length}</span>
          </h3>
          <ul>
            {group.items.map((item) => (
              <li key={item.slug}>
                <button
                  type="button"
                  onClick={() => onSelect(item.slug)}
                  aria-current={item.slug === selectedSlug ? "true" : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
                    item.slug === selectedSlug ? "bg-muted" : "hover:bg-muted/60"
                  }`}
                >
                  <span
                    aria-hidden
                    className="inline-block size-3 shrink-0 rounded-full border"
                    style={{
                      backgroundColor: styleColor(item.primaryStyle),
                      borderColor: PIN_STROKE,
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    {/* ja=日本語名先頭、en=ローマ字主導（三点セットの残りを副題に）。
                        作業パッケージ「トップページ改善」A節。 */}
                    <span className="block truncate text-sm">
                      {locale === "ja" ? item.nameJa : item.nameRomaji}
                    </span>
                    {/* 副行: 名前の別表記・県・系統を中黒でつなぎ、同じ名前の重複は消す
                        （2026-09-30 デザイン刷新「索引行の三点セットが冗長」）。
                        色だけに依存させないため系統名をテキストでも出す */}
                    <span className="type-caption text-muted-foreground block truncate">
                      {joinDistinct([
                        locale === "ja" ? item.nameRomaji : englishGloss(item.nameEn, item.nameRomaji),
                        item.originPref ? label.prefecture(item.originPref) : null,
                        item.primaryStyle ? label.style(item.primaryStyle, item.genreSlug) : null,
                      ])}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
