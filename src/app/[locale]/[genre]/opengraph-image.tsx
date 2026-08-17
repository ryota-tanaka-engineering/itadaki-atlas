import { ImageResponse } from "next/og";

import { OG_SIZE, OgFrame, ogFonts } from "@/lib/og";
import { PRIMARY_STYLES, STYLE_COLORS } from "@/features/map/styles";
import { createStaticClient } from "@/lib/supabase/static";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Itadaki Atlas";

type Params = { locale: string; genre: string };

export default async function Image({ params }: { params: Promise<Params> }) {
  const { locale, genre } = await params;
  const db = createStaticClient();

  const [{ data: g }, { count }] = await Promise.all([
    db.from("genres").select("slug, name_ja, name_en").eq("slug", genre).maybeSingle(),
    db
      .from("food_items")
      .select("id, genres!inner(slug)", { count: "exact", head: true })
      .eq("genres.slug", genre),
  ]);

  const isJa = locale === "ja";
  const name = isJa ? (g?.name_ja ?? genre) : (g?.name_en ?? genre);
  const title = isJa ? `ご当地${name}一覧` : `Types of ${name}`;
  const subtitle = isJa ? `${count ?? 0}種` : `${count ?? 0} regional varieties`;

  const allText = `ITADAKI ATLAS 日本の食の地理データベース${title}${subtitle}`;

  return new ImageResponse(
    (
      <OgFrame style={null}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 80, fontWeight: 700, lineHeight: 1.15 }}>{title}</div>
          <div style={{ fontSize: 40, color: "#5d534a" }}>{subtitle}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
            {PRIMARY_STYLES.map((s) => (
              <span
                key={s}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: STYLE_COLORS[s],
                  border: "2px solid #3a2f27",
                }}
              />
            ))}
          </div>
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts: await ogFonts(allText) },
  );
}
