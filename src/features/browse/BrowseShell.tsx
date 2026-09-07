"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { PREF_SLUGS, type Prefecture } from "@/lib/prefectures";

import { MapView } from "@/features/map/MapView";
import { mapPinKey } from "@/features/map/pinKey";
import { useMasterLabels } from "@/features/map/labels";
import { ChainBridgeSection } from "@/features/map/ChainBridgeSection";
import type {
  BrowseItem,
  Chain,
  HonbaGroup,
  MapPin,
  Genre,
  Locale,
  TagWithCount,
} from "@/features/map/queries";

import { BottomSheet, snapOffset, type Snap } from "./BottomSheet";
import { IndexList } from "./IndexList";
import { TodayDishSection } from "./TodayDishSection";
import { HonbaTrailSection, type HonbaDisplayGroup } from "./HonbaTrailSection";
import { LandStoriesSection } from "./LandStoriesSection";
import { AboutBlurbSection } from "./AboutBlurbSection";
import type { Axis } from "./axes";

/**
 * タグチップの標準寸法（本番レビュー「タグも小さくてみづらい」対応）。
 * ピン選択カードのタグ・「興味からさがす」カードのタグチップで共通利用する。
 * 文字はtext-sm以上・タップ標的は最低32px（min-h-8）・余白px-3 py-1.5。
 * 詳細ページ CoverTagChips（src/features/map/CoverInfo.tsx）も同じ寸法に揃えてある。
 */
const TAG_CHIP_CLASS =
  "border-border bg-background hover:bg-muted/60 inline-flex min-h-8 items-center rounded-full border px-3 py-1.5 text-sm transition-colors";
const TAG_CHIP_ACTIVE_CLASS =
  "bg-primary text-primary-foreground inline-flex min-h-8 items-center rounded-full px-3 py-1.5 text-sm transition-colors";

/**
 * 発祥地の表示文字列（作業パッケージ「トップページ改善」A節）。
 *
 * 都道府県名はマスタラベル辞書（prefecture）で翻訳する。市名はローマ字辞書が
 * 無いため日本語のままにする（詳細ページ・作業パッケージ「トップページ改善」A節と同じ流儀）。
 * ja は既存表記（連結）を変えない。en は「Fukushima / 郡山市」形式（"/" 区切り）。
 */
export function formatPrefCity(
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
  dailyDish,
  landStories,
  honbaGroups,
  honbaTotalCount,
  chains,
  siteCounts,
  allTags,
}: {
  items: BrowseItem[];
  /** 本場ピン（2026-09）。索引には出さず、地図でのみ items と合流する。 */
  honbaPins: MapPin[];
  genres: Genre[];
  locale: Locale;
  /** トップ情報モジュール「今日の一皿」（2026-09）。日付選定はサーバー側（dailyPicks.ts）。
   * 本文を持つアイテムが1件も無ければ null（モジュール自体を出さない）。 */
  dailyDish: BrowseItem | null;
  /** トップ情報モジュール「土地の物語から」（2026-09）。今日の一皿と重複しない最大3件。 */
  landStories: BrowseItem[];
  /** トップ情報モジュール「本場をたどる」（2026-09）。日替わり順繰り選定（pickHonbaGroups）済みの
   * 最大6件（本番レビュー「魚だけ？違和感しかない」対応。page.tsx 参照）。 */
  honbaGroups: HonbaGroup[];
  /** 見出し横の総数表示用。選定前（食材拡張後の全件）のカウント。 */
  honbaTotalCount: number;
  /** トップ情報モジュール「チェーンから、ご当地へ」（2026-09）。ジャンル非依存の全チェーン。 */
  chains: Chain[];
  /** トップ情報モジュール「このサイトについて」（2026-09）の件数（DB実数）。 */
  siteCounts: { items: number; prefs: number };
  /** トップ「興味からさがす」カードのタグチップ・タグ絞り込み用（/tags と同じクエリ。件数はDB実数）。 */
  allTags: TagWithCount[];
}) {
  const t = useTranslations("browse");
  const ti = useTranslations("item");
  const tRegion = useTranslations("regionRelation");
  const tGenre = useTranslations("genre");
  const label = useMasterLabels();
  // selectedSlug は origin ピン/索引選択では item.slug そのもの、
  // honba ピン選択では mapPinKey() が返す複合キー（同じ slug が複数都市を持つため）。
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snap>("peak");
  const [axis, setAxis] = useState<Axis>("kana");
  const [vh, setVh] = useState(0);
  // PC/SP判定（地図コンパクト化の比率切り替え用。ヘッダーのPCナビと同じ md=768px を使う）。
  const [isDesktop, setIsDesktop] = useState(false);
  // ジャンル絞り込み（2026-09 トップ操作体系の作り直し）。
  // トップは地図が主役という確定設計に沿い、種類選択はジャンルページへの遷移ではなく
  // まず地図の絞り込みに反映する（作業パッケージ「トップ操作体系の作り直し」§1）。
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  // タグ絞り込み（作業パッケージ「トップ導線修正」§1）。ジャンルと同じ流儀で地図・索引・
  // 県クラスタ件数を絞る。genreFilter と併用時は AND（visibleItems/visiblePins 参照）。
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  // 県クラスタ選択（MapView が zoomend から算出する isClusterView をそのまま持ち上げる。
  // 本番レビュー「地図がフルサイズのままで使いづらい」対応。個別ピン表示＝県へ
  // 選択・ズームした状態を指す。初期値は national=true（コンパクト化しない））。
  const [isClusterView, setIsClusterView] = useState(true);

  useEffect(() => {
    const update = () => {
      setVh(window.innerHeight);
      setIsDesktop(window.innerWidth >= 768);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // 絞り込み・選択が有効な状態（ジャンル/タグ/県クラスタ選択のいずれか）では、地図を
  // SP約38vh・PC約45vhに縮め、シートを残りの高さに広げて結果一覧を主役にする
  // （本番レビュー「地図がフルサイズのままで使いづらい」対応）。解除で元のフルサイズに戻る。
  const compact = Boolean(genreFilter) || Boolean(tagFilter) || !isClusterView;
  const mapHeight =
    compact && vh > 0 ? Math.round(vh * (isDesktop ? 0.45 : 0.38)) : null;
  const dockedHeight = mapHeight !== null ? vh - mapHeight : undefined;

  // ヘッダー「土地」「種類」（#place / #type）からの遷移に追従する（作業パッケージ
  // 「トップ導線修正」B節）。シートを full まで開き、該当カード（id="place"/"type"）へ
  // スクロールする。絞り込み中は3カードが非表示になるため、ハッシュ遷移は絞り込みも解除する。
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash !== "place" && hash !== "type") return;
      setGenreFilter(null);
      setTagFilter(null);
      setSelectedSlug(null);
      setSnap("full");
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ block: "start" });
      });
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
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

  // 情報モジュール「本場をたどる」の表示用整形（作業パッケージ「トップページ情報モジュール」§2）。
  // 都市名はロケール表記（formatPrefCity）に、都道府県は PREF_SLUGS で地域ページへのリンクに変換する。
  const honbaDisplayGroups = useMemo<HonbaDisplayGroup[]>(
    () =>
      honbaGroups.map((g) => ({
        slug: g.slug,
        name: locale === "ja" ? g.nameJa : g.nameRomaji,
        cities: g.cities.map((c, i) => ({
          key: `${c.pref}-${c.city ?? i}`,
          label: formatPrefCity(c.pref, c.city, locale, label.prefecture, ti("unknown")),
          prefSlug: PREF_SLUGS[c.pref as Prefecture] ?? null,
        })),
      })),
    [honbaGroups, locale, label, ti],
  );

  // ジャンル絞り込み中の表示データ（地図・索引で共有）。
  // 本場ピンも item.genreSlug で判定するため、絞り込み時は発祥/本場を問わず揃って絞られる。
  const filteredGenre = useMemo(
    () => (genreFilter ? (genres.find((g) => g.slug === genreFilter) ?? null) : null),
    [genres, genreFilter],
  );
  // タグ絞り込み中の表示名（allTags は /tags と同じ全件取得なので、トップ12件に
  // 含まれないタグ ＝ ピン選択カードのタグバッジ経由の絞り込みでも名前を解決できる）。
  const filteredTag = useMemo(
    () => (tagFilter ? (allTags.find((tg) => tg.slug === tagFilter) ?? null) : null),
    [allTags, tagFilter],
  );
  // 「興味からさがす」カードに出す上位タグ（付与件数が多い順、最大12個。作業パッケージ
  // 「トップ導線修正」A-3節）。件数0のタグ（行き止まり）は出さない（/tags と同じ方針）。
  const topTags = useMemo(
    () =>
      [...allTags]
        .filter((tg) => tg.itemCount > 0)
        .sort((a, b) => b.itemCount - a.itemCount)
        .slice(0, 12),
    [allTags],
  );
  // 絞り込み中の名前表示（ジャンル・タグ両方あるときは連結）。結果ビューの見出しと
  // ピーク位置の要約の両方で使う（本番レビュー「タグ押しても本場を辿るとか出てるから
  // 全然絞り込めてるように見えない」対応。ピーク側も総数のままだと矛盾して見えるため）。
  const filterLabel = useMemo(
    () =>
      [filteredGenre, filteredTag]
        .filter((f): f is Genre | TagWithCount => f !== null)
        .map((f) => (locale === "ja" ? f.nameJa : f.nameEn))
        .join(locale === "ja" ? "・" : " / "),
    [filteredGenre, filteredTag, locale],
  );
  // タグ絞り込みは MapPin に無い情報（tagSlugs は BrowseItem のみが持つ）なので、
  // slug をキーに引けるようにしておく。本場ピンも発祥アイテムと同じ slug を使うため、
  // このマップ経由で本場ピンのタグ絞り込みも解決できる。
  const tagSlugsBySlug = useMemo(
    () => new Map(items.map((i) => [i.slug, i.tagSlugs])),
    [items],
  );
  const matchesTagFilter = useCallback(
    (slug: string) => !tagFilter || (tagSlugsBySlug.get(slug) ?? []).includes(tagFilter),
    [tagFilter, tagSlugsBySlug],
  );
  const visibleItems = useMemo(
    () =>
      items.filter(
        (i) => (!genreFilter || i.genreSlug === genreFilter) && matchesTagFilter(i.slug),
      ),
    [items, genreFilter, matchesTagFilter],
  );
  const visiblePins = useMemo(
    () =>
      mapPins.filter(
        (i) => (!genreFilter || i.genreSlug === genreFilter) && matchesTagFilter(i.slug),
      ),
    [mapPins, genreFilter, matchesTagFilter],
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

  // タグをタップしたら地図をそのタグに絞り込む（ジャンルと同じ流儀。
  // ピン選択カードのタグバッジ・「興味からさがす」カードのタグチップの双方から呼ばれる）。
  const handleSelectTag = useCallback((slug: string) => {
    setTagFilter(slug);
    setSelectedSlug(null);
    setSnap("peak");
  }, []);

  const handleClearTagFilter = useCallback(() => {
    setTagFilter(null);
  }, []);

  // 絞り込み結果ビュー（シート先頭の結果ヘッダー）の「絞り込みを解除」。
  // ジャンル・タグ両方が立っていても1回で両方解除する（本番レビュー
  // 「タグ押しても本場を辿るとか出てるから全然絞り込めてるように見えない」対応）。
  const handleClearAllFilters = useCallback(() => {
    setGenreFilter(null);
    setTagFilter(null);
  }, []);

  // 地図を寄せる際の下端余白。シートに隠れない位置に選択地点を置く。
  const bottomInset = vh === 0 ? 0 : Math.max(0, vh - snapOffset(snap, vh));

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* 全国表示も実データ地形の地図（2026-09 全国表示の作り直し）。低ズームでは
          MapView 内部が県ごとの集約マーカーに切り替える。「全国に戻る」導線も
          MapView 側が isClusterView の実測値を見て自前で出す。
          絞り込み・選択中（compact）は高さを縮め、シートを残りの高さに広げる
          （本番レビュー「地図がフルサイズのままで使いづらい」対応）。MapView 側は
          compact プロップの変化（CSSの height transition 完了後）を検知して
          map.resize() と再フィットを1回だけ呼ぶため、fitBounds等の描画は
          ここでの高さ変更に追従する。bottomInset はシートがもう地図に重ならない
          （縮小分＝ちょうどシート高）ため compact 時は 0 にする。 */}
      <div
        className="relative w-full transition-[height] duration-300 ease-out"
        style={{ height: mapHeight !== null ? mapHeight : "100%" }}
      >
        <MapView
          items={visiblePins}
          selectedSlug={selectedSlug}
          onSelect={handleSelectFromMap}
          bottomInset={compact ? 0 : bottomInset}
          showLegend={showStyleLegend}
          onClusterViewChange={setIsClusterView}
          compact={compact}
        />
      </div>

      {/* 絞り込み中チップ（本番体験レビュー: 「押したら地図に反映されない」への対処）。
          常に見える位置（地図上・z-10）に出す。ジャンル・タグ両方絞り込み中は2つ並ぶ
          （作業パッケージ「トップ導線修正」A-4節）。件数はAND後の visibleItems（両方を満たす件数）。 */}
      {(filteredGenre || filteredTag) && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex flex-wrap justify-center gap-2 px-4">
          {filteredGenre && (
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
          )}
          {filteredTag && (
            <button
              type="button"
              onClick={handleClearTagFilter}
              aria-label={t("tagFilterClear", {
                name: locale === "ja" ? filteredTag.nameJa : filteredTag.nameEn,
              })}
              className="border-border bg-background/95 text-foreground pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm shadow-sm backdrop-blur"
            >
              <span aria-hidden>
                {locale === "ja" ? filteredTag.nameJa : filteredTag.nameEn}
                <span className="text-muted-foreground ml-1">
                  {t("count", { count: visibleItems.length })}
                </span>
              </span>
              <span aria-hidden className="text-muted-foreground">
                ✕
              </span>
            </button>
          )}
        </div>
      )}

      <BottomSheet
        snap={snap}
        onSnapChange={setSnap}
        labelledBy="sheet-heading"
        dockedHeight={dockedHeight}
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
          ) : filteredGenre || filteredTag ? (
            // 絞り込み中はピーク位置の要約も結果ビューと同じ名前+件数にする（総数のまま
            // だと「絞り込めているように見えない」という指摘の再発になるため）。
            // 結果ヘッダーの「絞り込みを解除」もここに集約し、下の本文側では重複させない。
            <div className="flex items-center justify-between gap-2">
              <h2 id="sheet-heading" className="text-base font-semibold">
                {filterLabel}
                <span className="text-muted-foreground ml-2 text-sm font-normal">
                  {t("count", { count: visibleItems.length })}
                </span>
              </h2>
              <button
                type="button"
                onClick={(e) => {
                  // peak クリックでシートの段階が進む挙動と競合しないよう伝播を止める
                  e.stopPropagation();
                  handleClearAllFilters();
                }}
                className="text-muted-foreground shrink-0 text-sm underline"
              >
                {t("filterClearAll")}
              </button>
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
                  {/* 固定幅(w-16)だと英語ラベル "Renowned for" が折り返すため、
                      固定幅をやめて中身に合わせる（CLAUDE.md「あわせて直す /en の残り」節）。 */}
                  <dt className="text-muted-foreground shrink-0 whitespace-nowrap">{tRegion("本場")}</dt>
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
              // タグバッジは絞り込みボタン（本番レビュー「タグとか選択しても意味なくなってる」対応）。
              // 押すとそのタグで絞り込み、シートはピークへ（handleSelectTag。詳細ページ側の
              // CoverTagChips は現状どおりリンクのまま。作業パッケージ「トップ導線修正」A-2節）。
              <ul aria-label={ti("tagsLabel")} className="flex flex-wrap gap-1.5">
                {selectedBrowseItem.tags.map((tag) => (
                  <li key={tag.slug}>
                    <button
                      type="button"
                      onClick={() => handleSelectTag(tag.slug)}
                      className={TAG_CHIP_CLASS}
                    >
                      {locale === "ja" ? tag.nameJa : tag.nameEn}
                    </button>
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
        ) : filteredGenre || filteredTag ? (
          <div className="space-y-3">
            {/* 絞り込み結果ビュー（本番レビュー「タグ押しても本場を辿るとか出てるから
                全然絞り込めてるように見えない」対応）。絞り込み中は3カード・情報モジュールを
                隠し、絞り込み済み索引だけを見せる（結果ヘッダー＋解除はピーク側に集約済み。
                常時表示のため本文側で重複させない）。解除で元の構成に戻る。 */}
            {filteredGenre && (
              <Link
                href={`/${filteredGenre.slug}`}
                className="text-primary -mt-1 inline-block text-xs underline underline-offset-2"
              >
                {t("genreViewAllLink", {
                  name: locale === "ja" ? filteredGenre.nameJa : filteredGenre.nameEn,
                })}
              </Link>
            )}

            <IndexList
              items={visibleItems}
              axis={axis}
              onAxisChange={setAxis}
              selectedSlug={selectedSlug}
              onSelect={handleSelectFromIndex}
              locale={locale}
            />
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

            {/* 3軸索引の入口（土地・種類・興味）。共通ヘッダーの「土地」「種類」（#place/#type）
                からのスクロール先として id を付与する（作業パッケージ「トップ導線修正」B節）。 */}
            <div className="grid grid-cols-2 gap-2">
              <button
                id="place"
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

              <div id="type" className="border-border bg-background rounded-2xl border p-2.5">
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
              </div>

              {/* 興味からさがす: 付与件数が多い順のタグチップ（最大12個）を絞り込みボタンとして
                  並べ、末尾に「タグの一覧へ」リンクを残す（本番体験レビュー「ヘッダーの
                  土地・種類・興味は何も意味ない」対応。作業パッケージ「トップ導線修正」A-3節）。 */}
              <div className="border-border bg-background col-span-2 rounded-2xl border p-2.5">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-[3px] text-[10px] leading-none"
                  >
                    ◆
                  </span>
                  <span className="text-sm font-semibold">{t("entryInterestTitle")}</span>
                </div>
                {topTags.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {topTags.map((tag) => {
                      const active = tag.slug === tagFilter;
                      return (
                        <li key={tag.slug}>
                          <button
                            type="button"
                            onClick={() => handleSelectTag(tag.slug)}
                            aria-pressed={active}
                            className={active ? TAG_CHIP_ACTIVE_CLASS : TAG_CHIP_CLASS}
                          >
                            {locale === "ja" ? tag.nameJa : tag.nameEn}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-xs">{t("entryInterestHint")}</p>
                )}
                <Link
                  href="/tags"
                  className="text-primary mt-1.5 inline-block text-xs underline underline-offset-2"
                >
                  {t("tagAllLink")}
                </Link>
              </div>
            </div>

            {/* 情報モジュール群（2026-09 トップページ情報モジュール）。
                地図が主役という確定設計は崩さず、3カードの下でスクロールした人に
                150件分の中身（本文・本場・チェーン）を見せる。ランキング・
                「おすすめ」ではない中立な導線にする（CLAUDE.md「規律」節）。 */}
            {dailyDish && (
              <TodayDishSection
                heading={t("modules.todayDish")}
                item={dailyDish}
                locale={locale}
                originCaption={ti("origin")}
                originLabel={formatPrefCity(
                  dailyDish.originPref,
                  dailyDish.originCity,
                  locale,
                  label.prefecture,
                  ti("unknown"),
                )}
                detailLabel={ti("viewDetail")}
              />
            )}

            <HonbaTrailSection
              heading={t("modules.honba")}
              countLabel={t("modules.honbaCount", { count: honbaTotalCount })}
              groups={honbaDisplayGroups}
            />

            <ChainBridgeSection
              heading={tGenre("chainsHeading")}
              intro={tGenre("chainsIntro")}
              chains={chains}
              locale={locale}
            />

            <LandStoriesSection
              heading={t("modules.landStories")}
              items={landStories}
              locale={locale}
              detailLabel={ti("viewDetail")}
            />

            <AboutBlurbSection
              heading={t("modules.about")}
              body={t("modules.aboutBody", { items: siteCounts.items, prefs: siteCounts.prefs })}
              linkLabel={t("modules.aboutCta")}
            />

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
