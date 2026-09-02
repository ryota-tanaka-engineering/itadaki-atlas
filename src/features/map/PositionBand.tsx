"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { buildAtlasLayers, ensurePmtilesProtocol, JAPAN_BOUNDS, PMTILES_URL } from "./MapView";
import { PIN_BASE, PIN_STROKE } from "./styles";
import { formatDegMinCoord } from "./geo";

/**
 * 位置帯の地図スタイル（MapView と共通のトーン・タイル配信元）。
 * ベンダ固有APIの直書きを避けるため、地図の生成ロジックはこの1関数に集約する。
 */
function buildStyle(withLabels = true): maplibregl.StyleSpecification {
  return {
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
    // 全国ミニ地図では地名ラベルを出さない。この縮尺では「日本」「上海市」のような
    // 大縮尺の地名だけが残って位置表示のノイズになる（役割はピンの一点で足りる）
    layers: withLabels
      ? buildAtlasLayers()
      : buildAtlasLayers().filter((l) => l.type !== "symbol"),
  };
}

function createPinElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.className = "size-4 rounded-full border-2";
  el.style.backgroundColor = PIN_BASE;
  el.style.borderColor = PIN_STROKE;
  return el;
}

/**
 * 詳細ページの「位置帯」（CLAUDE.md「詳細ページの確定構造」2節）。
 *
 * 2026-09 作業パッケージ「位置帯 全国ミニ地図化」で再設計。本番体験レビューで
 * 「詳細に出てる地図見てもどこだか全然わからない」（都市レベル拡大図だけでは
 * 海外ユーザーに位置情報として機能しない）との指摘を受け、
 *   主: 日本全体のミニ地図に現在地の点（「日本のどこか」が一目でわかる）
 *   従: 既存の都市レベル拡大図（残すが主役にしない。PCのみ）
 *   添え: 東京駅からの距離・方位の一行
 * の3段構成にする。
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
  /** 「東京から{方位}へ約{km}km」の翻訳済み一行。東京都内相当（30km未満）は null */
  distanceLabel: string | null;
};

export function PositionBand({ lat, lng, label, distanceLabel }: Props) {
  const nationalContainerRef = useRef<HTMLDivElement>(null);
  const nationalMapRef = useRef<maplibregl.Map | null>(null);
  const cityContainerRef = useRef<HTMLDivElement>(null);
  const cityMapRef = useRef<maplibregl.Map | null>(null);

  // 主: 日本全体のミニ地図（固定ズーム・操作無効）に現在地の点を1つ。
  useEffect(() => {
    if (!nationalContainerRef.current || nationalMapRef.current) return;

    ensurePmtilesProtocol();

    const map = new maplibregl.Map({
      container: nationalContainerRef.current,
      style: buildStyle(false),
      bounds: JAPAN_BOUNDS,
      fitBoundsOptions: { padding: 8 },
      // 位置帯は「日本のどこか」を示すだけの静止画的な用途。操作させない。
      interactive: false,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    map.on("error", (e) => {
      // 空catchで潰さない（ia-nextjs-standards のエラー可視化ルール）
      console.error("maplibre:", e.error);
    });

    new maplibregl.Marker({ element: createPinElement() }).setLngLat([lng, lat]).addTo(map);

    nationalMapRef.current = map;

    return () => {
      map.remove();
      nationalMapRef.current = null;
    };
  }, [lat, lng]);

  // 従: 既存の都市レベル拡大図（PCのみ表示。SPでは全国図だけで足りる）。
  useEffect(() => {
    if (!cityContainerRef.current || cityMapRef.current) return;

    ensurePmtilesProtocol();

    const map = new maplibregl.Map({
      container: cityContainerRef.current,
      style: buildStyle(),
      center: [lng, lat],
      zoom: 7,
      interactive: false,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    map.on("error", (e) => {
      console.error("maplibre:", e.error);
    });

    new maplibregl.Marker({ element: createPinElement() }).setLngLat([lng, lat]).addTo(map);

    cityMapRef.current = map;

    return () => {
      map.remove();
      cityMapRef.current = null;
    };
  }, [lat, lng]);

  return (
    // md:h-full は親グリッド（詳細ページカバー）の items-stretch に合わせるためのもの。
    // ただし height:100% はグリッド行の auto サイズ計算に寄与しない（＝右パネルが
    // ヘッダー側の低い高さに引きずられて0になりうる）ため、2段（全国図+拡大図）が
    // 確実に収まる高さを md:min-h-72 で床として明示する。
    <div className="flex h-40 w-full flex-col gap-2 md:h-full md:min-h-72">
      {/* スクリーンリーダー向けフォールバック。地名は従（都市拡大図）にも
          テキストで出るが、SPではその段を出さないため常に1つは残す。 */}
      <span className="sr-only md:hidden">{label}</span>

      {/* 主: 全国ミニ地図 */}
      <div
        className="relative w-full flex-1 overflow-hidden md:rounded-2xl"
        style={{ backgroundColor: "#efe8da" }}
      >
        {/* 地図自体は装飾。MapLibre の CSS が .maplibregl-map に position:relative を
            当てるため、absolute inset-0 で高さを取ろうとすると 0 になる（既知の落とし穴）。
            明示的にサイズを与える。 */}
        <div ref={nationalContainerRef} className="h-full w-full" aria-hidden="true" />
      </div>

      {/* 添え: 東京駅からの距離・方位（30km未満=都内相当は出さない） */}
      {distanceLabel && (
        <p className="shrink-0 px-0.5 text-xs tabular-nums" style={{ color: "#5b4a37" }}>
          {distanceLabel}
        </p>
      )}

      {/* 従: 既存の都市レベル拡大図（PCのみ。CLAUDE.md「軽さ優先で静的表示でよい」） */}
      <div
        className="relative hidden h-20 w-full shrink-0 overflow-hidden md:block md:rounded-2xl"
        style={{ backgroundColor: "#efe8da" }}
      >
        <div ref={cityContainerRef} className="h-full w-full" aria-hidden="true" />

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
    </div>
  );
}
