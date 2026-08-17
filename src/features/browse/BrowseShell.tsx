"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MapView } from "@/features/map/MapView";
import type { MapItem } from "@/features/map/queries";

import { BottomSheet, snapOffset, type Snap } from "./BottomSheet";
import { DeformedMap } from "./DeformedMap";
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
  // 全国俯瞰ではディフォルメ地図、県を選ぶと実座標地図に切り替える
  // （.doc/30_features/02_ui_ux.md §3）。
  // 地図のズーム値を観測して自動判定する設計は、初期カメラ設定でイベントが
  // 発火しない・アニメーション中の値が読めない等で不安定だったため、
  // **ユーザーの明示的な操作で切り替える**方式にした。
  const [view, setView] = useState<"deformed" | "geographic">("deformed");
  // 同じ県を続けて選んでも寄せ直せるよう、連番を添えて識別する
  // （値が同じだと state が変わらず effect が再実行されないため）
  const [focus, setFocus] = useState<{ pref: string; seq: number } | null>(null);

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

  const handleSelectPrefecture = useCallback((pref: string) => {
    setFocus((prev) => ({ pref, seq: (prev?.seq ?? 0) + 1 }));
    setView("geographic");
  }, []);

  // 地図を寄せる際の下端余白。シートに隠れない位置に選択地点を置く。
  const bottomInset = vh === 0 ? 0 : Math.max(0, vh - snapOffset(snap, vh));

  const showDeformed = view === "deformed";

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <MapView
        items={items}
        selectedSlug={selectedSlug}
        onSelect={handleSelectFromMap}
        bottomInset={bottomInset}
        focus={focus}
      />

      {/* 実座標地図は生かしたまま上に被せる。切り替えで地図を作り直さない。 */}
      {showDeformed && (
        <div className="bg-background/95 absolute inset-0 z-10 backdrop-blur-[1px]">
          <DeformedMap
            items={items}
            onSelectPrefecture={handleSelectPrefecture}
            bottomInset={bottomInset}
          />
          <p className="text-muted-foreground pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs">
            県を選ぶと、その範囲の実際の地図に切り替わります
          </p>
        </div>
      )}

      {!showDeformed && (
        <button
          type="button"
          onClick={() => setView("deformed")}
          className="bg-background/90 absolute top-4 right-16 z-10 rounded-lg px-3 py-2 text-xs shadow-sm backdrop-blur"
        >
          全国に戻る
        </button>
      )}

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
