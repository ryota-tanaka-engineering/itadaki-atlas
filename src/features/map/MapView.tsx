"use client";

import { useEffect, useRef, useState } from "react";
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

const JAPAN_BOUNDS: [number, number, number, number] = [122.9, 20.4, 154.0, 45.6];

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
  /** ディフォルメ地図で県を選んだとき、その県の範囲へ寄せる（seq は再選択の識別用） */
  focus: { pref: string; seq: number } | null;
  /** 系統凡例の表示可否（ラーメン内部・単一ジャンル絞り込み時のみ。CLAUDE.md「デザイン」節）。 */
  showLegend: boolean;
};

export function MapView({
  items,
  selectedSlug,
  onSelect,
  bottomInset,
  focus,
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
      fitBoundsOptions: { padding: 24 },
      maxBounds: [
        [JAPAN_BOUNDS[0] - 8, JAPAN_BOUNDS[1] - 8],
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

  // ピンの描画。選択状態も生成時に反映する。
  // ref に要素を溜めて後から書き換える設計は、レンダーと DOM の状態が二重管理になり
  // ずれるため採らない（アイテム数が最大でも数百なので作り直しで足りる）。
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers: maplibregl.Marker[] = [];

    const draw = () => {
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

    if (map.isStyleLoaded()) draw();
    else map.once("load", draw);

    return () => {
      for (const m of markers) m.remove();
    };
    // mapGeneration も依存に含め、WebGLコンテキスト喪失で地図を作り直した後もピンを再描画する。
  }, [items, selectedSlug, onSelect, tRegion, mapGeneration]);

  // ディフォルメ地図で選ばれた県の範囲へ寄せる
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    const targets = items.filter((i) => i.originPref === focus.pref);
    if (targets.length === 0) return;

    // LngLatBounds のコンストラクタは名前空間インポート経由だと解決できず落ちるため、
    // クラスを使わず配列形式（LngLatBoundsLike）で渡す。
    const lngs = targets.map((t) => t.lng);
    const lats = targets.map((t) => t.lat);
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];

    map.fitBounds([sw, ne], {
      padding: { top: 80, right: 80, bottom: Math.max(80, bottomInset), left: 80 },
      // ディフォルメ地図の閾値を必ず超えるよう、1点しかない県でも寄る
      maxZoom: 9,
      duration: 600,
    });
  }, [focus, items, bottomInset, mapGeneration]);

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
