"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import * as maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { layers, namedFlavor } from "@protomaps/basemaps";
import "maplibre-gl/dist/maplibre-gl.css";

import type { MapItem } from "./queries";
import { PIN_STROKE, PRIMARY_STYLES, STYLE_COLORS, styleColor } from "./styles";
import { useMasterLabels } from "./labels";

/**
 * フルスクリーン地図（.doc/30_features/02_ui_ux.md §2）。
 *
 * 選択状態は親が持つ（地図・ボトムシート・索引が同じ選択を共有するため）。
 *
 * タイル配信元は差し替え可能に保つ（ポータビリティ規約）。
 * 本番は R2 の pmtiles、ローカルは public/tiles/japan.pmtiles。
 */
const PMTILES_URL = process.env.NEXT_PUBLIC_PMTILES_URL ?? "/tiles/japan.pmtiles";

const JAPAN_BOUNDS: [number, number, number, number] = [122.9, 20.4, 154.0, 45.6];

// pmtiles:// プロトコルの登録は **グローバル状態** なので、コンポーネントの
// マウント/アンマウントで付け外ししない。StrictMode の二重マウントで
// 生きている地図からハンドラが外れるため。モジュールロード時に1回だけ登録する。
let protocolRegistered = false;
function ensurePmtilesProtocol() {
  if (protocolRegistered) return;
  const protocol = new Protocol();
  // protocol.tile は v3(callback)/v4(Promise) の union で判別できないため
  // Promise 版の tilev4 を明示的に渡す。
  maplibregl.addProtocol("pmtiles", protocol.tilev4);
  protocolRegistered = true;
}

type Props = {
  items: MapItem[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
  /** ボトムシートに隠れない位置に選択地点を寄せるための下端余白 */
  bottomInset: number;
  /** ディフォルメ地図で県を選んだとき、その県の範囲へ寄せる（seq は再選択の識別用） */
  focus: { pref: string; seq: number } | null;
};

export function MapView({
  items,
  selectedSlug,
  onSelect,
  bottomInset,
  focus,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const label = useMasterLabels();
  const t = useTranslations("browse");

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
        layers: layers("protomaps", namedFlavor("light"), { lang: "ja" }),
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

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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
        // 地図ピンは button 要素にしてキーボードでフォーカスできるようにする
        // （.doc/30_features/01_requirements.md F-07 / WCAG 2.2 AA）
        el.setAttribute(
          "aria-label",
          `${item.nameJa}（${item.originPref ?? ""}${item.originCity ?? ""}・${item.primaryStyle ?? "系統不明"}）`,
        );
        el.className =
          "size-4 cursor-pointer rounded-full border-2 transition-transform hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-2";
        el.style.backgroundColor = styleColor(item.primaryStyle);
        el.style.borderColor = PIN_STROKE;
        if (item.slug === selectedSlug) {
          el.style.transform = "scale(1.6)";
          el.style.zIndex = "1";
          el.style.boxShadow = "0 0 0 3px rgba(0,0,0,0.25)";
        }
        el.addEventListener("click", () => onSelect(item.slug));

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
  }, [items, selectedSlug, onSelect]);

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
  }, [focus, items, bottomInset]);

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
  }, [selectedSlug, items, bottomInset]);

  return (
    <div className="absolute inset-0">
      {/* MapLibre の CSS が .maplibregl-map に position:relative を当てるため、
          absolute inset-0 で高さを取ろうとすると 0 になる。明示的にサイズを与える。 */}
      <div ref={containerRef} className="h-full w-full" />

      {/* 凡例。色だけに依存させないため系統名を必ず併記する */}
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
    </div>
  );
}
