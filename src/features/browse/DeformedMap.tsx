"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { MapItem } from "@/features/map/queries";
import { PIN_STROKE, PRIMARY_STYLES, styleColor } from "@/features/map/styles";

import { GRID, GRID_COLS, GRID_ROWS } from "./gridLayout";

/**
 * ディフォルメ地図（.doc/30_features/02_ui_ux.md §3）。
 *
 * MapLibre もタイルも使わない **ただのSVG**。地図ライブラリとは無関係な
 * 通常のフロント実装として扱う。
 *
 * 目的は「どの県に何個あるか」の一覧性であって、地理的な正確さではない。
 *
 * **優劣を示す地図にしない。** セルを単一の系統色で塗ると「この県は◯◯系」という
 * 事実でない断定になる（北海道は味噌・醤油・塩が併存する）。
 * セルが持つ情報は件数であり、系統は「存在するもの」を並置するに留める
 * （.doc/00_concept/05_brand.md §4.1）。
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
          // 塗りは中立。件数の多寡も色の強弱で表さない（多い＝良いではないため）
          const fill = has ? "#fffdf7" : "#f6efe0";
          // その県に存在する系統を重複なく並べる。順序は PRIMARY_STYLES 固定
          const styles = PRIMARY_STYLES.filter((st) =>
            list.some((i) => i.primaryStyle === st),
          );
          const x = cell.col * (CELL + GAP);
          const y = cell.row * (CELL + GAP);

          return (
            <g
              key={cell.pref}
              role="button"
              tabIndex={has ? 0 : -1}
              aria-label={
                has
                  ? `${cell.pref} ${count}件（${styles.join("・")}）。選ぶと地図を拡大します`
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
                stroke={has ? PIN_STROKE : "#e3d9c8"}
                strokeWidth={has ? 1.5 : 1}
              />
              <text
                x={x + CELL / 2}
                y={y + CELL / 2 - 3}
                textAnchor="middle"
                className="pointer-events-none select-none"
                fontSize={cell.short.length > 3 ? 8 : 10}
                fill={has ? "#5b4a37" : "#7a6a58"}
              >
                {cell.short}
              </text>
              {has && (
                <>
                  <text
                    x={x + CELL / 2}
                    y={y + CELL / 2 + 10}
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                    fontSize={13}
                    fontWeight={600}
                    fill="#5b4a37"
                  >
                    {count}
                  </text>
                  {/* その県に存在する系統。優劣ではなく並置 */}
                  {styles.map((st, i) => (
                    <circle
                      key={st}
                      cx={x + CELL / 2 - ((styles.length - 1) * 7) / 2 + i * 7}
                      cy={y + CELL - 8}
                      r={2.5}
                      fill={styleColor(st)}
                      stroke={PIN_STROKE}
                      strokeWidth={0.5}
                    />
                  ))}
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
