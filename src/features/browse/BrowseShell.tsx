"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { PREF_SLUGS, type Prefecture } from "@/lib/prefectures";

import { MapView } from "@/features/map/MapView";
import { mapPinKey } from "@/features/map/pinKey";
import { useMasterLabels } from "@/features/map/labels";
import { ChainBridgeSection } from "@/features/map/ChainBridgeSection";
import { translateCityName, type PlaceNameMap } from "@/features/map/placeNames";
import type {
  BrowseItem,
  Chain,
  HonbaGroup,
  ItemExcerpt,
  MapPin,
  Genre,
  Locale,
  Shelf,
  TagWithCount,
} from "@/features/map/queries";

import { fetchSelectedItemExcerpt } from "./actions";
import { BottomSheet, snapOffset, type Snap } from "./BottomSheet";
import { IndexList } from "./IndexList";
import { TodayDishSection } from "./TodayDishSection";
import { HonbaTrailSection, type HonbaDisplayGroup } from "./HonbaTrailSection";
import { LandStoriesSection } from "./LandStoriesSection";
import { AboutBlurbSection } from "./AboutBlurbSection";
import { NextEntriesSection } from "./NextEntriesSection";
import type { Axis } from "./axes";
import { countPrefContext, type PrefContextGroup } from "./prefContext";
import { matchesSearchQuery, normalizeSearchText } from "./search";

/** 検索入力の反映を遅らせる時間（作業パッケージ「トップ導線修正」A節）。 */
const SEARCH_DEBOUNCE_MS = 200;

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
 * 都道府県名はマスタラベル辞書（prefecture）で翻訳する。市名は place_names
 * （DBの他言語表記マスタ）で翻訳し、無ければ日本語のままにする（実装部隊の報告
 * 「/en の本場・産地チップに市区町村名が日本語のまま」対応）。
 * ja は既存表記（連結）を変えない。en は「Fukushima / Koriyama」形式（"/" 区切り）。
 */
export function formatPrefCity(
  pref: string | null,
  city: string | null,
  locale: Locale,
  prefLabel: (v: string | null | undefined) => string | null,
  unknown: string,
  placeNames: PlaceNameMap = {},
): string {
  if (!pref) return unknown;
  const name = prefLabel(pref) ?? pref;
  if (locale === "ja") return `${name}${city ?? ""}`;
  if (!city) return name;
  return `${name} / ${translateCityName(pref, city, locale, placeNames)}`;
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
  placeNames,
  guideScenes,
  shelves,
}: {
  items: BrowseItem[];
  /** 本場ピン（2026-09）。索引には出さず、地図でのみ items と合流する。 */
  honbaPins: MapPin[];
  genres: Genre[];
  locale: Locale;
  /** トップ情報モジュール「今日の一皿」（2026-09）。日付選定はサーバー側（dailyPicks.ts）。
   * 本文を持つアイテムが1件も無ければ null（モジュール自体を出さない）。bodyExcerpt は
   * page.tsx が選定後に fetchItemExcerpts で合流させたもの（BrowseItem 自体は持たない）。 */
  dailyDish: (BrowseItem & { bodyExcerpt: string | null }) | null;
  /** トップ情報モジュール「土地の物語から」（2026-09）。今日の一皿と重複しない最大3件。
   * bodyExcerptCh3 は page.tsx が合流させたもの。 */
  landStories: (BrowseItem & { bodyExcerptCh3: string | null })[];
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
  /** 市区町村名の他言語表記（/en 用。実装部隊の報告「/en の本場・産地チップに市区町村名が
   * 日本語のまま」対応）。ja では空オブジェクトでよい（formatPrefCity は ja では参照しない）。 */
  placeNames: PlaceNameMap;
  /** トップシート「食べに行く前に」カード（2026-09-24。体験検品「SPにガイドへの入口が
   * 無い」対応）のチップ用。件数>0の場面のslugのみ、GUIDE_SCENES順（page.tsxで絞り込み済み）。 */
  guideScenes: string[];
  /** 県絞り込みの一行文脈（prefContext.ts）用。region ページと同じ棚grp（dish/ingredient/preparation）。 */
  shelves: Shelf[];
}) {
  const t = useTranslations("browse");
  const ti = useTranslations("item");
  const tRegion = useTranslations("regionRelation");
  const tGenre = useTranslations("genre");
  const tg = useTranslations("guide");
  const label = useMasterLabels();
  // selectedSlug は origin ピン/索引選択では item.slug そのもの、
  // honba ピン選択では mapPinKey() が返す複合キー（同じ slug が複数都市を持つため）。
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snap>("peak");
  // 絞り込み中の結果ヘッダーに出すジャンル総論の展開状態（本番レビュー「和牛一覧の
  // 説明文みたいなのは表示必要なのでは」対応）。ジャンルを切り替えたら畳み直す。
  const [introExpanded, setIntroExpanded] = useState(false);
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
  // 検索窓の絞り込み（体験検品2026-09-24「検索窓が押せそうに見えるのに無効」対応）。
  // 入力欄の表示値は即時反映し（searchQuery）、絞り込みへの反映だけ200msデバウンスする
  // （debouncedSearchQuery）。ジャンル・タグ・県と同じAND条件で visibleItems/visiblePins を絞る。
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearchQuery(searchQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchQuery]);
  // 検索窓に入力したら、他の絞り込み（ジャンル・タグ）と同じ流儀でピーク位置に戻し、
  // 選択中ピンを解除する（体験検品2026-09-24対応）。実際の絞り込みへの反映は
  // debouncedSearchQuery 側（200msデバウンス）で行う。
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setSelectedSlug(null);
    setSnap("peak");
  }, []);
  // 県クラスタ選択（MapView が zoomend から算出する isClusterView をそのまま持ち上げる。
  // 本番レビュー「地図がフルサイズのままで使いづらい」対応。個別ピン表示＝県へ
  // 選択・ズームした状態を指す。初期値は national=true（コンパクト化しない））。
  const [isClusterView, setIsClusterView] = useState(true);
  // 県クラスタのタップを「県の絞り込み」として扱う（PREF_FILTER_IMPL_BRIEF.md）。
  // origin_pref と同じ規約（都道府県の日本語名）を持つ。
  const [prefFilter, setPrefFilter] = useState<string | null>(null);
  // 親側の操作（絞り込み解除チップ・#place/#type ハッシュ遷移）で地図を全国表示へ
  // 戻すためのシグナル（MapView は flyToJapan を外部に公開していないため、数値を
  // 増やして伝える。同ファイル docコメント参照）。
  const [resetToJapanSignal, setResetToJapanSignal] = useState(0);

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
  // シートを full まで開いてモジュール・索引を読んでいる間は、背後の地図がフルサイズの
  // ままだと隠れているだけで意味が無い（本番レビュー「地図外のエリアみてる時に地図が
  // ずっとフルサイズである必要あるの？」対応）。full 到達でも同じく縮める。
  // 検索中（debouncedSearchQuery。空白だけの入力は絞り込み扱いにしない）も同じく縮める。
  const searchActive = normalizeSearchText(debouncedSearchQuery) !== "";
  const compact =
    Boolean(genreFilter) ||
    Boolean(tagFilter) ||
    Boolean(prefFilter) ||
    searchActive ||
    !isClusterView ||
    snap === "full";
  const mapHeight =
    compact && vh > 0 ? Math.round(vh * (isDesktop ? 0.45 : 0.38)) : null;
  const dockedHeight = mapHeight !== null ? vh - mapHeight : undefined;

  // 「土地からさがす」カード・「次の入口」の「土地の索引へ」・ヘッダー「土地」（#place）
  // 共通の挙動（体験検品2026-09-26「土地の索引へを押すとシートがfullのまま地図が画面外」
  // 対応）。絞り込みを解除し、シートを地図が見える段階（full以外）まで下げる。カードへの
  // スクロールはしない（体験原則1「地図は主役」。地図を見せることが目的のため）。
  const handleShowPlace = useCallback(() => {
    setGenreFilter(null);
    setTagFilter(null);
    setSearchQuery("");
    setSelectedSlug(null);
    setSnap((prev) => (prev === "full" ? "half" : "peak"));
    // 絞り込み中は3カードが非表示になるため、県絞り込みも解除し地図を全国へ戻す
    // （PREF_FILTER_IMPL_BRIEF.md 設計3。地図とシートが食い違わないように）。
    if (prefFilter) {
      setPrefFilter(null);
      setResetToJapanSignal((s) => s + 1);
    }
  }, [prefFilter]);

  // ヘッダー「種類」（#type）・検索0件案内の「種類から探しなおす」共通の挙動
  // （作業パッケージ「トップ導線修正」B節。体験検品2026-09-26で検索0件にも追加）。
  // 絞り込みを解除し、シートを full まで開いて種類カード（id="type"）へスクロールする。
  // place と違いこちらは索引・種類カードを読ませるのが目的のため、従来どおり full + スクロール。
  const handleShowType = useCallback(() => {
    setGenreFilter(null);
    setTagFilter(null);
    setSearchQuery("");
    setSelectedSlug(null);
    setSnap("full");
    if (prefFilter) {
      setPrefFilter(null);
      setResetToJapanSignal((s) => s + 1);
    }
    requestAnimationFrame(() => {
      document.getElementById("type")?.scrollIntoView({ block: "start" });
    });
  }, [prefFilter]);

  // ヘッダー「土地」「種類」（#place / #type）からの遷移に追従する（作業パッケージ
  // 「トップ導線修正」B節）。type は従来どおり該当カードへスクロール、place は地図を
  // 見せる段階に留める（体験検品2026-09-26対応。上のhandleShowPlace/handleShowType参照）。
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "place") {
        handleShowPlace();
      } else if (hash === "type") {
        handleShowType();
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [handleShowPlace, handleShowType]);

  // 地図に渡す合流データ（発祥+本場）。索引・件数表記は items のまま
  // （本場を索引に重複表示しないため。作業パッケージ「本場ピン」§1）。
  // items には座標なし（部位・ネタ等）も含まれる（実装部隊の報告「トップで牛肉の部位等を
  // 選ぶと0件」対応）ため、地図ピンにする分だけ lat/lng != null で絞る。
  // MapPin（MapItem由来）は summary を持つが、items（BrowseItem。RSCペイロード削減で
  // summary を持たない。queries.ts の BrowseItem docコメント参照）にはその実体が無いため、
  // ここでは null を明示する。実際の summary/bodyExcerpt はピン選択時に
  // fetchSelectedItemExcerpt で別途取る（selectedExcerpt state 参照）。
  const mapPins = useMemo<MapPin[]>(
    () => [
      ...items
        .filter((i): i is BrowseItem & { lat: number; lng: number } => i.lat != null && i.lng != null)
        .map((i): MapPin => ({ ...i, summary: null, kind: "origin" })),
      ...honbaPins,
    ],
    [items, honbaPins],
  );

  const selected = useMemo(
    () => mapPins.find((i) => mapPinKey(i) === selectedSlug) ?? null,
    [mapPins, selectedSlug],
  );

  // 選択が発祥ピンのときだけ、カード増強用のタグを引く（本場ピンは items に含まれず、
  // food_item_regions 由来の別データのため対象外。作業パッケージ「トップページ改善」B節）。
  const selectedBrowseItem = useMemo(
    () => (selected && selected.kind === "origin" ? (items.find((i) => i.slug === selected.slug) ?? null) : null),
    [selected, items],
  );

  // ピン選択カードの summary/bodyExcerpt（実装部隊の報告「トップのHTMLが約1MB」対応で
  // BrowseItem 本体からは落とした。queries.ts 参照）。選択が変わるたびに1件だけ
  // Server Action で取り、slug 単位にキャッシュして同じアイテムの再選択では呼ばない。
  // 本場ピンは honbaPins が summary を既に持っているため対象外（selected.summary を使う）。
  //
  // 「取得中/取得済みslug」の重複排除だけ ref（エフェクト内でのみ参照。render中には
  // 読まない。react-hooks/refs）で行い、実際の描画に使う値は useState で持つ。
  // setState はフェッチ完了（.then。外部システムからの通知）でだけ呼ぶ
  // （react-hooks/set-state-in-effect: エフェクト本体で直接 setState しない）。
  const excerptRequestedRef = useRef(new Set<string>());
  const [excerptBySlug, setExcerptBySlug] = useState<Map<string, ItemExcerpt | null>>(new Map());
  useEffect(() => {
    if (!selected || selected.kind !== "origin") return;
    const slug = selected.slug;
    if (excerptRequestedRef.current.has(slug)) return;
    excerptRequestedRef.current.add(slug);
    let cancelled = false;
    fetchSelectedItemExcerpt({ slug, locale }).then((result) => {
      if (cancelled) return;
      setExcerptBySlug((prev) => new Map(prev).set(slug, result.ok ? result.data : null));
    });
    return () => {
      cancelled = true;
    };
  }, [selected, locale]);
  const selectedExcerpt =
    selected && selected.kind === "origin" ? (excerptBySlug.get(selected.slug) ?? null) : null;

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

  // ピン選択カードの summary。本場ピンは honbaPins が実データを持つのでそのまま使い、
  // 発祥ピンは selectedExcerpt（fetchSelectedItemExcerpt で取得済み）から引く。
  const selectedSummary = selected
    ? selected.kind === "honba"
      ? selected.summary
      : (selectedExcerpt?.summary ?? null)
    : null;
  // slug→タグ名の解決用（ピン選択カードのタグバッジ用。BrowseItem は tagSlugs しか
  // 持たない（RSCペイロード削減。queries.ts docコメント参照）ため、表示名は全アイテム
  // 共通の allTags から引く。同じ文字列をアイテム数分重複させない）。
  const tagBySlug = useMemo(
    () => new Map<string, TagWithCount>(allTags.map((tg): [string, TagWithCount] => [tg.slug, tg])),
    [allTags],
  );
  // ピン選択カードのタグバッジ（最大3件。表示名は tagBySlug 経由で allTags から解決する）。
  const selectedTagBadges = (selectedBrowseItem?.tagSlugs ?? [])
    .slice(0, 3)
    .map((slug) => tagBySlug.get(slug))
    .filter((tag): tag is TagWithCount => tag !== undefined);

  // 情報モジュール「本場をたどる」の表示用整形（作業パッケージ「トップページ情報モジュール」§2）。
  // 都市名はロケール表記（formatPrefCity）に、都道府県は PREF_SLUGS で地域ページへのリンクに変換する。
  const honbaDisplayGroups = useMemo<HonbaDisplayGroup[]>(
    () =>
      honbaGroups.map((g) => ({
        slug: g.slug,
        name: locale === "ja" ? g.nameJa : g.nameRomaji,
        cities: g.cities.map((c, i) => ({
          key: `${c.pref}-${c.city ?? i}`,
          label: formatPrefCity(c.pref, c.city, locale, label.prefecture, ti("unknown"), placeNames),
          prefSlug: PREF_SLUGS[c.pref as Prefecture] ?? null,
        })),
      })),
    [honbaGroups, locale, label, ti, placeNames],
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
  // 「種類からさがす」の3層（本番レビュー「銘柄豚と豚肉の部位って並列になってるけど
  // 同じ情報なのか？部位は別じゃね」対応）。銘柄（dish/ingredient）と部位・ネタ（cut）は
  // 見た目の同型ジャンルでも土地に結びつくかどうかが違うため、層を分けて出す。
  // 層にジャンルが無ければ空配列になり、その層自体を出さない。
  const genresByType = useMemo(
    () => ({
      dish: genres.filter((g) => g.type === "dish"),
      ingredient: genres.filter((g) => g.type === "ingredient"),
      cut: genres.filter((g) => g.type === "cut"),
    }),
    [genres],
  );
  // 3層共通のチップ列（絞り込み挙動は handleSelectGenre のまま。見た目のみ層分けする）。
  const renderGenreChips = (list: Genre[]) => (
    <ul className="flex flex-wrap gap-1">
      {list.map((g) => {
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
  );
  // 検索入力欄（体験検品2026-09-24対応）。既定表示（3カード）・絞り込み結果ビューの
  // 両方の先頭に同じ見た目で置き、結果ビューでも再検索できるようにする
  // （作業パッケージ「トップ導線修正」A節「入力欄はシートの先頭のまま」）。
  const searchInput = (
    <div className="relative">
      <Search
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
      />
      <Input
        value={searchQuery}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchLabel")}
        className="pl-8"
      />
    </div>
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
  // 検索窓の一致判定（体験検品2026-09-24対応。search.ts の純関数）。名前3種（三点セット）
  // に加え、土地（県名・市名）でも一致するよう originPref/originCity も対象に入れる。
  // MapPin は MapItem を継承するため、BrowseItem・MapPin のどちらもこれらのフィールドを
  // 直接持つ（別途 slug→値のマップを用意する必要がない）。
  const matchesSearchFilter = useCallback(
    (i: {
      nameJa: string;
      nameEn: string | null;
      nameRomaji: string;
      originPref: string | null;
      originCity: string | null;
    }) => matchesSearchQuery(debouncedSearchQuery, i.nameJa, i.nameEn, i.nameRomaji, i.originPref, i.originCity),
    [debouncedSearchQuery],
  );
  // 県絞り込み（prefFilter）は origin_pref と同じ規約の値で AND する。本場ピンは
  // originPref がそのピンの所在地（本場の都市）を表すため（queries.ts MapPin docコメント）、
  // 同じ条件でそのまま本場の県一致判定になる（PREF_FILTER_IMPL_BRIEF.md 設計1）。
  const visibleItems = useMemo(
    () =>
      items.filter(
        (i) =>
          (!genreFilter || i.genreSlug === genreFilter) &&
          matchesTagFilter(i.slug) &&
          (!prefFilter || i.originPref === prefFilter) &&
          matchesSearchFilter(i),
      ),
    [items, genreFilter, matchesTagFilter, prefFilter, matchesSearchFilter],
  );
  const visiblePins = useMemo(
    () =>
      mapPins.filter(
        (i) =>
          (!genreFilter || i.genreSlug === genreFilter) &&
          matchesTagFilter(i.slug) &&
          (!prefFilter || i.originPref === prefFilter) &&
          matchesSearchFilter(i),
      ),
    [mapPins, genreFilter, matchesTagFilter, prefFilter, matchesSearchFilter],
  );
  // 県の一行文脈（PREF_FILTER_IMPL_BRIEF.md 設計4）。visibleItems は既に
  // origin_pref === prefFilter（+ジャンル/タグ）に絞られているため、そのまま数える。
  // この県が本場の料理の数（○本場）。数字は発祥件数に混ぜず、一行文脈に「○本場 N件」で添える
  // （体験検品 2026-09-26「本場の丸の意味を知る手段がない」対応）。
  const prefHonbaCount = useMemo(
    () =>
      prefFilter
        ? new Set(
            mapPins.filter((p) => p.kind === "honba" && p.originPref === prefFilter).map((p) => p.slug),
          ).size
        : 0,
    [prefFilter, mapPins],
  );
  const prefContextCounts = useMemo(
    () => (prefFilter ? countPrefContext(visibleItems, shelves) : null),
    [prefFilter, visibleItems, shelves],
  );
  // 本場だけの県（発祥ピンが0件。石川県等）は visibleItems が0件になる（CLUSTER_COUNT_IMPL_BRIEF.md
  // 設計4）。行き止まりにしないため、この県の本場一覧を出す。honbaGroups プロップは
  // トップ「本場をたどる」用の日替わり選定済み最大6件（page.tsx の pickHonbaGroups）で
  // 県単位の全件表示には使えない（選定漏れがあると本場だけの県でも0件になりうる）ため、
  // 既に絞り込み済みの visiblePins（本場ピンは originPref が「本場の所在地」を表す。
  // queries.ts MapPin docコメント）から正確に組み立てる。
  const prefOnlyHonbaGroups = useMemo<HonbaDisplayGroup[]>(() => {
    if (!prefFilter) return [];
    const bySlug = new Map<string, MapPin[]>();
    for (const p of visiblePins) {
      if (p.kind !== "honba") continue;
      const list = bySlug.get(p.slug) ?? [];
      list.push(p);
      bySlug.set(p.slug, list);
    }
    return [...bySlug.entries()].map(([slug, pins]) => ({
      slug,
      name: locale === "ja" ? pins[0].nameJa : pins[0].nameRomaji,
      cities: pins.map((p, i) => ({
        key: `${p.originPref}-${p.originCity ?? i}`,
        label: formatPrefCity(p.originPref, p.originCity, locale, label.prefecture, ti("unknown"), placeNames),
        prefSlug: p.originPref ? (PREF_SLUGS[p.originPref as Prefecture] ?? null) : null,
      })),
    }));
  }, [prefFilter, visiblePins, locale, label, ti, placeNames]);
  // 1群分の文言を組み立てる（体験検品フォローアップ§3「件数の内訳だけでは
  // 『これは何か』が伝わらない」対応）。代表（先頭最大3件。ランキングにしない）を
  // 括弧で添える。件数が代表数を超える場合だけ「ほか」を足す。
  const buildPrefContextLine = useCallback(
    (
      key: "prefContextDish" | "prefContextIngredient" | "prefContextPrep",
      group: PrefContextGroup,
    ): string | null => {
      if (group.count === 0) return null;
      const names = group.representatives.map((r) => (locale === "ja" ? r.nameJa : r.nameRomaji));
      if (names.length === 0) return t(key, { count: group.count });
      const hasMore = group.count > names.length;
      const joined = names.join(locale === "ja" ? "、" : ", ");
      const withMore = hasMore ? `${joined}${locale === "ja" ? " " : ", "}${t("prefContextMore")}` : joined;
      return `${t(key, { count: group.count })}${t("prefContextExamples", { names: withMore })}`;
    },
    [locale, t],
  );
  const filteredPrefLabel = useMemo(
    () => (prefFilter ? (label.prefecture(prefFilter) ?? prefFilter) : null),
    [prefFilter, label],
  );
  // ジャンル/タグと県が同時に絞り込まれているときは「福島県 × ラーメン」のように併記する
  // （ジャンル総論を優先する設計のため、genre/tagの結合はそのまま filterLabel を使い回す）。
  // 検索は独立した入口のため、検索中は見出しを検索専用の文言に切り替える
  // （「「ラーメン」の検索 N件」。作業パッケージ「トップ導線修正」A節の指定文言）。
  const searchDisplayQuery = debouncedSearchQuery.trim();
  const resultHeading = searchActive
    ? t("searchResultTitle", { query: searchDisplayQuery })
    : filteredPrefLabel
      ? filterLabel
        ? `${filteredPrefLabel} × ${filterLabel}`
        : filteredPrefLabel
      : filterLabel;
  // 系統凡例は「ラーメン内部・単一ジャンル絞り込み時のみ」（CLAUDE.md「デザイン」節）。
  // 系統色の凡例（醤油・味噌・塩・豚骨）はラーメン内部だけの識別軸（CLAUDE.md「系統色」）。
  // 他ジャンルの系統（洋食のピザ等）は色分けしないので凡例も出さない
  const showStyleLegend =
    genreFilter === "ramen" && visiblePins.some((i) => i.primaryStyle !== null);

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
    setIntroExpanded(false);
  }, []);

  const handleClearGenreFilter = useCallback(() => {
    setGenreFilter(null);
    setIntroExpanded(false);
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

  // 検索チップの✕（検索だけを解除する）。
  const handleClearSearchFilter = useCallback(() => {
    setSearchQuery("");
  }, []);

  // 県クラスタのタップ（MapView の onPrefSelect）を「絞り込み」として扱う
  // （PREF_FILTER_IMPL_BRIEF.md 設計3）。
  const handleSelectPref = useCallback((pref: string) => {
    setPrefFilter(pref);
    setSelectedSlug(null);
    setSnap("peak");
  }, []);

  // 「県のみ」の解除（絞り込みチップの✕）。地図は全国表示へ戻す（設計5）。
  const handleClearPrefFilter = useCallback(() => {
    setPrefFilter(null);
    setResetToJapanSignal((s) => s + 1);
  }, []);

  // MapView の「全国に戻る」ボタン（onPrefClear）用。地図側が既に flyToJapan を
  // 呼んでいるため、ここでは prefFilter を解除するだけで resetToJapanSignal は増やさない
  // （二重に fitJapan を呼んでアニメーションが衝突するのを避ける）。
  const handleMapPrefClear = useCallback(() => {
    setPrefFilter(null);
  }, []);

  // 実測の isClusterView が変わるたびに呼ばれる（MapView の onClusterViewChange）。
  // 手動で縮小してクラスタ表示に戻ったとき（isClusterView=true）も県絞り込みを解除し、
  // 地図とシートが食い違わないようにする（設計2）。
  const handleClusterViewChange = useCallback((clusterView: boolean) => {
    setIsClusterView(clusterView);
    if (clusterView) setPrefFilter(null);
  }, []);

  // 絞り込み結果ビュー（シート先頭の結果ヘッダー）の「絞り込みを解除」。
  // ジャンル・タグ・県のいずれが立っていても1回で全て解除する（本番レビュー
  // 「タグ押しても本場を辿るとか出てるから全然絞り込めてるように見えない」対応）。
  const handleClearAllFilters = useCallback(() => {
    setGenreFilter(null);
    setTagFilter(null);
    setSearchQuery("");
    setIntroExpanded(false);
    if (prefFilter) {
      setPrefFilter(null);
      setResetToJapanSignal((s) => s + 1);
    }
  }, [prefFilter]);

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
          onClusterViewChange={handleClusterViewChange}
          compact={compact}
          onPrefSelect={handleSelectPref}
          onPrefClear={handleMapPrefClear}
          resetToJapanSignal={resetToJapanSignal}
        />
      </div>

      {/* 絞り込み中チップ（本番体験レビュー: 「押したら地図に反映されない」への対処）。
          常に見える位置（地図上・z-10）に出す。ジャンル・タグ・県・検索が同時に絞り込み中は
          並んで出る（作業パッケージ「トップ導線修正」A-4節・PREF_FILTER_IMPL_BRIEF.md 設計5）。
          件数はAND後の visibleItems（全条件を満たす件数）。 */}
      {(filteredGenre || filteredTag || prefFilter || searchActive) && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex flex-wrap justify-center gap-2 px-4">
          {searchActive && (
            <button
              type="button"
              onClick={handleClearSearchFilter}
              aria-label={t("searchFilterClear", { query: searchDisplayQuery })}
              className="border-border bg-background/95 text-foreground pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm shadow-sm backdrop-blur"
            >
              <span aria-hidden>
                {searchDisplayQuery}
                <span className="text-muted-foreground ml-1">
                  {t("count", { count: visibleItems.length })}
                </span>
              </span>
              <span aria-hidden className="text-muted-foreground">
                ✕
              </span>
            </button>
          )}
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
          {prefFilter && filteredPrefLabel && (
            <button
              type="button"
              onClick={handleClearPrefFilter}
              aria-label={t("prefFilterClear", { pref: filteredPrefLabel })}
              className="border-border bg-background/95 text-foreground pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm shadow-sm backdrop-blur"
            >
              <span aria-hidden>
                {filteredPrefLabel}
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
          ) : filteredGenre || filteredTag || prefFilter || searchActive ? (
            // 絞り込み中はピーク位置の要約も結果ビューと同じ名前+件数にする（総数のまま
            // だと「絞り込めているように見えない」という指摘の再発になるため）。
            // 結果ヘッダーの「絞り込みを解除」もここに集約し、下の本文側では重複させない。
            // 県絞り込み時は resultHeading（県名。ジャンル/タグ併用時は「福島県 × ラーメン」）
            // を使う（PREF_FILTER_IMPL_BRIEF.md 設計4）。検索中は resultHeading が
            // 検索専用の文言（「「ラーメン」の検索」）に切り替わる。
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 id="sheet-heading" className="text-base font-semibold">
                  {resultHeading}
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
              {/* 検索0件の案内（体験原則6「行き止まりを作らない」対応）。上の
                  「絞り込みを解除」でも3カード（種類・興味・土地）に戻れるが、案内文だけでは
                  SPでその先に進めない（体験検品2026-09-26対応）ため、3つの入口を直下に並べる。
                  文言は3カードの見出し（entryTypeTitle等）と accessible name が衝突しないよう
                  「〜から探しなおす」にする。ここも「絞り込みを解除」ボタンと同じく peak の
                  クリックハンドラ（cycle）と競合しないよう伝播を止める。 */}
              {searchActive && visibleItems.length === 0 && (
                <div className="mt-1.5 space-y-1.5">
                  <p className="text-muted-foreground text-sm leading-relaxed">{t("searchEmpty")}</p>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1">
                    <li>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShowType();
                        }}
                        className="text-muted-foreground text-sm underline"
                      >
                        {t("searchEmptyType")}
                      </button>
                    </li>
                    <li>
                      <Link
                        href="/tags"
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground text-sm underline"
                      >
                        {t("searchEmptyInterest")}
                      </Link>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShowPlace();
                        }}
                        className="text-muted-foreground text-sm underline"
                      >
                        {t("searchEmptyPlace")}
                      </button>
                    </li>
                  </ul>
                </div>
              )}
              {/* ジャンル絞り込み中の総論（本番レビュー「和牛一覧の説明文みたいなのは
                  表示必要なのでは」対応）。タグのみの絞り込みには対応する総論が無いため
                  現状維持。ジャンル+タグ併用時もジャンルの総論を出す。
                  県が同時に絞り込み中でも、ジャンル総論を優先してこちらを先に出す
                  （PREF_FILTER_IMPL_BRIEF.md 設計4。県の一行文脈は直下に続けて出す）。 */}
              {filteredGenre &&
                (() => {
                  const genreIntro = locale === "ja" ? filteredGenre.introJa : filteredGenre.introEn;
                  if (!genreIntro) return null;
                  return (
                    <div className="mt-1.5">
                      <p
                        className={`text-sm leading-relaxed ${introExpanded ? "" : "line-clamp-3"}`}
                      >
                        {genreIntro}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIntroExpanded((v) => !v);
                        }}
                        aria-expanded={introExpanded}
                        className="text-muted-foreground mt-0.5 text-xs underline"
                      >
                        {introExpanded ? t("introCollapse") : t("introExpand")}
                      </button>
                    </div>
                  );
                })()}
              {/* 県の一行文脈＋「この土地のページへ」リンク（体験原則2「選択の直後に必ず
                  文脈を出す」。PREF_FILTER_IMPL_BRIEF.md 設計4、体験検品フォローアップ§3・4）。
                  県には DB の総論が無いため visibleItems から機械的に数えた3群（0件の群は
                  出さない）に、各群の代表（先頭最大3件・ランキングにしない）の名前を添える。
                  ジャンル絞り込みと同時のときもここに出す（上のジャンル総論の下に続く）。 */}
              {prefFilter && prefContextCounts && (
                <div className="mt-1.5 space-y-1.5">
                  {(() => {
                    const parts = [
                      buildPrefContextLine("prefContextDish", prefContextCounts.dish),
                      buildPrefContextLine("prefContextIngredient", prefContextCounts.ingredient),
                      buildPrefContextLine("prefContextPrep", prefContextCounts.preparation),
                      prefHonbaCount > 0 ? t("prefContextHonba", { count: prefHonbaCount }) : null,
                    ].filter((s): s is string => s !== null);
                    if (parts.length === 0) return null;
                    return (
                      <p className="text-sm leading-relaxed">
                        {parts.join(locale === "ja" ? "・" : " / ")}
                      </p>
                    );
                  })()}
                  {/* 本場だけの県（発祥ピンが0件）は visibleItems が0件のまま行き止まりに
                      しない（体験原則6。CLUSTER_COUNT_IMPL_BRIEF.md 設計4）。既存の
                      「本場を辿る」モジュール（HonbaTrailSection）をそのまま流用し、
                      新しい見た目を作らない。 */}
                  {visibleItems.length === 0 && prefOnlyHonbaGroups.length > 0 && (
                    <HonbaTrailSection
                      heading={t("prefHonbaOnlyHeading")}
                      countLabel={t("count", { count: prefOnlyHonbaGroups.length })}
                      groups={prefOnlyHonbaGroups}
                    />
                  )}
                  <Link
                    href={`/region/${PREF_SLUGS[prefFilter as Prefecture]}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {t("prefPageLink")}
                  </Link>
                </div>
              )}
              {/* タグ絞り込み中の定義（実装部隊の報告「タグ絞り込み中に文脈が無い」対応）。
                  ジャンル総論と同じ見た目だが line-clamp なしで1〜2行（tags.definition は短文）。
                  definition は日本語のみのカラムのため /en では出さない（多言語正規化は後日対応。
                  .doc/20_data/01_models.md §3 参照）。 */}
              {filteredTag && locale === "ja" && (
                <p className="mt-1.5 text-sm leading-relaxed">{filteredTag.definition}</p>
              )}
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
                    {formatPrefCity(selected.originPref, selected.originCity, locale, label.prefecture, ti("unknown"), placeNames)}
                  </dd>
                </div>
              </dl>
            ) : (
              <dl className="text-sm">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-16 shrink-0">{ti("origin")}</dt>
                  <dd>
                    {formatPrefCity(selected.originPref, selected.originCity, locale, label.prefecture, ti("unknown"), placeNames)}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-16 shrink-0">{ti("style")}</dt>
                  <dd>{selected.primaryStyle ? label.style(selected.primaryStyle) : ti("unknown")}</dd>
                </div>
              </dl>
            )}
            {selectedSummary && <p className="text-sm leading-relaxed">{selectedSummary}</p>}

            {/* ViewDetail前の判断材料（作業パッケージ「トップページ改善」B節）。
                本場ピンには対象データが無い（food_item_regions由来の別データのため）ので、
                発祥ピン選択時（selectedBrowseItem がある時）だけ出す。 */}
            {selectedBrowseItem && selectedTagBadges.length > 0 && (
              // タグバッジは絞り込みボタン（本番レビュー「タグとか選択しても意味なくなってる」対応）。
              // 押すとそのタグで絞り込み、シートはピークへ（handleSelectTag。詳細ページ側の
              // CoverTagChips は現状どおりリンクのまま。作業パッケージ「トップ導線修正」A-2節）。
              <ul aria-label={ti("tagsLabel")} className="flex flex-wrap gap-1.5">
                {selectedTagBadges.map((tag) => (
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
            {selected.kind === "origin" && selectedExcerpt?.bodyExcerpt && (
              <p className="text-muted-foreground text-xs leading-relaxed">
                {selectedExcerpt.bodyExcerpt}
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
        ) : filteredGenre || filteredTag || prefFilter || searchActive ? (
          <div className="space-y-3">
            {/* 絞り込み結果ビュー（本番レビュー「タグ押しても本場を辿るとか出てるから
                全然絞り込めてるように見えない」対応。県絞り込みも同じビューを共有する。
                PREF_FILTER_IMPL_BRIEF.md）。絞り込み中は3カード・情報モジュールを
                隠し、絞り込み済み索引だけを見せる（結果ヘッダー＋解除はピーク側に集約済み。
                常時表示のため本文側で重複させない）。解除で元の構成に戻る。
                検索入力欄は結果ビューでも先頭に残す（体験検品2026-09-24対応。再検索できるように）。 */}
            {searchInput}
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
            {searchInput}

            {/* 3軸索引の入口（土地・種類・興味）。共通ヘッダーの「土地」「種類」（#place/#type）
                からのスクロール先として id を付与する（作業パッケージ「トップ導線修正」B節）。 */}
            <div className="grid grid-cols-2 gap-2">
              <button
                id="place"
                type="button"
                onClick={handleShowPlace}
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
                    遷移導線は下の「◯◯の一覧へ」リンクに主従を逆転して残す）。
                    3層に分ける（本番レビュー「銘柄豚と豚肉の部位って並列になってるけど
                    同じ情報なのか？部位は別じゃね」対応）。層にジャンルが無ければ
                    その層自体を出さない。 */}
                <div className="space-y-2">
                  {genresByType.dish.length > 0 && (
                    <div>
                      <p className="text-foreground/80 mb-1 text-xs font-semibold">{t("typeGroupDish")}</p>
                      {renderGenreChips(genresByType.dish)}
                    </div>
                  )}
                  {genresByType.ingredient.length > 0 && (
                    <div>
                      <p className="text-foreground/80 mb-1 text-xs font-semibold">{t("typeGroupIngredient")}</p>
                      {renderGenreChips(genresByType.ingredient)}
                    </div>
                  )}
                  {genresByType.cut.length > 0 && (
                    <div>
                      <p className="text-foreground/80 mb-1 text-xs font-semibold">{t("typeGroupCut")}</p>
                      {renderGenreChips(genresByType.cut)}
                    </div>
                  )}
                </div>
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

              {/* 食べに行く前に（2026-09-24。体験検品「ヘッダーの土地／種類／興味／ガイドが
                  SPで hidden md:flex になっていて、トップのシートにもガイドへの入口が無い」
                  対応）。場面チップ（件数>0のみ。行き止まり入口を作らない）+ ガイド一覧へのリンク。
                  ここは /guide の「場面からさがす」と同じ一覧なので、場面名はそのまま
                  （「{name}で」の形にするのはジャンル/アイテムのチップと並ぶ箇所だけ。
                  messages/*.json guide.sceneChip コメント参照） */}
              <div className="border-border bg-background col-span-2 rounded-2xl border p-2.5">
                <div className="mb-1.5">
                  <span className="text-sm font-semibold">{t("guideCardTitle")}</span>
                </div>
                {guideScenes.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {guideScenes.map((slug) => (
                      <li key={slug}>
                        <Link href={`/guide/scene/${slug}`} className={TAG_CHIP_CLASS}>
                          {tg(`scene.${slug}`)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-xs">{t("guideCardHint")}</p>
                )}
                <Link
                  href="/guide"
                  className="text-primary mt-1.5 inline-block text-xs underline underline-offset-2"
                >
                  {t("guideCardAllLink")}
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
                  placeNames,
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

            {/* 次の入口（体験原則6「行き止まりを作らない」対応。体験検品2026-09-24
                「五十音索引で終わり、次の入口が無い」への対処）。索引を読み切った人に
                地図・索引以外の主要導線をまとめて見せる。
                ラベルは3カード・ガイドカード・末尾のリンクと同一文言を再利用せず、専用の
                文言（modules.nextEntries.*）にする（同じシート内に同一の accessible name を
                持つリンクが重複するとスクリーンリーダー・E2Eの厳格一致で不明瞭になるため）。 */}
            <NextEntriesSection
              heading={t("modules.nextEntries.heading")}
              guideLabel={t("modules.nextEntries.guide")}
              interestLabel={t("modules.nextEntries.interest")}
              placeLabel={t("modules.nextEntries.place")}
              aboutLabel={t("modules.nextEntries.about")}
              termsLabel={t("modules.nextEntries.terms")}
              privacyLabel={t("modules.nextEntries.privacy")}
              onPlaceClick={handleShowPlace}
            />
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
