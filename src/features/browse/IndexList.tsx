"use client";

import { useTranslations } from "next-intl";

import type { MapItem } from "@/features/map/queries";
import { PIN_STROKE, styleColor } from "@/features/map/styles";
import { useMasterLabels } from "@/features/map/labels";

import { AXES, groupBy, type Axis } from "./axes";

/**
 * 索引（.doc/30_features/01_requirements.md F-03）。
 *
 * 地図と**対等なビュー**として同一データから生成する。地図を使わずに
 * 全アイテムへ到達できることが完了条件であり、スクリーンリーダー向けの
 * 主要動線でもある（F-07）。
 */
type Props = {
  items: MapItem[];
  axis: Axis;
  onAxisChange: (axis: Axis) => void;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
};

export function IndexList({ items, axis, onAxisChange, selectedSlug, onSelect }: Props) {
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
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              a === axis
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {t(`axis.${a}`)}
          </button>
        ))}
      </div>

      {groups.map((group) => (
        <section key={group.key} className="mb-4">
          <h3 className="text-muted-foreground bg-background sticky top-0 py-1 text-xs font-semibold">
            {group.label}
            <span className="ml-2 font-normal">{group.items.length}</span>
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
                    <span className="block truncate text-sm">{item.nameJa}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {item.nameRomaji}
                      {item.originPref ? ` ／ ${label.prefecture(item.originPref)}` : ""}
                      {/* 色だけに依存させないため系統名をテキストでも出す */}
                      {item.primaryStyle ? ` ／ ${label.style(item.primaryStyle)}` : ""}
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
