import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("トップページが表示される", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    await expect(page.locator("body")).toBeVisible();
  });

  test("存在しないパスでカスタム404が表示される", async ({ page }) => {
    await page.goto("/this-path-does-not-exist");

    await expect(
      page.getByRole("heading", { name: "ページが見つかりません" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "トップへ戻る" })).toBeVisible();
  });
});
