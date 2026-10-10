import { ImageResponse } from "next/og";

import { OG_SIZE, OgFrame, ogFonts } from "@/lib/og";
import { clip, prefLabel } from "@/lib/ogLabels";
import { prefFromSlug } from "@/lib/prefectures";
import { createStaticClient } from "@/lib/supabase/static";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Itadaki Atlas";

type Params = { locale: string; pref: string };

/**
 * 県ページの共有カード（2026-10-10）。「{県}の食」＋件数＋総論の冒頭。
 * 総論（prefecture_intros）が未投入・テーブル未作成なら件数だけにする。
 */
export default async function Image({ params }: { params: Promise<Params> }) {
  const { locale, pref: slug } = await params;
  const pref = prefFromSlug(slug) ?? slug;
  const db = createStaticClient();
  const isJa = locale === "ja";

  const [{ count }, introRes] = await Promise.all([
    db.from("food_items").select("id", { count: "exact", head: true }).eq("origin_pref", pref),
    db.from("prefecture_intros").select("locale, intro").eq("pref", pref),
  ]);
  const intros = (introRes.error ? [] : (introRes.data ?? [])) as { locale: string; intro: string }[];
  const intro = intros.find((r) => r.locale === locale)?.intro ?? intros.find((r) => r.locale === "ja")?.intro ?? null;

  const name = prefLabel(locale, pref);
  const title = isJa ? `${name}の食` : `What to eat in ${name}`;
  const subtitle = isJa ? `この土地で生まれた ${count ?? 0}件` : `${count ?? 0} foods born here`;
  const lead = clip(intro, isJa ? 70 : 140);

  return new ImageResponse(
    (
      <OgFrame style={null}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.15 }}>{title}</div>
          <div style={{ fontSize: 36, color: "#7a6a58" }}>{subtitle}</div>
          {lead && <div style={{ fontSize: 30, lineHeight: 1.5, marginTop: 18 }}>{lead}</div>}
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts: await ogFonts(`ITADAKI ATLAS 日本の食の地理データベース${title}${subtitle}${lead ?? ""}`) },
  );
}
