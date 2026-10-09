import { expect, test } from "@playwright/test";

import en from "../messages/en.json";

/**
 * デザイン刷新後の体験検品（2026-10-09）の指摘の再発防止。
 * 前提: ローカル Supabase が起動していること（smoke.spec.ts と同じ）。
 */

test.describe("SP ヘッダー: 横はみ出しなし", () => {
  for (const width of [390, 360]) {
    for (const path of ["/ja", "/en", "/ja/ramen", "/ja/guide", "/en/guide"]) {
      test(`${path} は幅${width}で横にはみ出さない`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(path);
        await expect(page.getByRole("banner")).toBeVisible();

        const sizes = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          inner: window.innerWidth,
        }));
        expect(sizes.scroll).toBe(sizes.inner);

        // 言語切替は右端まで画面内に収まっている（途中で切れていない）
        const nav = page.getByRole("banner").getByRole("navigation", { name: /言語|Language/ });
        const box = await nav.boundingBox();
        expect(box).not.toBeNull();
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
        // 短い表記でも読み上げ名はフル表記
        await expect(nav.getByRole("link", { name: "English" })).toBeVisible();
      });
    }
  }
});

test.describe("件数の一致（県ページ = トップの県絞り込み）", () => {
  test("福島県は県ページの見出し件数とトップの絞り込み件数が同じ（発祥ベース）", async ({ page }) => {
    await page.goto("/ja");
    await page.getByRole("button", { name: /福島県/ }).first().click();
    const chip = page.getByRole("button", { name: "福島県の絞り込みを解除" });
    await expect(chip).toContainText(/福島県\d+件/);
    const topCount = Number(((await chip.textContent()) ?? "").match(/福島県(\d+)件/)?.[1]);
    expect(topCount).toBeGreaterThan(0);

    await page.goto("/ja/region/fukushima");
    const heading = page.locator("main").first();
    await expect(heading).toContainText(`${topCount}件`);
    // 本場は別群。見出しの件数に混ぜない
    await expect(page.getByRole("heading", { name: /この土地が本場/ })).toBeVisible();
    // 「これは何か」の一行（体験原則2）がカバー直下にある
    await expect(page.getByText(/●生まれた料理 \d+件/)).toBeVisible();
    await expect(page.getByText(/○本場 \d+件/)).toBeVisible();
  });
});

test.describe("/en に日本語の系統名が出ない", () => {
  const styleKeys = [...Object.keys(en.styleNames), ...Object.keys(en.style)];
  for (const path of ["/en/ramen", "/en/region/fukushima", "/en/fish", "/en/wagashi", "/en/nihoncha"]) {
    test(`${path}`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      const lines = (await page.locator("main").innerText()).split("\n").map((l) => l.trim());
      for (const key of styleKeys) {
        // 系統名だけの行・「· 系統名」で終わる行（索引の副行）が日本語のまま出ていない
        const leaked = lines.filter((l) => l === key || l.endsWith(`· ${key}`));
        expect(leaked, `${path} に系統名「${key}」が日本語のまま出ている`).toEqual([]);
      }
    });
  }

  test("トップの索引（系統の軸）にも日本語の系統名が出ない", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: /Move sheet to next position/ }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("tablist", { name: "Index order" }).getByRole("tab", { name: "Style" }).click();
    const lines = (await sheet.innerText()).split("\n").map((l) => l.trim());
    expect(lines.length).toBeGreaterThan(20);
    for (const key of ["白身", "貝", "エビ・カニ", "イカ・タコ", "黒糖・泡盛", "干菓子", "羊羹・寒天", "その他"]) {
      expect(lines.filter((l) => l === key || l.endsWith(`· ${key}`)), `索引に「${key}」`).toEqual([]);
    }
  });
});

test.describe("「その他」を分類名として出さない（体験原則3）", () => {
  test("/ja/ramen に「その他」が出ない", async ({ page }) => {
    await page.goto("/ja/ramen");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main")).not.toContainText("その他");
    await expect(page.getByText("4系統の外").first()).toBeVisible();
  });

  test("/en/ramen に Other が出ない", async ({ page }) => {
    await page.goto("/en/ramen");
    await expect(page.locator("main")).not.toContainText(/\bOther\b/);
    await expect(page.getByText("Beyond the four styles").first()).toBeVisible();
  });
});

test.describe("英語ページの市区町村名・発祥表記", () => {
  test("/en/guide の場所ラベルに日本語の市名・同綴りの重複が出ない", async ({ page }) => {
    await page.goto("/en/guide");
    const text = await page.locator("main").innerText();
    // place_names に行がある市は英語になる（「Kanagawa 横浜市」ではなく「Kanagawa Yokohama」）。
    // place_names に行が無い市（例: 新宿区・川口市）は日本語のままフォールバックするデータ側の不足で、ここでは問わない
    expect(text).toContain("Kanagawa Yokohama");
    expect(text).not.toContain("Kanagawa 横浜市");
    // 県名と市名が同綴りの表記は区別する（「Kyoto Kyoto」「Osaka Osaka」を出さない）
    expect(text).not.toMatch(/\b(Kyoto Kyoto|Osaka Osaka|Fukuoka Fukuoka)\b/);
    expect(text).toMatch(/Osaka City, Osaka|Kyoto City, Kyoto/);
  });

  test("福岡県福岡市の詳細は Origin を「Fukuoka City, Fukuoka」と書く", async ({ page }) => {
    await page.goto("/en/ramen/hakata");
    await expect(page.locator("header").filter({ hasText: "Origin" }).first()).toContainText(
      "Origin: Fukuoka City, Fukuoka",
    );
  });
});

test.describe("詳細ページ", () => {
  test("カバーのタグ下線リンクに「興味:」の前置きがあり、同じ県の項目に要約がある", async ({ page }) => {
    await page.goto("/ja/ramen/hakata");
    await expect(page.getByText("興味:").first()).toBeVisible();
    const samePref = page.getByRole("heading", { name: /福岡県/ }).first();
    await expect(samePref).toBeVisible();
  });
});
