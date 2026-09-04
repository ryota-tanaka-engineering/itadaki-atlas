"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import * as maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { layers, namedFlavor, type Flavor } from "@protomaps/basemaps";
import "maplibre-gl/dist/maplibre-gl.css";

import type { MapPin } from "./queries";
import { mapPinKey } from "./pinKey";
import { PIN_BASE, PIN_STROKE, PRIMARY_STYLES, STYLE_COLORS, styleColor } from "./styles";
import { useMasterLabels } from "./labels";

/**
 * 地図トーン（CLAUDE.md「デザイン」節が正典。海 #efe8da・陸 #fffdf7・海岸線/境界 #c3b8a6）。
 *
 * @protomaps/basemaps の Flavor は色だけを差し替える薄い抽象で、レイヤー構成自体は
 * 標準の "light" を踏襲する（ベンダ固有APIの直書きにはあたらない。色トークンのみの差分）。
 */
const ATLAS_FLAVOR: Flavor = {
  ...namedFlavor("light"),
  background: "#efe8da",
  water: "#efe8da",
  earth: "#fffdf7",
  boundaries: "#c3b8a6",
  // landcover（森林・農地・草地等）や公園・樹林・低木地は既定だと緑系に色分けされ、
  // 「陸は #fffdf7 の単色紙」という確定デザインと矛盾するため陸と同色に揃える。
  park_a: "#fffdf7",
  park_b: "#fffdf7",
  wood_a: "#fffdf7",
  wood_b: "#fffdf7",
  scrub_a: "#fffdf7",
  scrub_b: "#fffdf7",
  landcover: {
    barren: "#fffdf7",
    farmland: "#fffdf7",
    forest: "#fffdf7",
    glacier: "#fffdf7",
    grassland: "#fffdf7",
    scrub: "#fffdf7",
    urban_area: "#fffdf7",
  },
  city_label: "#9c9184",
  city_label_halo: "#fffdf7",
  state_label: "#9c9184",
  state_label_halo: "#fffdf7",
  country_label: "#9c9184",
  subplace_label: "#9c9184",
  subplace_label_halo: "#fffdf7",
  roads_label_major: "#9c9184",
  roads_label_major_halo: "#fffdf7",
  roads_label_minor: "#9c9184",
  roads_label_minor_halo: "#fffdf7",
  ocean_label: "#9c9184",
  address_label: "#9c9184",
  address_label_halo: "#fffdf7",
};

/** 国土ズーム（z<=9目安）では道路・鉄道を出さない（CLAUDE.md「地図」節）。 */
const ROAD_LINE_MIN_ZOOM = 10;

/**
 * トーン・レイヤー構成・タイル配信元は詳細ページの位置帯（PositionBand）でも
 * 同じものを使う（見え方の一貫性・ベンダ固有APIの直書き回避）。
 */
export function buildAtlasLayers() {
  return layers("protomaps", ATLAS_FLAVOR, { lang: "ja" }).map((layer) => {
    // 道路・鉄道・橋・トンネル・経路番号シールドなど roads_* 系レイヤーを
    // 国土ズームで一律隠す（roads_labels_* 等は元々もっと高いズームでしか
    // 出ないため Math.max により実質変化しない）。
    if (layer.id.startsWith("roads_")) {
      return { ...layer, minzoom: Math.max(layer.minzoom ?? 0, ROAD_LINE_MIN_ZOOM) };
    }
    // 地名ラベルは最小限に留める（国・都道府県・市までとし、字・POIは隠す）
    if (layer.id === "places_subplace" || layer.id === "pois") {
      return { ...layer, minzoom: Math.max(layer.minzoom ?? 0, 12) };
    }
    // 県分解前（集約マーカー表示）の縮尺では地名ラベルを出さない。この縮尺で
    // 残るのは大陸側の国名・都市名だけで、日本の位置表示のノイズになる。
    // 県へズームすると（=個別ピン表示と同時に）地名が現れる規則にする。
    if (layer.id.startsWith("places_")) {
      return { ...layer, minzoom: Math.max(layer.minzoom ?? 0, 5) };
    }
    return layer;
  });
}

/**
 * フルスクリーン地図（.doc/30_features/02_ui_ux.md §2）。
 *
 * 選択状態は親が持つ（地図・ボトムシート・索引が同じ選択を共有するため）。
 *
 * タイル配信元は差し替え可能に保つ（ポータビリティ規約）。
 * 本番は R2 の pmtiles、ローカルは public/tiles/japan.pmtiles。
 */
export const PMTILES_URL = process.env.NEXT_PUBLIC_PMTILES_URL ?? "/tiles/japan.pmtiles";

/**
 * 日本全体が収まるバウンディングボックス。詳細ページの位置帯（PositionBand）の
 * 全国ミニ地図でも同じ範囲を使う（見え方の一貫性）。
 */
export const JAPAN_BOUNDS: [number, number, number, number] = [122.9, 20.4, 154.0, 45.6];

/**
 * 県分解のズームしきい値（2026-09 全国表示の作り直し。実測値ベースで確定）。
 *
 * 実測（SP390x844 / PC1440x900、Playwrightでの計測）:
 * - JAPAN_BOUNDS の全国表示のズームは 3.5〜4.43
 * - 最も広く散る県（北海道: 発祥+本場13ピン、緯度差約2度・経度差約3.7度）へ
 *   fitBounds した後のズームは 5.47〜7.58
 * - 単一地点しかない県は maxZoom 上限の 9 に張り付く
 *
 * 全国表示は必ず下回り、どの県へズームしても必ず上回るよう、両者の中間
 * （4.43 と 5.47 の間）である 5 を採用する。県の散らばりが広いほど fitBounds の
 * 結果ズームは下がる方向に働くため、この最悪ケース（北海道）を基準に取れば
 * 他の県はより高いズームに収まり安全側に倒れる。
 */
const CLUSTER_ZOOM_THRESHOLD = 5;

/**
 * 集約マーカー同士の重なり緩和（本番体験レビュー対応。2026-09）。
 *
 * SP390全国表示で本州中央のクラスタが団子状に重なり、件数が読めず下のクラスタが
 * タップできない問題への対処。マーカーは size-7（28px）なので、直径+数px の
 * 余白を持たせて確実に独立してタップできる間隔（px、画面座標）にする。
 */
const CLUSTER_MIN_DIST = 32;

/**
 * 全国表示へのフィット。シート（bottomInset）を避けた下余白は、
 * 「避けても日本全体が縦に収まる」ビューポートでだけ足す（横長のPC等では
 * ズームが幅で決まり日本が縦をほぼ使い切るため、余白を足すと maxBounds と
 * 干渉して日本が上にずれ、北側のクラスタがヘッダー裏に隠れる）。
 */
function fitJapan(map: maplibregl.Map, bottomInset: number, duration: number) {
  const sw = map.project([JAPAN_BOUNDS[0], JAPAN_BOUNDS[1]]);
  const ne = map.project([JAPAN_BOUNDS[2], JAPAN_BOUNDS[3]]);
  const japanHeight = Math.abs(sw.y - ne.y);
  const slack = map.getContainer().clientHeight - japanHeight;
  const bottom = slack >= bottomInset + 24 ? Math.max(24, bottomInset) : 24;
  map.fitBounds(
    [
      [JAPAN_BOUNDS[0], JAPAN_BOUNDS[1]],
      [JAPAN_BOUNDS[2], JAPAN_BOUNDS[3]],
    ],
    { padding: { top: 24, right: 24, bottom, left: 24 }, duration },
  );
}

// pmtiles:// プロトコルの登録は **グローバル状態** なので、コンポーネントの
// マウント/アンマウントで付け外ししない。StrictMode の二重マウントで
// 生きている地図からハンドラが外れるため。モジュールロード時に1回だけ登録する。
let protocolRegistered = false;
export function ensurePmtilesProtocol() {
  if (protocolRegistered) return;
  const protocol = new Protocol();
  // protocol.tile は v3(callback)/v4(Promise) の union で判別できないため
  // Promise 版の tilev4 を明示的に渡す。
  maplibregl.addProtocol("pmtiles", protocol.tilev4);
  protocolRegistered = true;
}

type Props = {
  /** 発祥ピン（kind='origin'）と本場ピン（kind='honba'）の合流データ。 */
  items: MapPin[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
  /** ボトムシートに隠れない位置に選択地点を寄せるための下端余白 */
  bottomInset: number;
  /** 系統凡例の表示可否（ラーメン内部・単一ジャンル絞り込み時のみ。CLAUDE.md「デザイン」節）。 */
  showLegend: boolean;
};

/** 県ごとの集約マーカー（2026-09 全国表示の作り直し）。位置はその県のピン群の重心。 */
type PrefCluster = {
  pref: string;
  lat: number;
  lng: number;
  count: number;
};

export function MapView({
  items,
  selectedSlug,
  onSelect,
  bottomInset,
  showLegend,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const label = useMasterLabels();
  const t = useTranslations("browse");
  const tRegion = useTranslations("regionRelation");
  // WebGL コンテキスト喪失（実機での「触ってたら地図が消えた」報告への防御。
  // iOS Safari はメモリ圧迫時に WebGL コンテキストを強制破棄することがある）に遭遇したら
  // このキーを進めて地図コンポーネントを丸ごと作り直す（コンテナDOM+Mapインスタンス）。
  const [mapGeneration, setMapGeneration] = useState(0);
  // 低ズーム=県集約、高ズーム=個別ピン（2026-09 全国表示の作り直し。しきい値は
  // CLUSTER_ZOOM_THRESHOLD 参照）。ピンチズームでも同じ規則で切り替わるよう、
  // クリック操作ではなく実際の map の zoomend から判定する（単一の真実の情報源）。
  const [isClusterView, setIsClusterView] = useState(true);
  // 集約マーカーのタップでその県へ寄せる際に使う下端余白。ボトムシートの
  // snap変化のたびにマーカーを作り直したくないため、ref経由で最新値だけ渡す。
  const bottomInsetRef = useRef(bottomInset);
  // 初期化時点では inset=0（シートの実測前）のため、全国フィットが下に伸びて
  // 九州・沖縄の集約マーカーがシートに隠れる。最初に実測値が入ったときだけ、
  // 全国表示のままなら余白込みで即時フィットし直す（シート開閉のたびには動かさない）。
  const didInsetRefitRef = useRef(false);
  useEffect(() => {
    bottomInsetRef.current = bottomInset;
    const map = mapRef.current;
    if (
      didInsetRefitRef.current ||
      !map ||
      bottomInset <= 0 ||
      map.getZoom() >= CLUSTER_ZOOM_THRESHOLD
    ) {
      return;
    }
    didInsetRefitRef.current = true;
    fitJapan(map, bottomInset, 0);
  }, [bottomInset]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    ensurePmtilesProtocol();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
        sprite: "https://protomaps.github.io/basemaps-assets/sprites/v4/light",
        sources: {
          protomaps: {
            type: "vector",
            url: `pmtiles://${PMTILES_URL}`,
            attribution:
              '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
          },
        },
        layers: buildAtlasLayers(),
      },
      bounds: JAPAN_BOUNDS,
      // シート分の下余白は、余裕を判定できる初回フィット後（bottomInset effect 側）で
      // 条件つきで足す。ここで無条件に足すと横長ビューポートで日本が上にずれる
      fitBoundsOptions: { padding: 24 },
      // 南側はシート分の下余白（bottomInset）込みで全国をフィットさせると
      // 視野が日本の南方海上まで伸びるため、他の3辺より広く取る
      // （狭いと fitBounds の上方シフトがクランプされ、九州・沖縄の
      // 集約マーカーがシートに隠れたままになる）。
      maxBounds: [
        [JAPAN_BOUNDS[0] - 8, JAPAN_BOUNDS[1] - 20],
        [JAPAN_BOUNDS[2] + 8, JAPAN_BOUNDS[3] + 8],
      ],
    });

    map.on("error", (e) => {
      // 空catchで潰さない（ia-nextjs-standards のエラー可視化ルール）
      console.error("maplibre:", e.error);
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    // WebGL コンテキスト喪失への対処。ブラウザの既定動作（コンテキストを破棄したまま
    // 二度と使わない）を止めて復元を試みつつ、一定時間内に復元イベントが来なければ
    // 地図ごと作り直すフォールバックに落とす（確実な再現が無くても入れる防御コード）。
    const canvas = map.getCanvas();
    let restoreTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.error("maplibre: WebGL context lost");
      if (restoreTimeout) clearTimeout(restoreTimeout);
      restoreTimeout = setTimeout(() => {
        console.error("maplibre: context not restored in time, remounting map");
        setMapGeneration((g) => g + 1);
      }, 3000);
    };
    const handleContextRestored = () => {
      console.info("maplibre: WebGL context restored");
      if (restoreTimeout) {
        clearTimeout(restoreTimeout);
        restoreTimeout = null;
      }
    };
    canvas.addEventListener("webglcontextlost", handleContextLost, false);
    canvas.addEventListener("webglcontextrestored", handleContextRestored, false);

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      if (restoreTimeout) clearTimeout(restoreTimeout);
      map.remove();
      mapRef.current = null;
    };
    // mapGeneration の変化でこの effect を再実行し、コンテナDOM（key指定）+ Mapインスタンスの
    // 両方を作り直す。
  }, [mapGeneration]);

  // 県クラスタ（発祥+本場の合流データから、県ごとの重心と件数を算出）。
  // 県座標マスタは新設せず、ピン群の重心をその場で計算する（データ駆動。やらないこと参照）。
  const prefClusters = useMemo<PrefCluster[]>(() => {
    const byPref = new Map<string, MapPin[]>();
    for (const item of items) {
      if (!item.originPref) continue;
      const list = byPref.get(item.originPref) ?? [];
      list.push(item);
      byPref.set(item.originPref, list);
    }
    return [...byPref.entries()].map(([pref, list]) => ({
      pref,
      lat: list.reduce((sum, i) => sum + i.lat, 0) / list.length,
      lng: list.reduce((sum, i) => sum + i.lng, 0) / list.length,
      count: list.length,
    }));
  }, [items]);

  // 実際の map の zoom を単一の真実の情報源にして isClusterView を切り替える。
  // クリック起点（集約マーカーのタップ）でもピンチズーム起点でも同じ規則で
  // 切り替わるようにするため、状態遷移をクリックハンドラ側では持たない。
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const evaluate = () => {
      const clusterView = map.getZoom() < CLUSTER_ZOOM_THRESHOLD;
      setIsClusterView((prev) => (prev === clusterView ? prev : clusterView));
    };

    if (map.isStyleLoaded()) evaluate();
    else map.once("load", evaluate);

    map.on("zoomend", evaluate);
    return () => {
      map.off("zoomend", evaluate);
    };
  }, [mapGeneration]);

  // 集約マーカーのタップで、その県のピン群が収まる範囲へズームする
  // （2026-09 全国表示の作り直し。旧・ディフォルメ地図の県選択に相当）。
  const flyToPrefecture = useCallback(
    (pref: string) => {
      const map = mapRef.current;
      if (!map) return;
      const targets = items.filter((i) => i.originPref === pref);
      if (targets.length === 0) return;

      // LngLatBounds のコンストラクタは名前空間インポート経由だと解決できず落ちるため、
      // クラスを使わず配列形式（LngLatBoundsLike）で渡す。
      const lngs = targets.map((i) => i.lng);
      const lats = targets.map((i) => i.lat);
      const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
      const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];

      map.fitBounds([sw, ne], {
        // ボトムシートのsnapは頻繁に変わるため、マーカー再生成を避けるべく
        // ref経由で最新値だけ読む（依存配列に bottomInset を含めない）。
        padding: { top: 80, right: 80, bottom: Math.max(80, bottomInsetRef.current), left: 80 },
        // 集約しきい値を必ず超えるよう、1点しかない県でも寄る
        maxZoom: 9,
        duration: 600,
      });
    },
    [items],
  );

  // 全国に戻る（集約マーカー表示に戻る）。
  const flyToJapan = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    fitJapan(map, bottomInsetRef.current, 600);
  }, []);

  // ピン/集約マーカーの描画。選択状態も生成時に反映する。
  // ref に要素を溜めて後から書き換える設計は、レンダーと DOM の状態が二重管理になり
  // ずれるため採らない（アイテム数が最大でも数百なので作り直しで足りる）。
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers: maplibregl.Marker[] = [];

    const drawClusters = () => {
      // 表示位置だけをずらす軽い重なり緩和（本番体験レビュー: 本州中央でクラスタが
      // 団子状に重なり、件数が読めず下のクラスタがタップできない問題への対処）。
      // 位置の「真実」は重心のまま（flyToPrefecture は items を originPref で
      // 再フィルタするため、ここでずらした座標には依存しない）。
      // 正確な力学は不要なので、ペアごとの押し出しを数回反復するだけの簡易版にする。
      const points = prefClusters.map((c) => {
        const p = map.project([c.lng, c.lat]);
        return { x: p.x, y: p.y };
      });
      for (let iter = 0; iter < 6; iter++) {
        let moved = false;
        for (let i = 0; i < points.length; i++) {
          for (let j = i + 1; j < points.length; j++) {
            const dx = points[j].x - points[i].x;
            const dy = points[j].y - points[i].y;
            const dist = Math.hypot(dx, dy) || 0.001;
            if (dist < CLUSTER_MIN_DIST) {
              moved = true;
              const push = (CLUSTER_MIN_DIST - dist) / 2;
              const ux = dx / dist;
              const uy = dy / dist;
              points[i].x -= ux * push;
              points[i].y -= uy * push;
              points[j].x += ux * push;
              points[j].y += uy * push;
            }
          }
        }
        if (!moved) break;
      }

      prefClusters.forEach((cluster, i) => {
        const el = document.createElement("button");
        el.type = "button";
        // 集約マーカーは button 要素にしてキーボードでフォーカスできるようにする
        // （.doc/30_features/01_requirements.md F-07 / WCAG 2.2 AA）。
        // ラベル文言は従来のディフォルメ地図のラベルに準拠し、この地図の個別ピン
        // aria-label と同様に日本語決め打ちにする（マスタラベル辞書は使わない）。
        el.setAttribute("aria-label", `${cluster.pref} ${cluster.count}件。選ぶと拡大します`);
        el.className =
          "flex size-7 cursor-pointer items-center justify-center rounded-full border-2 text-xs font-semibold text-white transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2";
        el.style.backgroundColor = PIN_BASE;
        el.style.borderColor = PIN_STROKE;
        el.textContent = String(cluster.count);
        el.addEventListener("click", () => flyToPrefecture(cluster.pref));

        const { x, y } = points[i];
        markers.push(
          new maplibregl.Marker({ element: el }).setLngLat(map.unproject([x, y])).addTo(map),
        );
      });
    };

    const drawPins = () => {
      for (const item of items) {
        const el = document.createElement("button");
        el.type = "button";
        const key = mapPinKey(item);
        // 地図ピンは button 要素にしてキーボードでフォーカスできるようにする
        // （.doc/30_features/01_requirements.md F-07 / WCAG 2.2 AA）
        el.setAttribute(
          "aria-label",
          item.kind === "honba"
            ? `${item.nameJa}（${tRegion("本場")}・${item.originPref ?? ""}${item.originCity ?? ""}）`
            : `${item.nameJa}（${item.originPref ?? ""}${item.originCity ?? ""}・${item.primaryStyle ?? "系統不明"}）`,
        );

        let ringShadow: string | undefined;
        if (item.kind === "honba") {
          // 本場ピン: 中抜きの○（発祥/食材/仕込みのどれとも違う第4の記号）。
          // 塗り=紙・リング=ブランド橙（太め）・外周輪郭=既存ピンと同じ細さ
          // （CLAUDE.md「デザイン」節・作業パッケージ「本場ピン」デザイン決定）。
          el.className =
            "size-4 cursor-pointer rounded-full transition-transform hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-2";
          el.style.backgroundColor = "#fffdf7";
          el.style.border = `2px solid ${PIN_STROKE}`;
          ringShadow = `inset 0 0 0 3px ${PIN_BASE}`;
          el.style.boxShadow = ringShadow;
        } else {
          // 記号（CLAUDE.md「記号」節）: dish=●（丸）/ ingredient=■（角）。
          // 系統色はラーメン内部のみの識別軸で、それ以外は無地のブランド橙（PIN_BASE）。
          const shape = item.itemType === "ingredient" ? "rounded-[3px]" : "rounded-full";
          el.className = `size-4 cursor-pointer border-2 transition-transform hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-2 ${shape}`;
          el.style.backgroundColor = styleColor(item.primaryStyle);
          el.style.borderColor = PIN_STROKE;
        }
        if (key === selectedSlug) {
          el.style.transform = "scale(1.6)";
          el.style.zIndex = "1";
          const selectionShadow = "0 0 0 3px rgba(0,0,0,0.25)";
          el.style.boxShadow = ringShadow ? `${ringShadow}, ${selectionShadow}` : selectionShadow;
        }
        el.addEventListener("click", () => onSelect(key));

        markers.push(
          new maplibregl.Marker({ element: el }).setLngLat([item.lng, item.lat]).addTo(map),
        );
      }
    };

    const draw = () => {
      if (isClusterView) drawClusters();
      else drawPins();
    };

    // isStyleLoaded() は「初回スタイル読み込み」だけでなく、県クラスタのタップで
    // 新しいタイル範囲を読み込んでいる間も一時的に false を返す。'load' はマップの
    // 生涯で一度しか発火しないため、その場合に draw() が永久に呼ばれなくなる
    // （個別ピンが1枚も出ない不具合の原因だった）。'idle' は読み込みのたびに
    // 発火するため、初回・ズーム後の両方で安全に使える。
    if (map.isStyleLoaded()) draw();
    else map.once("idle", draw);

    return () => {
      map.off("idle", draw);
      for (const m of markers) m.remove();
    };
    // mapGeneration も依存に含め、WebGLコンテキスト喪失で地図を作り直した後もピンを再描画する。
  }, [items, selectedSlug, onSelect, tRegion, mapGeneration, isClusterView, prefClusters, flyToPrefecture]);

  // 選択地点への寄せ
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedSlug) return;
    const item = items.find((i) => i.slug === selectedSlug);
    if (!item) return;

    map.easeTo({
      center: [item.lng, item.lat],
      // シートに隠れない位置へ寄せる
      padding: { top: 0, right: 0, bottom: bottomInset, left: 0 },
      duration: 500,
    });
  }, [selectedSlug, items, bottomInset, mapGeneration]);

  return (
    <div className="absolute inset-0">
      {/* MapLibre の CSS が .maplibregl-map に position:relative を当てるため、
          absolute inset-0 で高さを取ろうとすると 0 になる。明示的にサイズを与える。
          key={mapGeneration} で WebGL コンテキスト喪失時にコンテナDOMごと作り直す。 */}
      <div key={mapGeneration} ref={containerRef} className="h-full w-full" />

      {/* 個別ピン表示中（=県が画面の主対象になる縮尺）のみ、全国表示へ戻る導線を出す
          （2026-09 全国表示の作り直し。集約マーカータップでもピンチズームでも
          同じ規則で切り替わるため、isClusterView の実測値だけを見る）。 */}
      {!isClusterView && (
        <button
          type="button"
          onClick={flyToJapan}
          className="bg-background/90 absolute top-20 right-4 z-10 rounded-lg px-3 py-2 text-xs shadow-sm backdrop-blur"
        >
          {t("backToNational")}
        </button>
      )}

      {/* 凡例。単一ジャンル絞り込み中（=系統がラーメン内部の識別軸として意味を持つとき）のみ出す
          （CLAUDE.md「デザイン」節。系統色はラーメン内部・単一ジャンル時のみの識別軸）。
          色だけに依存させないため系統名を必ず併記する */}
      {showLegend && (
        <div className="bg-background/90 pointer-events-none absolute top-16 left-4 z-10 rounded-lg p-3 text-xs shadow-sm backdrop-blur">
          <p className="mb-2 font-semibold">{t("legend")}</p>
          <ul className="space-y-1">
            {PRIMARY_STYLES.map((s) => (
              <li key={s} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block size-3 rounded-full border"
                  style={{ backgroundColor: STYLE_COLORS[s], borderColor: PIN_STROKE }}
                />
                {label.style(s)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
