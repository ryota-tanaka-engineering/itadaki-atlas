"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { MapItem } from "@/features/map/queries";
import { PIN_STROKE, styleColor } from "@/features/map/styles";

import { GRID, GRID_COLS, GRID_ROWS } from "./gridLayout";

/**
 * ディフォルメ地図（.doc/30_features/02_ui_ux.md §3）。
 *
 * MapLibre もタイルも使わない **ただのSVG**。地図ライブラリとは無関係な
 * 通常のフロント実装として扱う。
 *
 * 目的は「どの県に何個あるか」の一覧性であって、地理的な正確さではない。
 */
const CELL = 46;
const GAP = 4;

type Props = {
  items: MapItem[];
  onSelectPrefecture: (pref: string) => void;
  /** ボトムシートに隠れないための下端余白（px） */
  bottomInset: number;
};

export function DeformedMap({ items, onSelectPrefecture, bottomInset }: Props) {
  const t = useTranslations("browse");
  const byPref = useMemo(() => {
    const m = new Map<string, MapItem[]>();
    for (const item of items) {
      if (!item.originPref) continue;
      const list = m.get(item.originPref) ?? [];
      list.push(item);
      m.set(item.originPref, list);
    }
    return m;
  }, [items]);

  const width = GRID_COLS * (CELL + GAP);
  const height = GRID_ROWS * (CELL + GAP);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center p-4"
      style={{ paddingBottom: bottomInset + 16 }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full max-h-full w-full max-w-full"
        role="group"
        aria-label={t("deformedLabel")}
      >
        {GRID.map((cell) => {
          const list = byPref.get(cell.pref) ?? [];
          const count = list.length;
          const has = count > 0;
          // 掲載がある県は代表系統の色で塗る。無い県は淡いグレー。
          const fill = has ? styleColor(list[0]?.primaryStyle) : "#eeeeee";
          const x = cell.col * (CELL + GAP);
          const y = cell.row * (CELL + GAP);

          return (
            <g
              key={cell.pref}
              role="button"
              tabIndex={has ? 0 : -1}
              aria-label={
                has
                  ? `${cell.pref} ${count}件。選ぶと地図を拡大します`
                  : `${cell.pref} 掲載なし`
              }
              aria-disabled={has ? undefined : true}
              className={has ? "cursor-pointer" : ""}
              onClick={has ? () => onSelectPrefecture(cell.pref) : undefined}
              onKeyDown={
                has
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectPrefecture(cell.pref);
                      }
                    }
                  : undefined
              }
            >
              <rect
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={6}
                fill={fill}
                stroke={has ? PIN_STROKE : "#dddddd"}
                strokeWidth={has ? 1.5 : 1}
              />
              <text
                x={x + CELL / 2}
                y={y + CELL / 2 - 3}
                textAnchor="middle"
                className="pointer-events-none select-none"
                fontSize={cell.short.length > 3 ? 8 : 10}
                fill={has ? "#2b2118" : "#999999"}
              >
                {cell.short}
              </text>
              {/* 件数は色に依存させないための併記でもある */}
              {has && (
                <text
                  x={x + CELL / 2}
                  y={y + CELL / 2 + 12}
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                  fontSize={12}
                  fontWeight={700}
                  fill="#2b2118"
                >
                  {count}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
