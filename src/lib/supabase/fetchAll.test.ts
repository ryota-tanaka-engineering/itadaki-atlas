import { describe, expect, it, vi } from "vitest";

import { fetchAllRows } from "./fetchAll";

function makeRows(count: number, offset = 0): { id: number }[] {
  return Array.from({ length: count }, (_, i) => ({ id: offset + i }));
}

describe("fetchAllRows", () => {
  it("returns all rows when the table has fewer than one page", async () => {
    const buildPage = vi.fn(async (from: number) => {
      if (from > 0) return { data: [], error: null };
      return { data: makeRows(3), error: null };
    });

    const result = await fetchAllRows(buildPage, "test");

    expect(result).toHaveLength(3);
    expect(buildPage).toHaveBeenCalledTimes(1);
  });

  it("handles a table with exactly 1,000 rows (confirms the boundary with one empty follow-up page)", async () => {
    // 1ページ目がちょうどpageSize件返った場合、それだけでは「これで全件」か
    // 「次ページがある」か区別できないため、空配列が返るまでもう1ページ読む
    // 必要がある（content-lint.ts の all() と同じ挙動）。
    const buildPage = vi.fn(async (from: number) => {
      if (from === 0) return { data: makeRows(1000), error: null };
      return { data: [], error: null };
    });

    const result = await fetchAllRows(buildPage, "test");

    expect(result).toHaveLength(1000);
    expect(buildPage).toHaveBeenCalledTimes(2);
  });

  it("pages past the 1,000-row PostgREST default limit (1,001 rows)", async () => {
    const buildPage = vi.fn(async (from: number) => {
      if (from === 0) return { data: makeRows(1000, 0), error: null };
      if (from === 1000) return { data: makeRows(1, 1000), error: null };
      return { data: [], error: null };
    });

    const result = await fetchAllRows(buildPage, "test");

    expect(result).toHaveLength(1001);
    expect(result[1000]).toEqual({ id: 1000 });
    expect(buildPage).toHaveBeenCalledTimes(2);
  });

  it("returns an empty array for an empty table", async () => {
    const buildPage = vi.fn(async () => ({ data: [], error: null }));

    const result = await fetchAllRows(buildPage, "test");

    expect(result).toEqual([]);
    expect(buildPage).toHaveBeenCalledTimes(1);
  });

  it("returns an empty array when data is null", async () => {
    const buildPage = vi.fn(async () => ({ data: null, error: null }));

    const result = await fetchAllRows(buildPage, "test");

    expect(result).toEqual([]);
  });

  it("wraps the error with the given context and stops paging", async () => {
    const buildPage = vi.fn(async () => ({ data: null, error: { message: "boom" } }));

    await expect(fetchAllRows(buildPage, "fetchThing")).rejects.toThrow(
      "fetchThing failed: boom",
    );
    expect(buildPage).toHaveBeenCalledTimes(1);
  });

  it("passes the correct from/to range for each page", async () => {
    const calls: [number, number][] = [];
    const buildPage = vi.fn(async (from: number, to: number) => {
      calls.push([from, to]);
      if (from === 0) return { data: makeRows(1000), error: null };
      return { data: makeRows(500), error: null };
    });

    await fetchAllRows(buildPage, "test");

    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });
});
