import { ImageResponse } from "next/og";

import { OG_SIZE, OgFrame, ogFonts } from "@/lib/og";
import { STYLE_COLORS, type PrimaryStyle } from "@/features/map/styles";
import { createStaticClient } from "@/lib/supabase/static";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Itadaki Atlas";

type Params = { locale: string; genre: string; slug: string };

export default async function Image({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  const db = createStaticClient();

  const { data } = await db
    .from("food_items")
    .select(
      `slug, name_romaji, origin_pref, origin_city,
       food_item_translations ( locale, name ),
       dish_details ( primary_style )`,
    )
    .eq("slug", slug)
    .maybeSingle();

  const translations = data?.food_item_translations ?? [];
  const nameJa = translations.find((t) => t.locale === "ja")?.name ?? data?.name_romaji ?? slug;
  const romaji = data?.name_romaji ?? "";
  const dd = data?.dish_details;
  const style = ((Array.isArray(dd) ? dd[0] : dd)?.primary_style ?? null) as PrimaryStyle | null;
  const origin = data?.origin_pref ? `${data.origin_pref}${data.origin_city ?? ""}` : "";

  const isJa = locale === "ja";
  const title = isJa ? nameJa : romaji;
  const subtitle = isJa ? romaji : nameJa;

  const allText = `ITADAKI ATLAS 日本の食の地理データベース${title}${subtitle}${origin}${style ?? ""}発祥・`;

  return new ImageResponse(
    (
      <OgFrame style={style}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.15 }}>{title}</div>
          <div style={{ fontSize: 38, color: "#5d534a" }}>{subtitle}</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginTop: 28,
              fontSize: 28,
              color: "#5d534a",
            }}
          >
            {style && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: STYLE_COLORS[style],
                    border: "2px solid #3a2f27",
                  }}
                />
                {style}
              </span>
            )}
            {origin && <span>{isJa ? `発祥・${origin}` : origin}</span>}
          </div>
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts: await ogFonts(allText) },
  );
}
