import { expect, test } from "@playwright/test";

/**
 * 受け入れ条件の写経（.doc/30_features/01_requirements.md）。
 *
 * 前提: ローカル Supabase が起動していること（`npx supabase start`）。
 * DBが無いとトップページはサーバー側の取得で失敗する。
 */
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

test.describe("F-03 索引", () => {
  test("3軸すべてで引ける。地図を使わずに全アイテムへ到達できる", async ({ page }) => {
    await page.goto("/");

    // シートを開く（ピーク → ハーフ）
    await page.getByRole("button", { name: /シートを次の段階へ/ }).click();

    // 地図ピンにも同名の aria-label があるため、索引の操作はシート内にスコープする
    const sheet = page.getByRole("dialog");
    const tablist = sheet.getByRole("tablist", { name: "索引の並び順" });
    await expect(tablist).toBeVisible();

    for (const axis of ["五十音", "地域", "系統"]) {
      await tablist.getByRole("tab", { name: axis }).click();
      await expect(tablist.getByRole("tab", { name: axis })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      // どの軸でも実データが1件以上出ること
      await expect(sheet.getByRole("button", { name: /札幌ラーメン/ })).toBeVisible();
    }
  });

  test("索引から選ぶと詳細が三点セットで出る", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /シートを次の段階へ/ }).click();

    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: /札幌ラーメン/ }).first().click();

    // 日本語名 — ローマ字 — 英訳（.doc/00_concept/05_brand.md §5）
    await expect(sheet.getByRole("heading", { name: "札幌ラーメン" })).toBeVisible();
    await expect(sheet.getByText(/Sapporo Ramen — /)).toBeVisible();
    await expect(sheet.getByText("味噌", { exact: true })).toBeVisible();

    await sheet.getByRole("button", { name: "索引に戻る" }).click();
    await expect(sheet.getByRole("tablist", { name: "索引の並び順" })).toBeVisible();
  });
});

test.describe("F-07 アクセシビリティ", () => {
  test("地図ピンが button でキーボードから到達できる", async ({ page }) => {
    await page.goto("/");

    // ピンは aria-label 付きの button（地図の読み込み完了を待つ）
    const pin = page.getByRole("button", { name: /札幌ラーメン（北海道札幌市・味噌）/ });
    await expect(pin).toBeVisible({ timeout: 30_000 });
    await pin.focus();
    await expect(pin).toBeFocused();
  });

  test("draft のアイテムは表示されない", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /シートを次の段階へ/ }).click();

    // RLS で published のみが返る（.doc/10_system/06_security.md §2）
    await expect(page.getByText("【fixture】draft")).toHaveCount(0);
  });
});

test.describe("F-01 ディフォルメ地図", () => {
  test("初期表示は県別の一覧。県を選ぶと実座標地図に切り替わる", async ({ page }) => {
    await page.goto("/");

    const deformed = page.getByRole("group", { name: /ディフォルメ地図/ });
    await expect(deformed).toBeVisible();

    // 掲載がある県は件数付きで選べる
    const fukushima = deformed.getByRole("button", { name: /^福島県 \d+件/ });
    await expect(fukushima).toBeVisible();
    await fukushima.click();

    // 実座標地図へ切り替わり、戻る導線が出る
    await expect(deformed).toBeHidden();
    await expect(page.getByRole("button", { name: "全国に戻る" })).toBeVisible();

    await page.getByRole("button", { name: "全国に戻る" }).click();
    await expect(deformed).toBeVisible();
  });

  test("掲載のない県は選べない", async ({ page }) => {
    await page.goto("/");
    const deformed = page.getByRole("group", { name: /ディフォルメ地図/ });
    await expect(deformed.getByRole("button", { name: /鳥取県 掲載なし/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
