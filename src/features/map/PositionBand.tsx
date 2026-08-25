"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { buildAtlasLayers, ensurePmtilesProtocol, PMTILES_URL } from "./MapView";
import { PIN_BASE, PIN_STROKE } from "./styles";
import { formatDegMinCoord } from "./geo";

/**
 * 詳細ページの「位置帯」（CLAUDE.md「詳細ページの確定構造」2節）。
 *
 * 一覧の地図（MapView）とは役割が違う（発祥地1点を示すだけの非インタラクティブな
 * 帯）ため、独立コンポーネントにする。トーン・タイル配信元は MapView と共通化し、
 * ベンダ固有APIの直書きを避ける。**経緯線グリッドは出さない**（確定デザイン）。
 */
type Props = {
  lat: number;
  lng: number;
  /** 地名ラベル（発祥県＋市区町村。ロケール済みの表示文字列を呼び出し側で組み立てる） */
  label: string;
};

export function PositionBand({ lat, lng, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    ensurePmtilesProtocol();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
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
      center: [lng, lat],
      zoom: 7,
      // 位置帯は発祥地1点を示すだけの静止画的な用途。操作させない
      // （CLAUDE.md「軽さ優先で静的表示（interactive: false）でよい」）。
      interactive: false,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    map.on("error", (e) => {
      // 空catchで潰さない（ia-nextjs-standards のエラー可視化ルール）
      console.error("maplibre:", e.error);
    });

    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.className = "size-4 rounded-full border-2";
    el.style.backgroundColor = PIN_BASE;
    el.style.borderColor = PIN_STROKE;
    new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng]);

  return (
    <div
      className="relative h-14 w-full overflow-hidden md:h-full md:rounded-2xl"
      style={{ backgroundColor: "#efe8da" }}
    >
      {/* 地図自体は装飾（発祥地はテキストラベル+座標で明示済み）。
          MapLibre の CSS が .maplibregl-map に position:relative を当てるため、
          absolute inset-0 で高さを取ろうとすると 0 になる（MapView.tsx と同じ注意点）。
          明示的にサイズを与える。 */}
      <div ref={containerRef} className="h-full w-full" aria-hidden="true" />

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
        style={{ color: "#5b4a37" }}
      >
        <span className="truncate rounded px-1.5 py-0.5 font-medium" style={{ backgroundColor: "#fffdf7e6" }}>
          {label}
        </span>
        <span
          className="shrink-0 rounded px-1.5 py-0.5 tabular-nums"
          style={{ backgroundColor: "#fffdf7e6" }}
        >
          {formatDegMinCoord(lat, lng)}
        </span>
      </div>
    </div>
  );
}
