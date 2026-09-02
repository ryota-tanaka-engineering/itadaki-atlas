"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";

import { MapView } from "@/features/map/MapView";
import { mapPinKey } from "@/features/map/pinKey";
import type { MapItem, MapPin, Genre, Locale } from "@/features/map/queries";

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
  honbaPins,
  genres,
  locale,
}: {
  items: MapItem[];
  /** 本場ピン（2026-09）。索引には出さず、地図・ディフォルメ地図でのみ items と合流する。 */
  honbaPins: MapPin[];
  genres: Genre[];
  locale: Locale;
}) {
  const t = useTranslations("browse");
  const ti = useTranslations("item");
  const tRegion = useTranslations("regionRelation");
  // selectedSlug は origin ピン/索引選択では item.slug そのもの、
  // honba ピン選択では mapPinKey() が返す複合キー（同じ slug が複数都市を持つため）。
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snap>("peak");
  const [axis, setAxis] = useState<Axis>("kana");
  const [vh, setVh] = useState(0);
  // ジャンル絞り込み（2026-09 トップ操作体系の作り直し）。
  // トップは地図が主役という確定設計に沿い、種類選択はジャンルページへの遷移ではなく
  // まず地図の絞り込みに反映する（作業パッケージ「トップ操作体系の作り直し」§1）。
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
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

  // 地図・ディフォルメ地図に渡す合流データ（発祥+本場）。索引・件数表記は items のまま
  // （本場を索引に重複表示しないため。作業パッケージ「本場ピン」§1）。
  const mapPins = useMemo<MapPin[]>(
    () => [...items.map((i): MapPin => ({ ...i, kind: "origin" })), ...honbaPins],
    [items, honbaPins],
  );

  const selected = useMemo(
    () => mapPins.find((i) => mapPinKey(i) === selectedSlug) ?? null,
    [mapPins, selectedSlug],
  );

  // ジャンル絞り込み中の表示データ（地図・索引・ディフォルメ地図で共有）。
  // 本場ピンも item.genreSlug で判定するため、絞り込み時は発祥/本場を問わず揃って絞られる。
  const filteredGenre = useMemo(
    () => (genreFilter ? (genres.find((g) => g.slug === genreFilter) ?? null) : null),
    [genres, genreFilter],
  );
  const visibleItems = useMemo(
    () => (genreFilter ? items.filter((i) => i.genreSlug === genreFilter) : items),
    [items, genreFilter],
  );
  const visiblePins = useMemo(
    () => (genreFilter ? mapPins.filter((i) => i.genreSlug === genreFilter) : mapPins),
    [mapPins, genreFilter],
  );
  // 系統凡例は「ラーメン内部・単一ジャンル絞り込み時のみ」（CLAUDE.md「デザイン」節）。
  const showStyleLegend = Boolean(genreFilter) && visiblePins.some((i) => i.primaryStyle !== null);

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

  // ジャンルをタップしたら地図をそのジャンルに絞り込み、ピーク位置に戻して
  // 「触ったら反映される」を地図で即座に見せる（本番体験レビューで指摘された、
  // ジャンル選択が地図に反映されない問題への対処）。
  const handleSelectGenre = useCallback((slug: string) => {
    setGenreFilter(slug);
    setSelectedSlug(null);
    setSnap("peak");
  }, []);

  const handleClearGenreFilter = useCallback(() => {
    setGenreFilter(null);
  }, []);

  // 地図を寄せる際の下端余白。シートに隠れない位置に選択地点を置く。
  const bottomInset = vh === 0 ? 0 : Math.max(0, vh - snapOffset(snap, vh));

  const showDeformed = view === "deformed";

  return (
    <div className="fixed inset-0 overflow-hidden">
      <MapView
        items={visiblePins}
        selectedSlug={selectedSlug}
        onSelect={handleSelectFromMap}
        bottomInset={bottomInset}
        focus={focus}
        showLegend={showStyleLegend}
      />

      {/* 実座標地図は生かしたまま上に被せる。切り替えで地図を作り直さない。 */}
      {showDeformed && (
        <div className="bg-background/95 absolute inset-0 z-10 backdrop-blur-[1px]">
          <DeformedMap
            items={visiblePins}
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

      {/* ジャンル絞り込み中チップ（本番体験レビュー: 「押したら地図に反映されない」への対処）。
          デフォルメ地図オーバーレイより後ろに置かず、常に見える位置（地図上・z-10で
          デフォルメ地図と同層だがDOM順で後勝ちにする）に出す。 */}
      {filteredGenre && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-center px-4">
          <button
            type="button"
            onClick={handleClearGenreFilter}
            aria-label={t("genreFilterClear", {
              name: locale === "ja" ? filteredGenre.nameJa : filteredGenre.nameEn,
            })}
            className="border-border bg-background/95 text-foreground pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm shadow-sm backdrop-blur"
          >
            <span aria-hidden>
              {locale === "ja" ? filteredGenre.nameJa : filteredGenre.nameEn}
              <span className="text-muted-foreground ml-1">
                {t("count", { count: visibleItems.length })}
              </span>
            </span>
            <span aria-hidden className="text-muted-foreground">
              ✕
            </span>
          </button>
        </div>
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
            {selected.kind === "honba" ? (
              // 本場ピン: 発祥/系統ではなく「本場」ラベル＋市名を出す
              // （構造的理由の長文=note はここに入れない。詳細ページで読める）。
              <dl className="text-sm">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-16 shrink-0">{tRegion("本場")}</dt>
                  <dd>
                    {selected.originPref ?? "—"}
                    {selected.originCity ?? ""}
                  </dd>
                </div>
              </dl>
            ) : (
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
            )}
            {selected.summary && <p className="text-sm leading-relaxed">{selected.summary}</p>}
            <div className="flex items-center gap-4">
              {/* 詳細ページ（SEOの受け皿）へ。シート内の表示は要約に留める。
                  アイテムのジャンルに応じたリンクにする（バグ修正: 以前は
                  /ramen/${slug} 固定だったため他ジャンルのアイテムが誤ったURLへ
                  飛んでいた）。棚内「その他」（genre_id null）は棚一覧が未実装
                  のためリンクにしない。 */}
              {selected.genreSlug ? (
                <Link href={`/${selected.genreSlug}/${selected.slug}`} className="text-sm underline">
                  {ti("sources")} / {ti("viewOnMap")}
                </Link>
              ) : (
                <span className="text-muted-foreground text-sm">{ti("sources")} / {ti("viewOnMap")}</span>
              )}
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

            {/* 3軸索引の入口（土地・種類・興味）。興味は /tags 実装で遷移先ができたため追加 */}
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
                {/* タップで地図の絞り込みに反映する（ジャンルページへは遷移しない。
                    遷移導線は下の「◯◯の一覧へ」リンクに主従を逆転して残す）。 */}
                <ul className="flex flex-wrap gap-1">
                  {genres.map((g) => {
                    const active = g.slug === genreFilter;
                    return (
                      <li key={g.slug}>
                        <button
                          type="button"
                          onClick={() => handleSelectGenre(g.slug)}
                          aria-pressed={active}
                          className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "border-border bg-background hover:bg-muted/60 border"
                          }`}
                        >
                          {locale === "ja" ? g.nameJa : g.nameEn}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {filteredGenre && (
                  <Link
                    href={`/${filteredGenre.slug}`}
                    className="text-primary mt-1.5 inline-block text-xs underline underline-offset-2"
                  >
                    {t("genreViewAllLink", {
                      name: locale === "ja" ? filteredGenre.nameJa : filteredGenre.nameEn,
                    })}
                  </Link>
                )}
              </div>

              <Link
                href="/tags"
                className="border-border bg-background hover:bg-muted/60 col-span-2 flex flex-col items-start gap-1 rounded-2xl border p-2.5 text-left transition-colors"
              >
                <span
                  aria-hidden
                  className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-[3px] text-[10px] leading-none"
                >
                  ◆
                </span>
                <span className="text-sm font-semibold">{t("entryInterestTitle")}</span>
                <span className="text-muted-foreground text-xs">{t("entryInterestHint")}</span>
              </Link>
            </div>

            <p className="text-center">
              <Link href="/about" className="text-muted-foreground text-xs underline">
                {t("aboutLink")}
              </Link>
            </p>

            <IndexList
              items={visibleItems}
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
