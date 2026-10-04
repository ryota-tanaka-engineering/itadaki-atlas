/**
 * 束 JSON の出典 URL の疎通検査（2026-10）。
 *
 * 部隊が Web に出られない環境で執筆した束（data/ledgers/SOY_BRIEF.md 等の「Web 不可環境の規律」）は、
 * URL の実在が未確認のまま届く。投入前に手元（Web に出られる環境）でこのスクリプトを流し、
 * 200 以外を直してから `npm run content:import` にかける（ia-atlas-content Skill §3「出典必須・URL実在確認」）。
 *
 * 対象: items[].sources[].url と items[].regions[].source_url（同じ URL は1回だけ）。
 * HEAD を試し、405/403/501 なら GET で再試行する（HEAD を拒む自治体サイトがある）。
 *
 * 使い方: node scripts/check-source-urls.ts data/content/<name>.json [...more] [--timeout 15000]
 *   終了コード: 0 = 全て 200 系、1 = 失敗あり
 */
import { readFileSync } from "node:fs";

export type SourceUrlRef = { url: string; slugs: string[] };

type BundleLike = {
  items?: {
    slug: string;
    sources?: { url?: string }[];
    regions?: { source_url?: string }[];
  }[];
};

/** 束から URL → 参照している slug 群 を集める（重複 URL は1件にまとめる）。 */
export function collectSourceUrls(bundle: BundleLike): SourceUrlRef[] {
  const map = new Map<string, Set<string>>();
  for (const it of bundle.items ?? []) {
    const urls = [
      ...(it.sources ?? []).map((s) => s.url),
      ...(it.regions ?? []).map((r) => r.source_url),
    ].filter((u): u is string => typeof u === "string" && u.trim().length > 0);
    for (const u of urls) {
      const key = u.trim();
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(it.slug);
    }
  }
  return [...map.entries()].map(([url, slugs]) => ({ url, slugs: [...slugs] }));
}

export type CheckResult = { url: string; status: number | null; ok: boolean; error?: string };

/** HEAD → ダメなら GET。ネットワーク例外は status null。 */
export async function checkUrl(url: string, timeoutMs: number, fetchImpl: typeof fetch = fetch): Promise<CheckResult> {
  const attempt = async (method: "HEAD" | "GET") => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { method, redirect: "follow", signal: ctrl.signal });
      return res.status;
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    let status = await attempt("HEAD");
    if ([403, 405, 501].includes(status)) status = await attempt("GET");
    return { url, status, ok: status >= 200 && status < 300 };
  } catch (e) {
    return { url, status: null, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const ti = args.indexOf("--timeout");
  const timeoutMs = ti >= 0 ? Number(args[ti + 1]) : 15000;
  const files = args.filter((a, i) => !a.startsWith("--") && (ti < 0 || i !== ti + 1));
  if (files.length === 0) {
    console.error("使い方: node scripts/check-source-urls.ts data/content/<name>.json [...] [--timeout ms]");
    process.exit(1);
  }

  const refs = new Map<string, Set<string>>();
  for (const f of files) {
    const bundle = JSON.parse(readFileSync(f, "utf8")) as BundleLike;
    for (const r of collectSourceUrls(bundle)) {
      if (!refs.has(r.url)) refs.set(r.url, new Set());
      for (const s of r.slugs) refs.get(r.url)!.add(`${f.replace(/^.*\//, "")}:${s}`);
    }
  }
  console.log(`URL ${refs.size}件を検査します（timeout ${timeoutMs}ms）`);

  const entries = [...refs.entries()];
  const results: (CheckResult & { slugs: string[] })[] = [];
  // 同一ホストへ集中しないよう少数並列
  const CONCURRENCY = 4;
  let idx = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (idx < entries.length) {
        const [url, slugs] = entries[idx++];
        const r = await checkUrl(url, timeoutMs);
        results.push({ ...r, slugs: [...slugs] });
        process.stdout.write(r.ok ? "." : "x");
      }
    }),
  );
  process.stdout.write("\n");

  const bad = results.filter((r) => !r.ok);
  for (const r of bad) {
    console.log(`✗ ${r.status ?? r.error}  ${r.url}\n    ← ${r.slugs.join(", ")}`);
  }
  console.log(bad.length ? `失敗 ${bad.length} / ${results.length}` : `全 ${results.length} 件 OK`);
  if (bad.length) process.exit(1);
}

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const isMain = process.argv[1] ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href : false;
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
