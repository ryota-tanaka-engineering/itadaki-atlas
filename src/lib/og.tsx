import type { PrimaryStyle } from "@/features/map/styles";
import { PIN_STROKE, STYLE_COLORS } from "@/features/map/styles";

/**
 * OGP共有カードの共通部品。
 *
 * 写真を持たないサイトの、共有時の唯一の「画像」（.doc/30_features/01_requirements.md F-08）。
 * 系統色とタイポグラフィだけで資料集の格を伝える。煽り・装飾は入れない。
 */
export const OG_SIZE = { width: 1200, height: 630 };

const FONT_FAMILY = "Noto Sans JP";

/**
 * Google Fonts から表示テキスト分だけをサブセット取得する。
 * satori は woff2 を読めないため、古いUAを名乗って TTF を受け取る。
 */
export async function loadFont(text: string, weight: 400 | 700): Promise<ArrayBuffer> {
  const unique = [...new Set(text)].join("");
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(FONT_FAMILY)}:wght@${weight}&text=${encodeURIComponent(unique)}`;
  const css = await (
    await fetch(cssUrl, {
      // 古いUA → woff2 でなく TTF が返る
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1; rv:10.0)" },
    })
  ).text();
  const match = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/);
  if (!match) throw new Error("OG font fetch failed");
  return (await fetch(match[1])).arrayBuffer();
}

export function ogFonts(text: string) {
  return Promise.all([
    loadFont(text, 700).then((data) => ({ name: FONT_FAMILY, data, weight: 700 as const })),
    loadFont(text, 400).then((data) => ({ name: FONT_FAMILY, data, weight: 400 as const })),
  ]);
}

/** カードの共通レイアウト。 */
export function OgFrame({
  style,
  children,
}: {
  style?: PrimaryStyle | null;
  children: React.ReactNode;
}) {
  const accent = style ? STYLE_COLORS[style] : PIN_STROKE;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#faf8f5",
        color: "#2b2118",
        padding: "56px 64px",
        fontFamily: "Noto Sans JP",
        borderBottom: `16px solid ${accent}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 26,
          letterSpacing: 4,
        }}
      >
        ITADAKI ATLAS
        <span style={{ fontSize: 22, color: "#8a7f74", letterSpacing: 0 }}>
          日本の食の地理データベース
        </span>
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
