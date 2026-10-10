import { CUT_DIAGRAM_DATA, type CutRegionRef, type Species } from "./cutDiagramData";
import { PIN_BASE, PIN_STROKE } from "./styles";

/**
 * 部位図（CutDiagram）。作業パッケージ「詳細ページ概念図」§1。
 *
 * 自作の線画SVG（外部画像・ライブラリ禁止）に、対象アイテムの部位だけを塗る。
 * データ駆動: どのslugでどの領域を塗るかは cutDiagramData.ts に集約し、
 * このファイルは「領域id を持つ図形をどう描くか」だけを持つ。
 * BEEF_REGION_IDS / PORK_REGION_IDS / CHICKEN_REGION_IDS が「SVG側の実在id集合」の
 * 単一の情報源（cutDiagramData.test.ts が突き合わせに使う）。
 *
 * 細部の解剖学的正確さより「どのあたりか」が一目でわかることを優先する
 * （CLAUDE.md デザイン節。黒・緑・青・紫禁止、線は#5b4a37、地は紙#fffdf7、
 * 塗りは橙#ff8f00、複数領域にまたがる場合は淡#ffc985）。
 */

const STROKE = PIN_STROKE; // #5b4a37
const PAPER = "#fffdf7";
const SOLID_FILL = PIN_BASE; // #ff8f00
const LIGHT_FILL = "#ffc985";
const NO_FILL = "none";

type Shape =
  | { kind: "rect"; x: number; y: number; w: number; h: number; rx?: number }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "path"; d: string };

type Region = { id: string; shapes: Shape[] };

function outlineShape(shape: Shape, key: string, fill: string, strokeWidth = 1.5, strokeOpacity = 1) {
  switch (shape.kind) {
    case "rect":
      return (
        <rect
          key={key}
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          rx={shape.rx ?? 6}
          fill={fill}
          stroke={STROKE}
          strokeWidth={strokeWidth}
          strokeOpacity={strokeOpacity}
          strokeLinejoin="round"
        />
      );
    case "ellipse":
      return (
        <ellipse
          key={key}
          cx={shape.cx}
          cy={shape.cy}
          rx={shape.rx}
          ry={shape.ry}
          fill={fill}
          stroke={STROKE}
          strokeWidth={strokeWidth}
          strokeOpacity={strokeOpacity}
        />
      );
    case "circle":
      return (
        <circle
          key={key}
          cx={shape.cx}
          cy={shape.cy}
          r={shape.r}
          fill={fill}
          stroke={STROKE}
          strokeWidth={strokeWidth}
          strokeOpacity={strokeOpacity}
        />
      );
    case "path":
      return (
        <path
          key={key}
          d={shape.d}
          fill={fill}
          stroke={STROKE}
          strokeWidth={strokeWidth}
          strokeOpacity={strokeOpacity}
          strokeLinejoin="round"
        />
      );
  }
}

/** clipPath の中身（塗り自体は使われず、形の合成にのみ使われる）。 */
function clipShapes(shapes: Shape[]) {
  return shapes.map((shape, i) => outlineShape(shape, `clip-${i}`, PAPER, 0));
}

function colorFor(intensityMap: Map<string, "solid" | "light">, id: string): string {
  const intensity = intensityMap.get(id);
  if (intensity === "solid") return SOLID_FILL;
  if (intensity === "light") return LIGHT_FILL;
  return NO_FILL;
}

function RegionsLayer({
  regions,
  intensityMap,
  clipId,
  quiet = false,
}: {
  regions: Region[];
  intensityMap: Map<string, "solid" | "light">;
  clipId: string;
  /** 塗らない部位の境界線を淡くする（部位が重なり合う鶏で、塗った部位を目立たせる） */
  quiet?: boolean;
}) {
  // 塗った部位を後に描き、淡い線の上に重ねる
  const ordered = quiet
    ? [...regions.filter((r) => !intensityMap.has(r.id)), ...regions.filter((r) => intensityMap.has(r.id))]
    : regions;
  return (
    <g clipPath={`url(#${clipId})`}>
      {ordered.flatMap((region) => {
        const fill = colorFor(intensityMap, region.id);
        const opacity = quiet && fill === NO_FILL ? 0.3 : 1;
        return region.shapes.map((shape, i) => outlineShape(shape, `${region.id}-${i}`, fill, 1.5, opacity));
      })}
    </g>
  );
}

function buildIntensityMap(regions: CutRegionRef[]): Map<string, "solid" | "light"> {
  const map = new Map<string, "solid" | "light">();
  for (const r of regions) map.set(r.id, r.intensity === "light" ? "light" : "solid");
  return map;
}

// -----------------------------------------------------------------------------
// 牛（beef）
// -----------------------------------------------------------------------------

const BEEF_TORSO_D =
  "M175,120 C175,90 220,75 280,75 C350,72 440,72 480,85 C515,95 535,110 538,130 " +
  "C540,150 536,175 520,195 C495,215 430,222 350,222 C280,222 210,220 185,205 " +
  "C168,195 160,175 162,150 C163,138 168,128 175,120 Z";

const BEEF_HEAD_D =
  "M178,115 C160,95 130,90 105,98 C82,105 68,122 66,145 C64,168 76,188 100,198 " +
  "C125,208 155,204 172,188 C182,178 184,150 178,115 Z";

const BEEF_TAIL_D =
  "M520,150 C545,155 566,170 579,196 C584,206 584,213 578,219 L564,215 " +
  "C554,195 539,175 514,165 Z";

const BEEF_OUTLINE_SHAPES: Shape[] = [
  { kind: "path", d: BEEF_TORSO_D },
  { kind: "path", d: BEEF_HEAD_D },
  { kind: "path", d: BEEF_TAIL_D },
  { kind: "circle", cx: 582, cy: 219, r: 11 },
  { kind: "rect", x: 225, y: 222, w: 20, h: 68, rx: 6 },
  { kind: "rect", x: 250, y: 222, w: 20, h: 68, rx: 6 },
  { kind: "rect", x: 430, y: 222, w: 20, h: 68, rx: 6 },
  { kind: "rect", x: 458, y: 222, w: 20, h: 68, rx: 6 },
];

const BEEF_REGIONS: Region[] = [
  // 正肉
  { id: "beef-neck", shapes: [{ kind: "rect", x: 175, y: 90, w: 45, h: 120 }] },
  { id: "gyutan", shapes: [{ kind: "rect", x: 72, y: 156, w: 32, h: 20, rx: 5 }] },
  { id: "hoho-niku", shapes: [{ kind: "ellipse", cx: 128, cy: 140, rx: 26, ry: 25 }] },
  { id: "chuck-roll", shapes: [{ kind: "rect", x: 215, y: 75, w: 55, h: 65 }] },
  { id: "gyu-kata", shapes: [{ kind: "rect", x: 215, y: 140, w: 55, h: 82 }] },
  { id: "top-blade", shapes: [{ kind: "rect", x: 222, y: 86, w: 26, h: 20, rx: 3 }] },
  { id: "rib-roast", shapes: [{ kind: "rect", x: 270, y: 75, w: 60, h: 65 }] },
  { id: "chuck-flap", shapes: [{ kind: "rect", x: 270, y: 178, w: 40, h: 44 }] },
  { id: "beef-short-rib", shapes: [{ kind: "rect", x: 310, y: 140, w: 110, h: 45 }] },
  { id: "sirloin", shapes: [{ kind: "rect", x: 330, y: 75, w: 65, h: 65 }] },
  { id: "beef-tenderloin", shapes: [{ kind: "rect", x: 335, y: 140, w: 55, h: 18, rx: 4 }] },
  { id: "harami", shapes: [{ kind: "rect", x: 310, y: 185, w: 55, h: 37 }] },
  { id: "sagari", shapes: [{ kind: "rect", x: 365, y: 185, w: 40, h: 37 }] },
  { id: "rump", shapes: [{ kind: "rect", x: 395, y: 75, w: 55, h: 65 }] },
  { id: "top-sirloin-cap", shapes: [{ kind: "rect", x: 430, y: 90, w: 30, h: 24, rx: 3 }] },
  { id: "knuckle", shapes: [{ kind: "rect", x: 405, y: 140, w: 45, h: 45 }] },
  { id: "tri-tip", shapes: [{ kind: "rect", x: 405, y: 185, w: 45, h: 37 }] },
  { id: "bottom-flap", shapes: [{ kind: "rect", x: 450, y: 140, w: 68, h: 60 }] },
  {
    id: "oxtail",
    shapes: [{ kind: "path", d: BEEF_TAIL_D }, { kind: "circle", cx: 582, cy: 219, r: 11 }],
  },
  {
    id: "beef-shank",
    shapes: [
      { kind: "rect", x: 225, y: 222, w: 20, h: 68, rx: 6 },
      { kind: "rect", x: 250, y: 222, w: 20, h: 68, rx: 6 },
      { kind: "rect", x: 430, y: 222, w: 20, h: 68, rx: 6 },
      { kind: "rect", x: 458, y: 222, w: 20, h: 68, rx: 6 },
    ],
  },
  // 内臓: 4つの胃を前から順に（ミノ→ハチノス→センマイ→ギアラ）
  { id: "mino", shapes: [{ kind: "ellipse", cx: 288, cy: 205, rx: 22, ry: 14 }] },
  { id: "hachinosu", shapes: [{ kind: "ellipse", cx: 323, cy: 203, rx: 18, ry: 13 }] },
  { id: "senmai", shapes: [{ kind: "ellipse", cx: 353, cy: 203, rx: 16, ry: 12 }] },
  { id: "giara", shapes: [{ kind: "ellipse", cx: 380, cy: 205, rx: 16, ry: 12 }] },
  { id: "gyu-hatsu", shapes: [{ kind: "circle", cx: 300, cy: 175, r: 13 }] },
  { id: "gyu-reba", shapes: [{ kind: "ellipse", cx: 335, cy: 172, rx: 22, ry: 15 }] },
  { id: "gyu-mame", shapes: [{ kind: "ellipse", cx: 365, cy: 178, rx: 13, ry: 9 }] },
  { id: "gyu-kobukuro", shapes: [{ kind: "ellipse", cx: 393, cy: 182, rx: 12, ry: 9 }] },
  {
    id: "marucho",
    shapes: [
      {
        kind: "path",
        d: "M250,200 C255,190 270,188 278,196 C286,204 284,214 274,218 C266,221 258,218 254,212 C250,207 248,204 250,200 Z",
      },
    ],
  },
  {
    id: "shimacho",
    shapes: [
      {
        kind: "path",
        d: "M330,205 C338,195 355,193 365,200 C375,207 373,217 360,220 C348,223 336,220 331,213 C328,209 328,207 330,205 Z",
      },
    ],
  },
];

export const BEEF_REGION_IDS = BEEF_REGIONS.map((r) => r.id);

function BeefDiagram({ ariaLabel, intensityMap }: { ariaLabel: string; intensityMap: Map<string, "solid" | "light"> }) {
  return (
    <svg viewBox="0 0 640 320" role="img" aria-label={ariaLabel} className="h-auto w-full">
      <defs>
        <clipPath id="beef-clip">{clipShapes(BEEF_OUTLINE_SHAPES)}</clipPath>
      </defs>
      <rect x={0} y={0} width={640} height={320} fill={PAPER} />
      {BEEF_OUTLINE_SHAPES.map((s, i) => outlineShape(s, `outline-${i}`, PAPER))}
      {/* 耳（装飾。牛の耳に該当部位なし） */}
      <path d="M108,95 C112,78 122,68 132,72 C138,86 130,98 116,100 Z" fill={PAPER} stroke={STROKE} strokeWidth={1.5} />
      <circle cx={118} cy={138} r={3.5} fill={STROKE} />
      <RegionsLayer regions={BEEF_REGIONS} intensityMap={intensityMap} clipId="beef-clip" />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// 豚（pork）
// -----------------------------------------------------------------------------

const PORK_TORSO_D =
  "M175,110 C175,85 215,72 270,72 C340,70 420,70 460,85 C495,97 515,112 518,132 " +
  "C520,150 516,172 500,190 C475,208 415,214 340,214 C270,214 205,212 185,198 " +
  "C168,188 160,168 162,148 C163,135 168,120 175,110 Z";

const PORK_HEAD_D =
  "M178,108 C158,90 125,85 100,95 C78,104 65,122 65,145 C65,166 78,184 100,193 " +
  "C122,201 152,196 170,182 C180,172 183,145 178,108 Z";

const PORK_EAR_D = "M100,92 C90,75 100,60 118,62 C130,64 132,82 122,95 C114,102 104,100 100,92 Z";

const PORK_TAIL_D =
  "M505,95 C518,88 526,96 522,106 C518,114 508,112 508,104 C508,100 506,97 505,95 Z";

const PORK_LEG_TOP: Shape[] = [
  { kind: "rect", x: 205, y: 214, w: 20, h: 31 },
  { kind: "rect", x: 235, y: 214, w: 20, h: 31 },
  { kind: "rect", x: 430, y: 214, w: 20, h: 31 },
  { kind: "rect", x: 460, y: 214, w: 20, h: 31 },
];

const TONSOKU_SHAPES: Shape[] = [
  { kind: "rect", x: 205, y: 245, w: 20, h: 35, rx: 5 },
  { kind: "rect", x: 235, y: 245, w: 20, h: 35, rx: 5 },
  { kind: "rect", x: 430, y: 245, w: 20, h: 35, rx: 5 },
  { kind: "rect", x: 460, y: 245, w: 20, h: 35, rx: 5 },
];

const PORK_OUTLINE_SHAPES: Shape[] = [
  { kind: "path", d: PORK_TORSO_D },
  { kind: "path", d: PORK_HEAD_D },
  { kind: "path", d: PORK_EAR_D },
  { kind: "path", d: PORK_TAIL_D },
  ...PORK_LEG_TOP,
  ...TONSOKU_SHAPES,
];

const PORK_REGIONS: Region[] = [
  { id: "buta-tan", shapes: [{ kind: "rect", x: 80, y: 156, w: 26, h: 16, rx: 4 }] },
  { id: "tontoro", shapes: [{ kind: "ellipse", cx: 118, cy: 170, rx: 24, ry: 18 }] },
  { id: "kashira", shapes: [{ kind: "ellipse", cx: 128, cy: 122, rx: 28, ry: 24 }] },
  { id: "mimiga", shapes: [{ kind: "path", d: PORK_EAR_D }] },
  { id: "pork-shoulder-loin", shapes: [{ kind: "rect", x: 210, y: 85, w: 55, h: 60 }] },
  { id: "pork-shoulder", shapes: [{ kind: "rect", x: 210, y: 145, w: 55, h: 69 }] },
  { id: "pork-loin", shapes: [{ kind: "rect", x: 265, y: 80, w: 90, h: 65 }] },
  { id: "spare-rib", shapes: [{ kind: "rect", x: 265, y: 145, w: 55, h: 45 }] },
  { id: "pork-belly", shapes: [{ kind: "rect", x: 320, y: 145, w: 110, h: 69 }] },
  { id: "pork-tenderloin", shapes: [{ kind: "rect", x: 300, y: 138, w: 60, h: 16, rx: 4 }] },
  { id: "pork-leg", shapes: [{ kind: "rect", x: 395, y: 80, w: 70, h: 134 }] },
  { id: "pork-outside-round", shapes: [{ kind: "rect", x: 440, y: 150, w: 45, h: 64 }] },
  { id: "tonsoku", shapes: TONSOKU_SHAPES },
  { id: "gatsu", shapes: [{ kind: "ellipse", cx: 300, cy: 175, rx: 26, ry: 18 }] },
  { id: "buta-reba", shapes: [{ kind: "ellipse", cx: 340, cy: 170, rx: 22, ry: 15 }] },
  { id: "buta-hatsu", shapes: [{ kind: "circle", cx: 370, cy: 165, r: 13 }] },
  { id: "buta-mame", shapes: [{ kind: "ellipse", cx: 355, cy: 192, rx: 13, ry: 9 }] },
  { id: "buta-kobukuro", shapes: [{ kind: "ellipse", cx: 385, cy: 195, rx: 11, ry: 8 }] },
  {
    id: "buta-shocho",
    shapes: [
      {
        kind: "path",
        d: "M280,195 C286,186 300,184 308,192 C316,200 313,210 302,213 C293,215 284,212 280,206 C277,202 277,199 280,195 Z",
      },
    ],
  },
  {
    id: "buta-daicho",
    shapes: [
      {
        kind: "path",
        d: "M320,198 C328,189 344,187 354,194 C364,201 361,211 349,214 C338,217 326,214 321,208 C318,204 317,201 320,198 Z",
      },
    ],
  },
];

export const PORK_REGION_IDS = PORK_REGIONS.map((r) => r.id);

function PorkDiagram({ ariaLabel, intensityMap }: { ariaLabel: string; intensityMap: Map<string, "solid" | "light"> }) {
  return (
    <svg viewBox="0 0 640 300" role="img" aria-label={ariaLabel} className="h-auto w-full">
      <defs>
        <clipPath id="pork-clip">{clipShapes(PORK_OUTLINE_SHAPES)}</clipPath>
      </defs>
      <rect x={0} y={0} width={640} height={300} fill={PAPER} />
      {PORK_OUTLINE_SHAPES.map((s, i) => outlineShape(s, `outline-${i}`, PAPER))}
      <ellipse cx={68} cy={148} rx={9} ry={7} fill={PAPER} stroke={STROKE} strokeWidth={1.5} />
      <circle cx={122} cy={112} r={3.5} fill={STROKE} />
      <RegionsLayer regions={PORK_REGIONS} intensityMap={intensityMap} clipId="pork-clip" />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// 鶏（chicken）
// -----------------------------------------------------------------------------

// 鶏は横向き（頭が左）の一羽として描く（2026-10-10 描き直し）。旧図は部位の円を並べた塊で、
// 翼が背中の縁に付き鳥に見えなかった。翼は胴の側面に3節（手羽元→手羽中→手羽先）で重ね、
// むねは胴の前下、ももは後ろ下から脚へつなぐ。内臓は胴の中ほど（むねとももの間）に置く。
// 部位が重なり合うため、塗らない部位の線は淡く描く（RegionsLayer の quiet）。
const CHICKEN_BODY_D =
  "M150,150 C150,205 185,265 250,280 C300,292 350,282 380,252 C405,226 410,186 400,160 " +
  "C392,140 370,128 340,124 C300,118 250,115 205,118 C178,120 152,128 150,150 Z";

const CHICKEN_NECK_D = "M92,92 C104,120 124,140 152,150 C160,135 180,122 205,118 C176,108 154,88 140,62 Z";

const CHICKEN_TAIL_D =
  "M392,150 C405,118 428,92 456,82 C452,108 444,134 424,156 C440,148 456,146 468,150 " +
  "C456,172 432,186 404,186 Z";

// もも下の脚（ドラムスティック）
const CHICKEN_SHANK_D = "M300,266 C298,288 304,304 311,318 L329,318 C333,300 339,284 342,264 Z";

const CHICKEN_HEAD: Shape = { kind: "circle", cx: 112, cy: 70, r: 30 };

const CHICKEN_OUTLINE_SHAPES: Shape[] = [
  { kind: "path", d: CHICKEN_BODY_D },
  { kind: "path", d: CHICKEN_NECK_D },
  { kind: "path", d: CHICKEN_TAIL_D },
  { kind: "path", d: CHICKEN_SHANK_D },
  CHICKEN_HEAD,
];

// 翼の外形（装飾。部位は3節に分けて塗る）
const CHICKEN_WING_D =
  "M208,158 C214,138 260,132 302,140 C342,147 370,158 382,172 C362,186 302,192 262,188 C232,185 206,178 208,158 Z";

const CHICKEN_REGIONS: Region[] = [
  // 首: せせり（首の肉）と皮（焼き鳥の「皮」は首皮が多い）
  { id: "seseri", shapes: [{ kind: "ellipse", cx: 140, cy: 112, rx: 20, ry: 30 }] },
  { id: "kawa", shapes: [{ kind: "path", d: "M140,62 C154,88 176,108 205,118 L198,130 C170,120 146,98 130,70 Z" }] },
  // 胴の前下: むね・ささみ・やげん軟骨（胸骨の先）
  { id: "tori-mune", shapes: [{ kind: "ellipse", cx: 198, cy: 224, rx: 46, ry: 44 }] },
  { id: "sasami", shapes: [{ kind: "ellipse", cx: 210, cy: 244, rx: 24, ry: 10 }] },
  { id: "yagen-nankotsu", shapes: [{ kind: "ellipse", cx: 204, cy: 253, rx: 13, ry: 8 }] },
  // 翼: 付け根（ふりそで）→ 手羽元 → 手羽中 → 手羽先
  { id: "furisode", shapes: [{ kind: "ellipse", cx: 204, cy: 162, rx: 16, ry: 14 }] },
  { id: "tebamoto", shapes: [{ kind: "ellipse", cx: 244, cy: 162, rx: 26, ry: 22 }] },
  { id: "tebanaka", shapes: [{ kind: "ellipse", cx: 292, cy: 166, rx: 26, ry: 21 }] },
  { id: "tebasaki", shapes: [{ kind: "path", d: "M318,158 C342,150 368,158 382,172 C362,184 336,186 318,180 Z" }] },
  // 胴の後ろ下: もも（脚の付け根から下）とひざ軟骨
  {
    id: "tori-momo",
    shapes: [
      { kind: "ellipse", cx: 318, cy: 242, rx: 42, ry: 36 },
      { kind: "path", d: CHICKEN_SHANK_D },
    ],
  },
  { id: "hiza-nankotsu", shapes: [{ kind: "ellipse", cx: 321, cy: 298, rx: 12, ry: 9 }] },
  // 尾の付け根: ぼんじり
  { id: "bonjiri", shapes: [{ kind: "ellipse", cx: 396, cy: 172, rx: 16, ry: 14 }] },
  // 内臓（むねとももの間）
  { id: "hatsumoto", shapes: [{ kind: "ellipse", cx: 244, cy: 202, rx: 7, ry: 5 }] },
  { id: "tori-hatsu", shapes: [{ kind: "circle", cx: 252, cy: 216, r: 10 }] },
  { id: "reba", shapes: [{ kind: "ellipse", cx: 274, cy: 226, rx: 17, ry: 11 }] },
  { id: "sunagimo", shapes: [{ kind: "ellipse", cx: 268, cy: 252, rx: 15, ry: 11 }] },
];

export const CHICKEN_REGION_IDS = CHICKEN_REGIONS.map((r) => r.id);

function ChickenDiagram({ ariaLabel, intensityMap }: { ariaLabel: string; intensityMap: Map<string, "solid" | "light"> }) {
  return (
    <svg viewBox="0 0 480 350" role="img" aria-label={ariaLabel} className="h-auto w-full">
      <defs>
        <clipPath id="chicken-clip">{clipShapes(CHICKEN_OUTLINE_SHAPES)}</clipPath>
      </defs>
      <rect x={0} y={0} width={480} height={350} fill={PAPER} />
      {/* とさか・肉垂れ・くちばし（装飾。部位なし）は頭の下に描いて輪郭を頭で閉じる */}
      <path
        d="M98,46 C96,32 108,28 112,40 C114,26 128,26 128,40 C134,30 146,36 138,48 Z"
        fill={PAPER}
        stroke={STROKE}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path d="M96,92 C90,106 100,114 108,98 Z" fill={PAPER} stroke={STROKE} strokeWidth={1.5} strokeLinejoin="round" />
      {CHICKEN_OUTLINE_SHAPES.map((s, i) => outlineShape(s, `outline-${i}`, PAPER))}
      <path d="M84,62 L60,71 L85,79 Z" fill={PAPER} stroke={STROKE} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={104} cy={64} r={3.5} fill={STROKE} />
      {/* 足（装飾） */}
      <path
        d="M314,318 L304,340 M304,340 L292,342 M304,340 L310,344 M326,318 L336,340 M336,340 L348,342 M336,340 L330,344"
        stroke={STROKE}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <RegionsLayer regions={CHICKEN_REGIONS} intensityMap={intensityMap} clipId="chicken-clip" quiet />
      {/* 翼の外形は部位の上に重ねて、どこが翼かを常に見せる */}
      <path d={CHICKEN_WING_D} fill="none" stroke={STROKE} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// 公開コンポーネント
// -----------------------------------------------------------------------------

export type CutDiagramProps = {
  /** アイテムのslug。cutDiagramData.ts の対応表を引く鍵。 */
  slug: string;
  /** 図の下に出す部位名（1行。呼び出し側でロケール解決済みの表示文字列）。 */
  label: string;
  /** role="img" に付ける aria-label（例: 「牛の部位図: サーロインの位置」）。 */
  ariaLabel: string;
};

type SpeciesDiagramProps = { ariaLabel: string; intensityMap: Map<string, "solid" | "light"> };

const SPECIES_DIAGRAM: Record<Species, (props: SpeciesDiagramProps) => ReturnType<typeof BeefDiagram>> = {
  beef: BeefDiagram,
  pork: PorkDiagram,
  chicken: ChickenDiagram,
};

export function CutDiagram({ slug, label, ariaLabel }: CutDiagramProps) {
  const entry = CUT_DIAGRAM_DATA[slug];
  if (!entry) return null;

  const intensityMap = buildIntensityMap(entry.regions);
  const Diagram = SPECIES_DIAGRAM[entry.species];

  return (
    <figure className="mx-auto mb-8 w-full max-w-[560px]">
      <Diagram ariaLabel={ariaLabel} intensityMap={intensityMap} />
      <figcaption className="mt-2 text-center text-sm font-medium" style={{ color: "#5b4a37" }}>
        {label}
      </figcaption>
    </figure>
  );
}
