// 郷土料理 Tier2 本文束の機械検査。使い方: node data/ledgers/check-tier2.js <pref>...（data/bodies3/tier2-<pref>.json を検査）
const fs = require("fs");
const ng = /三大|一番|日本一|No\.?1|受賞|認定|百選|遺産|記念日/;
const H = ["## 何でできているか", "## どう作るのか", "## なぜこの形になったのか"];
const E = ["## What it's made of", "## How it's made", "## Why it took this shape"];
let totalBad = 0;
for (const pref of process.argv.slice(2)) {
  const j = JSON.parse(fs.readFileSync(`data/bodies3/tier2-${pref}.json`, "utf8"));
  const k = JSON.parse(fs.readFileSync(`data/content/kyodo-${pref}.json`, "utf8"));
  const slugs = new Set(k.items.map((i) => i.slug));
  let bad = 0;
  const lens = [];
  for (const it of j.items) {
    if (!slugs.has(it.slug)) { console.log("unknown slug", it.slug); bad++; }
    if (!H.every((h) => it.body_ja.includes(h)) || !E.every((h) => it.body_en.includes(h))) { console.log("heading", it.slug); bad++; }
    if (/である。|なのだ。|のだ。/.test(it.body_ja)) { console.log("断定調", it.slug, (it.body_ja.match(/である。|なのだ。|のだ。/g) || []).length); bad++; }
    if (ng.test(it.body_ja)) { console.log("NG", it.slug, it.body_ja.match(ng)[0]); bad++; }
    if (!it.sources?.length || it.sources.some((s) => !/^https:/.test(s.url))) { console.log("source", it.slug); bad++; }
    const secs = it.body_ja.split(/^## .*$/m).filter((s) => s.trim());
    secs.forEach((s) => { const n = s.replace(/\s/g, "").length; if (n < 150 || n > 250) { console.log("len", it.slug, n); bad++; } });
    lens.push(it.body_ja.replace(/\s/g, "").length);
  }
  lens.sort((a, b) => a - b);
  console.log(pref, "items", j.items.length, "/", k.items.length, "bad", bad, "median ja", lens[Math.floor(lens.length / 2)]);
  totalBad += bad;
}
process.exit(totalBad ? 1 : 0);
