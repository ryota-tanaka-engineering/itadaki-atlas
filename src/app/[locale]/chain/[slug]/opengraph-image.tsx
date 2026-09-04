import { ImageResponse } from "next/og";

import { OG_SIZE, OgFrame, ogFonts } from "@/lib/og";
import { createStaticClient } from "@/lib/supabase/static";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Itadaki Atlas";

type Params = { locale: string; slug: string };

export default async function Image({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  const db = createStaticClient();

  const { data } = await db
    .from("chains")
    .select("name_ja, name_en, style_ja, style_en")
    .eq("slug", slug)
    .maybeSingle();

  const isJa = locale === "ja";
  const title = isJa ? (data?.name_ja ?? slug) : (data?.name_en ?? slug);
  const style = isJa ? data?.style_ja : data?.style_en;
  const label = isJa ? "チェーン" : "Chain";

  const allText = `ITADAKI ATLAS 日本の食の地理データベース${title}${label}${style ?? ""}`;

  return new ImageResponse(
    (
      <OgFrame style={null}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 32, color: "#7a6a58", letterSpacing: 2 }}>{label}</div>
          <div style={{ fontSize: 80, fontWeight: 700, lineHeight: 1.15 }}>{title}</div>
          {style && <div style={{ fontSize: 38, color: "#7a6a58" }}>{style}</div>}
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts: await ogFonts(allText) },
  );
}
