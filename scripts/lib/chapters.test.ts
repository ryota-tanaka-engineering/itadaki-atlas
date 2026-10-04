// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  EN_HOWTO_HEADING,
  JA_HOWTO_HEADING,
  chapterHeadings,
  hasHowtoChapter,
  upsertHowtoChapter,
  validateChapters,
} from "./chapters.ts";

const JA3 = "## 何でできているか\n味噌。\n\n## どう作るのか\n炒める。\n\n## なぜこの形になったのか\n寒さ。";
const EN3 = "## What it's made of\nMiso.\n\n## How it's made\nStir-fry.\n\n## Why it took this shape\nCold.";

describe("validateChapters", () => {
  it("必須3章がこの順で揃っていれば通る", () => {
    expect(validateChapters(JA3, "ja")).toBeNull();
    expect(validateChapters(EN3, "en")).toBeNull();
  });

  it("4章目が末尾にあれば通る", () => {
    expect(validateChapters(`${JA3}\n\n${JA_HOWTO_HEADING}\n替え玉。`, "ja")).toBeNull();
    expect(validateChapters(`${EN3}\n\n${EN_HOWTO_HEADING}\nKaedama.`, "en")).toBeNull();
  });

  it("3章の順が違えば弾く", () => {
    const swapped = "## どう作るのか\nx\n\n## 何でできているか\ny\n\n## なぜこの形になったのか\nz";
    expect(validateChapters(swapped, "ja")).toMatch(/この順/);
  });

  it("3章が欠けていれば弾く", () => {
    expect(validateChapters("## 何でできているか\nx", "ja")).toMatch(/揃っていません/);
  });

  it("規定外の見出しは弾く", () => {
    expect(validateChapters(`${JA3}\n\n## 歴史\nx`, "ja")).toMatch(/規定外/);
  });

  it("4章目が末尾でなければ弾く", () => {
    const body = `${JA_HOWTO_HEADING}\nx\n\n${JA3}`;
    expect(validateChapters(body, "ja")).toMatch(/末尾/);
  });

  it("4章目が複数あれば弾く", () => {
    const body = `${JA3}\n\n${JA_HOWTO_HEADING}\nx\n\n${JA_HOWTO_HEADING}\ny`;
    expect(validateChapters(body, "ja")).toMatch(/複数/);
  });

  it("ja の見出しを en として検証すると弾く（言語取り違え）", () => {
    expect(validateChapters(JA3, "en")).not.toBeNull();
  });
});

describe("upsertHowtoChapter", () => {
  it("4章目が無ければ末尾に空行を挟んで付け足す", () => {
    const out = upsertHowtoChapter(JA3, "ja", "替え玉を頼める店が多い。");
    expect(out).toBe(`${JA3}\n\n${JA_HOWTO_HEADING}\n替え玉を頼める店が多い。\n`);
    expect(validateChapters(out, "ja")).toBeNull();
    expect(chapterHeadings(out)).toHaveLength(4);
  });

  it("既に4章目があれば差し替える（二重にならない）", () => {
    const first = upsertHowtoChapter(JA3, "ja", "古い本文。");
    const second = upsertHowtoChapter(first, "ja", "新しい本文。");
    expect(second).not.toContain("古い本文");
    expect(second).toContain("新しい本文。");
    expect(chapterHeadings(second).filter((h) => h === JA_HOWTO_HEADING)).toHaveLength(1);
    expect(validateChapters(second, "ja")).toBeNull();
  });

  it("CRLF と末尾の空白を正規化する", () => {
    const out = upsertHowtoChapter(JA3.replace(/\n/g, "\r\n") + "\r\n\r\n", "ja", "  本文  \r\n");
    expect(out).not.toContain("\r");
    expect(out).toBe(`${JA3}\n\n${JA_HOWTO_HEADING}\n本文\n`);
  });

  it("en は英語の見出しを付ける", () => {
    const out = upsertHowtoChapter(EN3, "en", "Ask for kaedama.");
    expect(out.endsWith(`${EN_HOWTO_HEADING}\nAsk for kaedama.\n`)).toBe(true);
  });
});

describe("hasHowtoChapter", () => {
  it("4章目の有無を見出しで判定する", () => {
    expect(hasHowtoChapter(JA3, "ja")).toBe(false);
    expect(hasHowtoChapter(upsertHowtoChapter(JA3, "ja", "x"), "ja")).toBe(true);
    expect(hasHowtoChapter(null, "ja")).toBe(false);
  });
});
