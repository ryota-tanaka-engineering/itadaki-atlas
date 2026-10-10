import { ImageResponse } from "next/og";

import { OG_SIZE, OgFrame, ogFonts } from "@/lib/og";
import { clip } from "@/lib/ogLabels";
import { createStaticClient } from "@/lib/supabase/static";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Itadaki Atlas";

type Params = { locale: string; slug: string };

/** タグページの共有カード（2026-10-10）。タグ名＋件数＋定義（定義は日本語のみの列なので ja だけ）。 */
export default async function Image({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  const db = createStaticClient();
  const isJa = locale === "ja";

  const [{ data: tag }, { count }] = await Promise.all([
    db.from("tags").select("slug, name_ja, name_en, definition").eq("slug", slug).maybeSingle(),
    db.from("food_item_tags").select("tag_slug", { count: "exact", head: true }).eq("tag_slug", slug),
  ]);

  const title = isJa ? (tag?.name_ja ?? slug) : (tag?.name_en ?? slug);
  const sub = isJa ? (tag?.name_en ?? "") : (tag?.name_ja ?? "");
  const subtitle = isJa ? `${count ?? 0}件` : `${count ?? 0} entries`;
  const lead = isJa ? clip(tag?.definition, 70) : null;

  return new ImageResponse(
    (
      <OgFrame style={null}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 80, fontWeight: 700, lineHeight: 1.15 }}>{title}</div>
          <div style={{ fontSize: 36, color: "#7a6a58" }}>{`${sub}${sub ? " ・ " : ""}${subtitle}`}</div>
          {lead && <div style={{ fontSize: 30, lineHeight: 1.5, marginTop: 18 }}>{lead}</div>}
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts: await ogFonts(`ITADAKI ATLAS 日本の食の地理データベース${title}${sub} ・ ${subtitle}${lead ?? ""}`) },
  );
}
