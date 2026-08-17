"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MapView } from "@/features/map/MapView";
import type { MapItem } from "@/features/map/queries";

import { BottomSheet, snapOffset, type Snap } from "./BottomSheet";
import { IndexList } from "./IndexList";
import type { Axis } from "./axes";

/**
 * 地図・ボトムシート・索引を束ねる層。
 *
 * 選択状態をここが持つことで、ピンタップと索引からの選択が同じ状態を共有し、
 * **ページ遷移なしで地図と詳細を往復できる**（.doc/30_features/02_ui_ux.md §2.2）。
 */
export function BrowseShell({ items }: { items: MapItem[] }) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snap>("peak");
  const [axis, setAxis] = useState<Axis>("kana");
  const [vh, setVh] = useState(0);

  useEffect(() => {
    const update = () => setVh(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const selected = useMemo(
    () => items.find((i) => i.slug === selectedSlug) ?? null,
    [items, selectedSlug],
  );

  // ピンをタップしたら、地図を隠さないピーク位置でカードを見せる
  const handleSelectFromMap = useCallback((slug: string | null) => {
    setSelectedSlug(slug);
    // 地図を隠さない位置に留める。full で開いていたら半分まで下げる。
    setSnap((prev) => (slug ? (prev === "full" ? "half" : "peak") : prev));
  }, []);

  // 索引から選んだときは地図を見せたいので半分まで下げる
  const handleSelectFromIndex = useCallback((slug: string) => {
    setSelectedSlug(slug);
    setSnap("half");
  }, []);

  // 地図を寄せる際の下端余白。シートに隠れない位置に選択地点を置く。
  const bottomInset = vh === 0 ? 0 : Math.max(0, vh - snapOffset(snap, vh));

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <MapView
        items={items}
        selectedSlug={selectedSlug}
        onSelect={handleSelectFromMap}
        bottomInset={bottomInset}
      />

      <BottomSheet
        snap={snap}
        onSnapChange={setSnap}
        labelledBy="sheet-heading"
        peak={
          selected ? (
            <div>
              <h2 id="sheet-heading" className="text-base font-semibold">
                {selected.nameJa}
              </h2>
              {/* 三点セット: 日本語名 — ローマ字 — 英訳（.doc/00_concept/05_brand.md §5） */}
              <p className="text-muted-foreground truncate text-sm">
                {selected.nameRomaji}
                {selected.nameEn ? ` — ${selected.nameEn}` : ""}
              </p>
            </div>
          ) : (
            <h2 id="sheet-heading" className="text-base font-semibold">
              索引
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                {items.length}件
              </span>
            </h2>
          )
        }
      >
        {selected ? (
          <div className="space-y-3">
            <dl className="text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-16 shrink-0">発祥</dt>
                <dd>
                  {selected.originPref ?? "—"}
                  {selected.originCity ?? ""}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-16 shrink-0">系統</dt>
                <dd>{selected.primaryStyle ?? "—"}</dd>
              </div>
            </dl>
            {selected.summary && <p className="text-sm leading-relaxed">{selected.summary}</p>}
            <button
              type="button"
              onClick={() => setSelectedSlug(null)}
              className="text-muted-foreground text-sm underline"
            >
              索引に戻る
            </button>
          </div>
        ) : (
          <IndexList
            items={items}
            axis={axis}
            onAxisChange={setAxis}
            selectedSlug={selectedSlug}
            onSelect={handleSelectFromIndex}
          />
        )}
      </BottomSheet>
    </div>
  );
}
