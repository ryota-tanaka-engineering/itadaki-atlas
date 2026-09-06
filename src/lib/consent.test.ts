import { describe, expect, it } from "vitest";

import { CONSENT_STORAGE_KEY, readConsent, writeConsent } from "./consent";

function memoryStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

describe("consent", () => {
  it("未保存なら unset", () => {
    expect(readConsent(memoryStorage())).toBe("unset");
    expect(readConsent(null)).toBe("unset");
  });
  it("granted / denied を往復できる", () => {
    const s = memoryStorage();
    writeConsent(s, "granted");
    expect(readConsent(s)).toBe("granted");
    writeConsent(s, "denied");
    expect(readConsent(s)).toBe("denied");
  });
  it("壊れた値は unset として扱う", () => {
    expect(readConsent(memoryStorage({ [CONSENT_STORAGE_KEY]: "yes" }))).toBe("unset");
  });
  it("storage が例外を投げても落ちない", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readConsent(throwing)).toBe("unset");
    expect(() => writeConsent(throwing, "granted")).not.toThrow();
  });
});
