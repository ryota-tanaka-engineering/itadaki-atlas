/**
 * 名称の三点セット（日本語名 — ローマ字 — 英訳。CLAUDE.md「名称表記」）を一覧行で
 * 見せるときの重複除去（2026-09-30 デザイン刷新）。
 *
 * name_en は「Aizu Ramen — flat, curly …」のように英名＋説明訳を持つことがあり、
 * そのまま並べると「Aizu Ramen — Aizu Ramen — flat, curly …」と同じ名前が繰り返される。
 * ローマ字（または表示中の名前）と同じ英名は落とし、先頭に同じ名前が付いていれば
 * 説明訳の部分だけを返す。
 */
const SEPARATORS = [" — ", " – ", " - ", ": "];

const norm = (s: string) => s.trim().toLowerCase();

export function englishGloss(nameEn: string | null | undefined, ...shown: (string | null | undefined)[]): string | null {
  if (!nameEn) return null;
  const en = nameEn.trim();
  if (!en) return null;
  const shownNorm = shown.filter((s): s is string => Boolean(s && s.trim())).map(norm);
  if (shownNorm.includes(norm(en))) return null;
  for (const name of shownNorm) {
    for (const sep of SEPARATORS) {
      const head = `${name}${sep.trimEnd()}`;
      if (norm(en).startsWith(head)) {
        const rest = en.slice(head.length).trim();
        return rest.length > 0 ? rest : null;
      }
    }
  }
  return en;
}

/** 空・重複（大文字小文字を無視）を除いて「 · 」でつなぐ。 */
export function joinDistinct(parts: (string | null | undefined)[], sep = " · "): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (!p || !p.trim()) continue;
    const key = norm(p);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p.trim());
  }
  return out.join(sep);
}
