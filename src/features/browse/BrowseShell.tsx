"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";

import { MapView } from "@/features/map/MapView";
import { mapPinKey } from "@/features/map/pinKey";
import { useMasterLabels } from "@/features/map/labels";
import type { BrowseItem, MapPin, Genre, Locale } from "@/features/map/queries";

import { BottomSheet, snapOffset, type Snap } from "./BottomSheet";
import { IndexList } from "./IndexList";
import type { Axis } from "./axes";

/**
 * 発祥地の表示文字列（作業パッケージ「トップページ改善」A節）。
 *
 * 都道府県名はマスタラベル辞書（prefecture）で翻訳する。市名はローマ字辞書が
 * 無いため日本語のままにする（詳細ページ・作業パッケージ「トップページ改善」A節と同じ流儀）。
 * ja は既存表記（連結）を変えない。en は「Fukushima / 郡山市」形式（"/" 区切り）。
 */
function formatPrefCity(
  pref: string | null,
  city: string | null,
  locale: Locale,
  prefLabel: (v: string | null | undefined) => string | null,
  unknown: string,
): string {
  if (!pref) return unknown;
  const name = prefLabel(pref) ?? pref;
  if (locale === "ja") return `${name}${city ?? ""}`;
  return city ? `${name} / ${city}` : name;
}

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
  items: BrowseItem[];
  /** 本場ピン（2026-09）。索引には出さず、地図でのみ items と合流する。 */
  honbaPins: MapPin[];
  genres: Genre[];
  locale: Locale;
}) {
  const t = useTranslations("browse");
  const ti = useTranslations("item");
  const tRegion = useTranslations("regionRelation");
  const label = useMasterLabels();
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

  useEffect(() => {
    const update = () => setVh(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // 地図に渡す合流データ（発祥+本場）。索引・件数表記は items のまま
  // （本場を索引に重複表示しないため。作業パッケージ「本場ピン」§1）。
  const mapPins = useMemo<MapPin[]>(
    () => [...items.map((i): MapPin => ({ ...i, kind: "origin" })), ...honbaPins],
    [items, honbaPins],
  );

  const selected = useMemo(
    () => mapPins.find((i) => mapPinKey(i) === selectedSlug) ?? null,
    [mapPins, selectedSlug],
  );

  // 選択が発祥ピンのときだけ、カード増強用のフルデータ（タグ・本文冒頭）を引く
  // （本場ピンは items に含まれず、food_item_regions 由来の別データのため対象外。
  // 作業パッケージ「トップページ改善」B節）。
  const selectedBrowseItem = useMemo(
    () => (selected && selected.kind === "origin" ? (items.find((i) => i.slug === selected.slug) ?? null) : null),
    [selected, items],
  );

  // 「同じ系統をもっと」的な次の1件（作業パッケージ「トップページ改善」B節）。
  // 同ジャンル+同系統（無ければ同棚）でグループ化し、自分以外の先頭1件を割り当てる。
  // 詳細ページの fetchStyleSiblings/fetchShelfSiblings と同じ考え方だが、
  // 追加のDBクエリを増やさないよう既に取得済みの items からその場で計算する。
  const nextRelatedMap = useMemo(() => {
    const groups = new Map<string, BrowseItem[]>();
    for (const item of items) {
      const key = item.genreSlug
        ? `genre::${item.genreSlug}::${item.primaryStyle ?? ""}`
        : `shelf::${item.shelfSlug}`;
      const list = groups.get(key);
      if (list) list.push(item);
      else groups.set(key, [item]);
    }
    const map = new Map<string, BrowseItem>();
    for (const list of groups.values()) {
      for (const item of list) {
        const other = list.find((x) => x.slug !== item.slug);
        if (other) map.set(item.slug, other);
      }
    }
    return map;
  }, [items]);
  const nextRelated = selectedBrowseItem ? (nextRelatedMap.get(selectedBrowseItem.slug) ?? null) : null;

  // ジャンル絞り込み中の表示データ（地図・索引で共有）。
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

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* 全国表示も実データ地形の地図（2026-09 全国表示の作り直し）。低ズームでは
          MapView 内部が県ごとの集約マーカーに切り替える。「全国に戻る」導線も
          MapView 側が isClusterView の実測値を見て自前で出す。 */}
      <MapView
        items={visiblePins}
        selectedSlug={selectedSlug}
        onSelect={handleSelectFromMap}
        bottomInset={bottomInset}
        showLegend={showStyleLegend}
      />

      {/* ジャンル絞り込み中チップ（本番体験レビュー: 「押したら地図に反映されない」への対処）。
          常に見える位置（地図上・z-10）に出す。 */}
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
              {/* 見出しはロケール主導（ja=日本語名・en=ローマ字）。三点セットの残りを副題に
                  （作業パッケージ「トップページ改善」A節。/en の日本語混入対策）。
                  ja の出力はこれまでと完全に同じ（既存E2E tests/smoke.spec.ts が検証）。 */}
              <h2 id="sheet-heading" className="text-base font-semibold">
                {locale === "ja" ? selected.nameJa : selected.nameRomaji}
              </h2>
              <p className="text-muted-foreground truncate text-sm">
                {locale === "ja" ? (
                  <>
                    {selected.nameRomaji}
                    {selected.nameEn ? ` — ${selected.nameEn}` : ""}
                  </>
                ) : (
                  <>
                    {selected.nameJa}
                    {selected.nameEn ? ` — ${selected.nameEn}` : ""}
                  </>
                )}
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
              // 発祥地表記はロケール対応（作業パッケージ「トップページ改善」A節）。
              <dl className="text-sm">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-16 shrink-0">{tRegion("本場")}</dt>
                  <dd>
                    {formatPrefCity(selected.originPref, selected.originCity, locale, label.prefecture, ti("unknown"))}
                  </dd>
                </div>
              </dl>
            ) : (
              <dl className="text-sm">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-16 shrink-0">{ti("origin")}</dt>
                  <dd>
                    {formatPrefCity(selected.originPref, selected.originCity, locale, label.prefecture, ti("unknown"))}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-16 shrink-0">{ti("style")}</dt>
                  <dd>{selected.primaryStyle ? label.style(selected.primaryStyle) : ti("unknown")}</dd>
                </div>
              </dl>
            )}
            {selected.summary && <p className="text-sm leading-relaxed">{selected.summary}</p>}

            {/* ViewDetail前の判断材料（作業パッケージ「トップページ改善」B節）。
                本場ピンには対象データが無い（food_item_regions由来の別データのため）ので、
                発祥ピン選択時（selectedBrowseItem がある時）だけ出す。 */}
            {selectedBrowseItem && selectedBrowseItem.tags.length > 0 && (
              <ul aria-label={ti("tagsLabel")} className="flex flex-wrap gap-1">
                {selectedBrowseItem.tags.map((tag) => (
                  <li key={tag.slug}>
                    <span className="border-border bg-background text-muted-foreground rounded-full border px-2 py-0.5 text-xs">
                      {locale === "ja" ? tag.nameJa : tag.nameEn}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {selectedBrowseItem?.bodyExcerpt && (
              <p className="text-muted-foreground text-xs leading-relaxed">
                {selectedBrowseItem.bodyExcerpt}
              </p>
            )}
            {nextRelated && (
              <p className="text-xs">
                <span className="text-muted-foreground">{ti("connectionsStyleTitle")}: </span>
                <Link
                  href={`/${nextRelated.genreSlug ?? nextRelated.shelfSlug}/${nextRelated.slug}`}
                  className="underline"
                >
                  {locale === "ja" ? nextRelated.nameJa : nextRelated.nameRomaji}
                </Link>
              </p>
            )}

            <div className="flex items-center gap-4">
              {/* 詳細ページ（SEOの受け皿）へ。シート内の表示は要約に留める。
                  その他アイテム（genre_id null）は棚slug経由のURLで到達できる
                  （CLAUDE.md「棚ページ + その他アイテムの到達経路」）。
                  旧文言「出典 / 地図で見る」は出典非表示の決定前の名残だったため
                  「詳細を見る」に変更（2026-09 本番レビュー指摘）。 */}
              <Link
                href={`/${selected.genreSlug ?? selected.shelfSlug}/${selected.slug}`}
                className="text-sm underline"
              >
                {ti("viewDetail")}
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
              locale={locale}
            />
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
