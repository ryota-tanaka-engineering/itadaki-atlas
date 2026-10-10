import { ImageResponse } from "next/og";

import { OG_SIZE, OgFrame, ogFonts } from "@/lib/og";
import { clip, sceneLabel } from "@/lib/ogLabels";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Itadaki Atlas";

type Params = { locale: string; scene: string };

/** 場面ページの共有カード（2026-10-10）。「食べに行く前に」＋場面名＋一行説明（辞書から。DB 不要）。 */
export default async function Image({ params }: { params: Promise<Params> }) {
  const { locale, scene } = await params;
  const isJa = locale === "ja";
  const { name, intro } = sceneLabel(locale, scene);
  const eyebrow = isJa ? "食べに行く前に" : "Before you go";
  const lead = clip(intro, isJa ? 70 : 140);

  return new ImageResponse(
    (
      <OgFrame style={null}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 34, color: "#e56000" }}>{eyebrow}</div>
          <div style={{ fontSize: 80, fontWeight: 700, lineHeight: 1.15 }}>{name}</div>
          {lead && <div style={{ fontSize: 30, lineHeight: 1.5, marginTop: 18 }}>{lead}</div>}
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts: await ogFonts(`ITADAKI ATLAS 日本の食の地理データベース${eyebrow}${name}${lead ?? ""}`) },
  );
}
