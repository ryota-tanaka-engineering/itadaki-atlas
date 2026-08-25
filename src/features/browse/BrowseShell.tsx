"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";

import { MapView } from "@/features/map/MapView";
import type { MapItem, Genre, Locale } from "@/features/map/queries";

import { BottomSheet, snapOffset, type Snap } from "./BottomSheet";
import { DeformedMap } from "./DeformedMap";
import { IndexList } from "./IndexList";
import type { Axis } from "./axes";

/**
 * 地図・ボトムシート・索引を束ねる層。
 *
 * 選択状態をここが持つことで、ピンタップと索引からの選択が同じ状態を共有し、
 * **ページ遷移なしで地図と詳細を往復できる**（.doc/30_features/02_ui_ux.md §2.2）。
 *
 * ルート要素は `fixed inset-0`（2026-08 デザイン確定）。共通ヘッダー
 * （src/components/SiteHeader.tsx）が layout.tsx 側で通常フローに載るため、
 * このコンポーネントを fixed で切り離すことで「地図がヘッダーの上に来る」
 * （＝ヘッダーが地図に重なる）レイアウトを、他ページのpaddingを増やさずに実現する。
 */
export function BrowseShell({
  items,
  genres,
  locale,
}: {
  items: MapItem[];
  genres: Genre[];
  locale: Locale;
}) {
  const t = useTranslations("browse");
  const ti = useTranslations("item");
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
    <div className="fixed inset-0 overflow-hidden">
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
          className="bg-background/90 absolute top-20 right-4 z-10 rounded-lg px-3 py-2 text-xs shadow-sm backdrop-blur"
        >
          {t("backToNational")}
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
              {t("heroTitle")}
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                {t("count", { count: items.length })}
              </span>
            </h2>
          )
        }
      >
        {selected ? (
          <div className="space-y-3">
            <dl className="text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-16 shrink-0">{ti("origin")}</dt>
                <dd>
                  {selected.originPref ?? "—"}
                  {selected.originCity ?? ""}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-16 shrink-0">{ti("style")}</dt>
                <dd>{selected.primaryStyle ?? "—"}</dd>
              </div>
            </dl>
            {selected.summary && <p className="text-sm leading-relaxed">{selected.summary}</p>}
            <div className="flex items-center gap-4">
              {/* 詳細ページ（SEOの受け皿）へ。シート内の表示は要約に留める */}
              <Link href={`/ramen/${selected.slug}`} className="text-sm underline">
                {ti("sources")} / {ti("viewOnMap")}
              </Link>
              <button
                type="button"
                onClick={() => setSelectedSlug(null)}
                className="text-muted-foreground text-sm underline"
              >
                {t("backToIndex")}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 検索ボックス風の入口。実装はまだ無いので無効化した見た目に留める */}
            <div className="relative">
              <Search
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              />
              <Input disabled placeholder={t("searchPlaceholder")} aria-label={t("searchLabel")} className="pl-8" />
            </div>

            {/* 3軸索引の入口（現状は土地・種類の2つ。興味は遷移先ができてから追加する） */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSnap("peak")}
                className="border-border bg-background hover:bg-muted/60 flex flex-col items-start gap-1 rounded-2xl border p-2.5 text-left transition-colors"
              >
                <span
                  aria-hidden
                  className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full text-[10px] leading-none"
                >
                  ●
                </span>
                <span className="text-sm font-semibold">{t("entryPlaceTitle")}</span>
                <span className="text-muted-foreground text-xs">{t("entryPlaceHint")}</span>
              </button>

              <div className="border-border bg-background rounded-2xl border p-2.5">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-[4px] text-[10px] leading-none"
                  >
                    ■
                  </span>
                  <span className="text-sm font-semibold">{t("entryTypeTitle")}</span>
                </div>
                <ul className="flex flex-wrap gap-1">
                  {genres.map((g) => (
                    <li key={g.slug}>
                      <Link
                        href={`/${g.slug}`}
                        className={buttonVariants({ variant: "outline", size: "xs" })}
                      >
                        {locale === "ja" ? g.nameJa : g.nameEn}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="text-center">
              <Link href="/about" className="text-muted-foreground text-xs underline">
                {t("aboutLink")}
              </Link>
            </p>

            <IndexList
              items={items}
              axis={axis}
              onAxisChange={setAxis}
              selectedSlug={selectedSlug}
              onSelect={handleSelectFromIndex}
            />
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
