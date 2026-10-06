import { fetchGenres, fetchPrefsWithItems, fetchShelves } from "@/features/map/queries";
import { GUIDE_KINDS } from "@/features/guide/kinds";
import { GUIDE_SCENES } from "@/features/guide/scenes";
import { SITE_URL } from "@/lib/seo";
import { PREF_SLUGS, type Prefecture } from "@/lib/prefectures";

/**
 * /llms.txt（2026-10-06。AIO: AI クローラー向けのサイト案内）。
 *
 * サイトの趣旨・編集方針・URL の規則・ジャンル一覧を1ファイルにまとめる（llmstxt.org の提案形式）。
 * sitemap と同じクエリから組み立てるので、データを足すと自動で伸びる。
 * cookie を読まない static クライアント経由なので ISR（1時間）にできる。
 */
export const revalidate = 3600;

export async function GET() {
  const [genres, shelves, prefs] = await Promise.all([fetchGenres(), fetchShelves(), fetchPrefsWithItems()]);
  const u = (path: string) => `${SITE_URL}${path}`;

  const grpLabel: Record<string, string> = {
    dish: "Dishes (born from a place)",
    ingredient: "Ingredients (raised or caught in a place)",
    preparation: "Preparations (fermented, dried, processed, brewed)",
  };
  const layerLabel: Record<string, string> = {
    dish: "dish",
    ingredient: "ingredient",
    cut: "cut / topping (not tied to a place)",
  };

  const lines: string[] = [
    "# Itadaki Atlas",
    "",
    "> A geographic reference of Japanese food: what each dish, ingredient, and preparation is, where it was born or is raised, and why it took that shape there. Bilingual (Japanese `/ja/`, English `/en/`). Not a review site, not a recipe site.",
    "",
    "## Editorial policy",
    "",
    "- Facts about ingredients, technique, and the present form are stated as facts; origins are stated as traditions (\"is said to\", \"one account holds\"). Competing accounts are given side by side.",
    "- No rankings, no \"best\", no awards. Chains are described as entry points to regional styles, never rated.",
    "- Every entry has sources (government, industry bodies, local authorities). Sources are kept as internal verification data and are not shown on pages; a correction form is linked from every page.",
    "- Names are always given as a triple: Japanese name, romanization, and an explanatory English translation (e.g. \"せせり — Seseri — chicken neck meat\").",
    "",
    "## URL patterns",
    "",
    `- Home / map: ${u("/ja")} , ${u("/en")}`,
    `- Genre or shelf list: ${u("/{locale}/{genre-or-shelf}")} (e.g. ${u("/en/ramen")})`,
    `- Dish or ingredient detail: ${u("/{locale}/{genre-or-shelf}/{slug}")} (e.g. ${u("/en/ramen/sapporo")})`,
    `- Prefecture (what to eat in …): ${u("/{locale}/region/{prefecture}")} (e.g. ${u("/en/region/hokkaido")})`,
    `- Tags: ${u("/{locale}/tags")} , ${u("/{locale}/tag/{slug}")}`,
    `- Chains as entry points to regional styles: ${u("/{locale}/chain/{slug}")}`,
    `- Before-you-go guides (ordering, paying, manners, where to try things): ${u("/{locale}/guide")} , ${u("/{locale}/guide/{slug}")} , by scene ${u("/{locale}/guide/scene/{scene}")}`,
    `- Sitemap: ${u("/sitemap.xml")}`,
    "",
    "## Detail page structure",
    "",
    "Each detail page has: the name triple; origin (prefecture, city, coordinates) or a note that it is not tied to one place; style; tags; a summary; chapters \"What it's made of\", \"How it's made\", \"Why it took this shape\", and optionally \"How to eat it\"; renowned regions with the structural reason; related entries (root/derived, related lineage, contrast, uses/used in).",
    "",
    "## Shelves (every entry belongs to exactly one)",
    "",
  ];
  for (const grp of ["dish", "ingredient", "preparation"] as const) {
    lines.push(`### ${grpLabel[grp]}`);
    for (const s of shelves.filter((x) => x.grp === grp)) lines.push(`- [${s.nameEn} / ${s.nameJa}](${u(`/en/${s.slug}`)})`);
    lines.push("");
  }
  lines.push("## Genres (shelves with 20+ entries of one kind)", "");
  for (const g of genres) {
    lines.push(`- [${g.nameEn} / ${g.nameJa}](${u(`/en/${g.slug}`)}) — ${layerLabel[g.type] ?? g.type}`);
  }
  lines.push("", "## Prefectures with entries", "");
  for (const p of prefs) {
    const slug = PREF_SLUGS[p as Prefecture];
    if (slug) lines.push(`- [${p}](${u(`/en/region/${slug}`)})`);
  }
  lines.push("", "## Guide topics", "", GUIDE_KINDS.map((k) => `\`${k}\``).join(", "), "", "## Guide scenes", "", GUIDE_SCENES.map((s) => `\`${s.slug}\``).join(", "), "");

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
