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
    await expect(deformed.getByRole("button", { name: /沖縄県 掲載なし/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

test.describe("F-05 言語切り替え / F-08 SEO", () => {
  test("/ は既定ロケールへ送られ、自動言語判定によるリダイレクトはしない", async ({ page }) => {
    // Accept-Language が英語でも /ja に送られる（Platform 10_growth_infra.md §3.2）
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
    await page.goto("/");
    expect(new URL(page.url()).pathname).toBe("/ja");
  });

  test("詳細ページが英日で切り替わり、三点セットが出る", async ({ page }) => {
    await page.goto("/ja/ramen/hakata");
    await expect(page.getByRole("heading", { name: "博多ラーメン", level: 1 })).toBeVisible();

    await page.goto("/en/ramen/hakata");
    // 英訳は説明訳なので、英語表示でも見出しはローマ字
    await expect(page.getByRole("heading", { name: "Hakata Ramen", level: 1 })).toBeVisible();
    // マスタラベルは辞書で翻訳される（二層方式）。
    // 定義リスト内に限定する（辞書全体がRSCペイロードにも載るため）
    const dl = page.locator("dl");
    await expect(dl.getByText("Fukuoka / 福岡市")).toBeVisible();
    await expect(dl.getByText("Tonkotsu — pork bone")).toBeVisible();
    // 出典が記事末尾に出る
    await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
  });

  test("hreflang が言語版を相互に紐付ける", async ({ page }) => {
    await page.goto("/ja/ramen/hakata");
    for (const lang of ["ja", "en", "x-default"]) {
      await expect(
        page.locator(`link[rel="alternate"][hreflang="${lang}"]`),
      ).toHaveCount(1);
    }
  });

  test("sitemap に全ロケールのURLが出る", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("/ja/ramen/hakata");
    expect(xml).toContain("/en/ramen/hakata");
  });
});

test.describe("データ駆動ページ（行を足すと増える機械）", () => {
  test("ジャンルページ: 系統別の一覧と三点セット", async ({ page }) => {
    await page.goto("/ja/ramen");
    await expect(page.getByRole("heading", { name: "ご当地ラーメン一覧" })).toBeVisible();
    // 系統見出しと、三点セット付きのアイテムリンク
    await expect(page.getByRole("heading", { name: /豚骨/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /札幌ラーメン/ }).first()).toBeVisible();
  });

  test("地域ページ: データがある県だけ生える", async ({ page }) => {
    await page.goto("/ja/region/fukuoka");
    await expect(page.getByRole("heading", { name: "福岡県の食" })).toBeVisible();
    await expect(page.getByRole("link", { name: /博多ラーメン/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /久留米ラーメン/ })).toBeVisible();

    // データが無い県は404（薄いページを量産しない）
    const res = await page.goto("/ja/region/okinawa");
    expect(res?.status()).toBe(404);
  });

  test("つながり: 関係1行が双方向のリンクになる", async ({ page }) => {
    // 博多側: 久留米が「源流」として出る
    await page.goto("/ja/ramen/hakata");
    const hakataConn = page.locator("section", { hasText: "つながり" });
    await expect(hakataConn.getByText("源流", { exact: true })).toBeVisible();
    await expect(hakataConn.getByRole("link", { name: /久留米ラーメン/ })).toBeVisible();

    // 久留米側: 博多が「派生」として出る（同じ1行から双方向）
    await page.goto("/ja/ramen/kurume");
    const kurumeConn = page.locator("section", { hasText: "つながり" });
    await expect(kurumeConn.getByText("派生", { exact: true }).first()).toBeVisible();
    await expect(kurumeConn.getByRole("link", { name: /博多ラーメン/ })).toBeVisible();
  });
});

test.describe("マルチジャンル（2ジャンル目はデータ投入のみで生える）", () => {
  test("ジャンルページが自動生成され、図鑑（非地理アイテム）が出る", async ({ page }) => {
    await page.goto("/ja/yakitori");
    await expect(page.getByRole("heading", { name: "ご当地焼き鳥一覧" })).toBeVisible();
    // 地域性のない部位は「図鑑」セクションに自動で現れる
    await expect(page.getByRole("heading", { name: "図鑑" })).toBeVisible();
    await expect(page.getByRole("link", { name: /せせり/ })).toBeVisible();
  });

  test("非地理アイテムの詳細（三点セット・説明訳）", async ({ page }) => {
    await page.goto("/en/yakitori/seseri");
    await expect(page.getByRole("heading", { name: "Seseri", level: 1 })).toBeVisible();
    await expect(page.getByText("chicken neck meat").first()).toBeVisible();
  });

  test("地域ページにジャンル横断で並ぶ（広くする方向）", async ({ page }) => {
    await page.goto("/ja/region/hokkaido");
    await expect(page.getByRole("link", { name: /札幌ラーメン/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /室蘭やきとり/ })).toBeVisible();
  });

  test("トップのジャンルチップに自動で増える", async ({ page }) => {
    await page.goto("/ja");
    await expect(page.getByRole("link", { name: "ラーメン" })).toBeVisible();
    await expect(page.getByRole("link", { name: "焼き鳥" })).toBeVisible();
  });
});
