import { ImageResponse } from "next/og";

import { OG_SIZE, OgFrame, ogFonts } from "@/lib/og";
import { createStaticClient } from "@/lib/supabase/static";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Itadaki Atlas";

type Params = { locale: string; slug: string };

// guides.kind の check 制約と同じ並び（messages/*.json の guide.kind と重複するが、
// OG画像生成はエッジ実行でnext-intlのサーバーAPIを使わないため、chain/[slug]/opengraph-image.tsx
// と同じ方針でここに小さくハードコードする）。
const KIND_LABEL: Record<string, { ja: string; en: string }> = {
  ordering: { ja: "注文", en: "Ordering" },
  paying: { ja: "支払い", en: "Paying" },
  manners: { ja: "マナー", en: "Manners" },
  finding: { ja: "店の見つけ方", en: "Finding a Restaurant" },
  takeaway: { ja: "持ち帰り・土産", en: "Takeaway & Souvenirs" },
  seasons: { ja: "季節・時間", en: "Seasons & Timing" },
};

export default async function Image({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  const db = createStaticClient();

  const { data } = await db
    .from("guides")
    .select("kind, guide_translations ( locale, title, summary )")
    .eq("slug", slug)
    .maybeSingle();

  const isJa = locale === "ja";
  const translations = data?.guide_translations ?? [];
  const t =
    translations.find((x) => x.locale === locale) ??
    translations.find((x) => x.locale === "en") ??
    translations.find((x) => x.locale === "ja");

  const title = t?.title ?? slug;
  const summary = t?.summary ?? null;
  const kindLabel = data?.kind ? (isJa ? KIND_LABEL[data.kind]?.ja : KIND_LABEL[data.kind]?.en) : null;

  const allText = `ITADAKI ATLAS 日本の食の地理データベース${title}${kindLabel ?? ""}${summary ?? ""}`;

  return new ImageResponse(
    (
      <OgFrame style={null}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {kindLabel && <div style={{ fontSize: 32, color: "#7a6a58", letterSpacing: 2 }}>{kindLabel}</div>}
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.2 }}>{title}</div>
          {summary && <div style={{ fontSize: 34, color: "#7a6a58" }}>{summary}</div>}
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts: await ogFonts(allText) },
  );
}
