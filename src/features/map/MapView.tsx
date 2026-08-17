"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { layers, namedFlavor } from "@protomaps/basemaps";
import "maplibre-gl/dist/maplibre-gl.css";

import type { MapItem } from "./queries";
import { PIN_STROKE, PRIMARY_STYLES, STYLE_COLORS, styleColor } from "./styles";

/**
 * フルスクリーン地図（.doc/30_features/02_ui_ux.md §2）。
 *
 * タイル配信元は差し替え可能に保つ（ポータビリティ規約）。
 * 本番は R2 の pmtiles、ローカルは public/tiles/japan.pmtiles。
 */
const PMTILES_URL =
  process.env.NEXT_PUBLIC_PMTILES_URL ?? "/tiles/japan.pmtiles";

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
};

export function MapView({ items }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [selected, setSelected] = useState<MapItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // ブラウザが HTTP Range で単一ファイルから必要なバイト範囲だけを読む。
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
      setError(e.error?.message ?? "地図の読み込みに失敗しました");
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ピンの描画。データが変わったら差し替える。
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
        el.addEventListener("click", () => setSelected(item));

        markers.push(
          new maplibregl.Marker({ element: el }).setLngLat([item.lng, item.lat]).addTo(map),
        );
      }
    };

    if (map.loaded()) draw();
    else map.once("load", draw);

    return () => {
      for (const m of markers) m.remove();
    };
  }, [items]);

  return (
    <div className="relative h-dvh w-full">
      {/* MapLibre の CSS が .maplibregl-map に position:relative を当てるため、
          absolute inset-0 で高さを取ろうとすると 0 になる。明示的にサイズを与える。 */}
      <div ref={containerRef} className="h-full w-full" />

      {error && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive absolute inset-x-4 top-4 z-10 rounded-lg p-3 text-sm"
        >
          {error}
        </div>
      )}

      {/* 凡例。色だけに依存させないため系統名を必ず併記する */}
      <div className="bg-background/90 absolute top-4 left-4 z-10 rounded-lg p-3 text-xs shadow-sm backdrop-blur">
        <p className="mb-2 font-semibold">系統</p>
        <ul className="space-y-1">
          {PRIMARY_STYLES.map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block size-3 rounded-full border"
                style={{ backgroundColor: STYLE_COLORS[s], borderColor: PIN_STROKE }}
              />
              {s}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-2">{items.length}件</p>
      </div>

      {/* 暫定の詳細表示。M3 で3段階スナップのボトムシートに置き換える */}
      {selected && (
        <div className="bg-background absolute inset-x-0 bottom-0 z-10 rounded-t-2xl p-4 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{selected.nameJa}</h2>
              <p className="text-muted-foreground text-sm">
                {selected.nameRomaji}
                {selected.nameEn ? ` — ${selected.nameEn}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-muted-foreground shrink-0 text-sm underline"
            >
              閉じる
            </button>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            {selected.originPref}
            {selected.originCity}／{selected.primaryStyle ?? "系統不明"}
          </p>
          {selected.summary && <p className="mt-2 text-sm">{selected.summary}</p>}
        </div>
      )}
    </div>
  );
}
