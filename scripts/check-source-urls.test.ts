// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { checkUrl, collectSourceUrls } from "./check-source-urls.ts";

describe("collectSourceUrls", () => {
  it("sources と regions.source_url を集め、同じ URL は1件にまとめて参照 slug を束ねる", () => {
    const refs = collectSourceUrls({
      items: [
        { slug: "a", sources: [{ url: "https://x.example/1" }], regions: [{ source_url: "https://x.example/2" }] },
        { slug: "b", sources: [{ url: "https://x.example/1" }, { url: " https://x.example/1 " }], regions: [{}] },
      ],
    });
    expect(refs).toEqual([
      { url: "https://x.example/1", slugs: ["a", "b"] },
      { url: "https://x.example/2", slugs: ["a"] },
    ]);
  });

  it("items が無ければ空", () => {
    expect(collectSourceUrls({})).toEqual([]);
  });
});

describe("checkUrl", () => {
  it("HEAD が 200 なら ok", async () => {
    const f = vi.fn(async () => ({ status: 200 })) as unknown as typeof fetch;
    expect(await checkUrl("https://x.example/", 1000, f)).toEqual({ url: "https://x.example/", status: 200, ok: true });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("HEAD が 405 なら GET で再試行する", async () => {
    const f = vi.fn(async (_u: string, init?: RequestInit) => ({ status: init?.method === "HEAD" ? 405 : 200 })) as unknown as typeof fetch;
    const r = await checkUrl("https://x.example/", 1000, f);
    expect(r.ok).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("404 は ok にならない", async () => {
    const f = vi.fn(async () => ({ status: 404 })) as unknown as typeof fetch;
    expect((await checkUrl("https://x.example/", 1000, f)).ok).toBe(false);
  });

  it("ネットワーク例外は status null で返す", async () => {
    const f = vi.fn(async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    const r = await checkUrl("https://x.example/", 1000, f);
    expect(r).toMatchObject({ status: null, ok: false, error: "ECONNRESET" });
  });
});
