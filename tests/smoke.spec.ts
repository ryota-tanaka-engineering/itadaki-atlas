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

    // RLS で published のみが返る（Platform ../.doc/10_system/06_security.md §2）
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
    // 2026-08: 掲載なし県は石川のみ（region 404 テストと同じ前提。埋まったら要更新）
    await expect(deformed.getByRole("button", { name: /石川県 掲載なし/ })).toHaveAttribute(
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
    // 出典はUIに出さない。訂正導線だけが末尾中央に出る（2026-08 デザイン確定）
    await expect(page.getByRole("heading", { name: "出典" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "内容の訂正を送る" })).toBeVisible();

    await page.goto("/en/ramen/hakata");
    // 英訳は説明訳なので、英語表示でも見出しはローマ字
    await expect(page.getByRole("heading", { name: "Hakata Ramen", level: 1 })).toBeVisible();
    // マスタラベルは辞書で翻訳される（二層方式）。
    // 定義リスト内に限定する（辞書全体がRSCペイロードにも載るため）
    const dl = page.locator("dl");
    await expect(dl.getByText("Fukuoka / 福岡市")).toBeVisible();
    await expect(dl.getByText("Tonkotsu — pork bone")).toBeVisible();
    // 出典はDB内部の検証データでUIには出さない（2026-08 デザイン確定）。
    // 代わりに訂正導線だけが出る
    await expect(page.getByRole("heading", { name: "Sources" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Report a correction" })).toBeVisible();
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
    // 2026-08 デザイン確定: ジャンルページのカバー見出しはジャンル名のみ（旧「ご当地◯◯一覧」文はmeta/titleへ移動）
    await expect(page.getByRole("heading", { name: "ラーメン", level: 1 })).toBeVisible();
    // 系統見出しと、三点セット付きのアイテムリンク
    await expect(page.getByRole("heading", { name: /豚骨/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /札幌ラーメン/ }).first()).toBeVisible();
  });

  test("地域ページ: データがある県だけ生える", async ({ page }) => {
    await page.goto("/ja/region/fukuoka");
    // 2026-08 デザイン確定: 地域ページのカバー見出しは県名のみ（旧「◯◯県の食」文はmeta/titleへ移動）
    await expect(page.getByRole("heading", { name: "福岡県", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /博多ラーメン/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /久留米ラーメン/ })).toBeVisible();

    // データが無い県は404（薄いページを量産しない）。
    // 2026-08: 掲載なし県は石川のみ（沖縄そば投入で沖縄が埋まった）。
    // 石川にデータが入ったらこのテストは fixture ベースの検証に置き換える。
    const res = await page.goto("/ja/region/ishikawa");
    expect(res?.status()).toBe(404);
  });

  test("つながり: 関係1行が双方向のリンクになる", async ({ page }) => {
    // 2026-08 デザイン確定で「つながり」は2軸に分かれ、4語彙の関係ラベルは
    // 「この土地と、この素材」側に出る。SP/PC両方でDOMに存在するため
    // :visible で実際に見えているほうに絞る。
    // 博多側: 久留米が「源流」として出る
    await page.goto("/ja/ramen/hakata");
    const hakataConn = page.locator("section:visible", { hasText: "この土地と、この素材" });
    await expect(hakataConn.getByText("源流", { exact: true })).toBeVisible();
    await expect(hakataConn.getByRole("link", { name: /久留米ラーメン/ })).toBeVisible();

    // 久留米側: 博多が「派生」として出る（同じ1行から双方向）
    await page.goto("/ja/ramen/kurume");
    const kurumeConn = page.locator("section:visible", { hasText: "この土地と、この素材" });
    await expect(kurumeConn.getByText("派生", { exact: true }).first()).toBeVisible();
    await expect(kurumeConn.getByRole("link", { name: /博多ラーメン/ })).toBeVisible();
  });
});

test.describe("詳細ページの本文（目次・章。2026-08 デザイン確定）", () => {
  test("body_md があるアイテムは目次と章が出て、章へページ内リンクできる", async ({ page }) => {
    await page.goto("/ja/ramen/sapporo");

    const toc = page.locator("nav:visible", { hasText: "目次" });
    await expect(toc).toBeVisible();
    const chapterLink = toc.getByRole("link", { name: /何でできているか/ });
    await expect(chapterLink).toBeVisible();
    await expect(chapterLink).toHaveAttribute("href", "#ch-1");

    // 目次のリンク先の章見出しが本文に実在する
    await expect(
      page.getByRole("heading", { name: "何でできているか", level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "どう作るのか", level: 2 }),
    ).toBeVisible();
  });

  test("英語版でも目次と章が出る", async ({ page }) => {
    await page.goto("/en/ramen/sapporo");
    const toc = page.locator("nav:visible", { hasText: "Contents" });
    await expect(toc).toBeVisible();
    await expect(page.getByRole("heading", { name: "What it's made of", level: 2 })).toBeVisible();
  });

  test("body_md が無いアイテムは目次ごと出ない", async ({ page }) => {
    // hakata には本文Markdownを投入していない（Tier1のまま）
    await page.goto("/ja/ramen/hakata");
    await expect(page.locator("nav:visible", { hasText: "目次" })).toHaveCount(0);
  });
});

test.describe("マルチジャンル（2ジャンル目はデータ投入のみで生える）", () => {
  test("ジャンルページが自動生成され、図鑑（非地理アイテム）が出る", async ({ page }) => {
    await page.goto("/ja/yakitori");
    await expect(page.getByRole("heading", { name: "焼き鳥", level: 1 })).toBeVisible();
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

  test("トップの「種類からさがす」に自動で増える", async ({ page }) => {
    // 2026-08 デザイン確定でジャンルチップは共通ヘッダー配下ではなく、
    // ボトムシート内「種類からさがす」カードに移設された。シートを開いて確認する。
    await page.goto("/ja");
    const toggle = page.getByRole("button", { name: /シートを次の段階へ/ });
    await toggle.click();
    await toggle.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("link", { name: "ラーメン" })).toBeVisible();
    await expect(sheet.getByRole("link", { name: "焼き鳥" })).toBeVisible();
  });
});

test.describe("二層構造（寿司×ネタ）", () => {
  test("スタイル詳細から代表ネタへ辿れる", async ({ page }) => {
    await page.goto("/ja/sushi/edomae-zushi");
    // 4語彙の関係ラベルは「この土地と、この素材」側に出る（2026-08 デザイン確定）
    const conn = page.locator("section:visible", { hasText: "この土地と、この素材" });
    // food_item_relations.type は4語彙（lineage/sibling/contrast/uses）に正規化済み。
    // edomae-zushi→kohada は uses（from=edomae-zushi）なので、edomae-zushi側では
    // 「使われる」（otherIsTo）と表示される（messages.relation.uses）。
    await expect(conn.getByText("使われる").first()).toBeVisible();
    await expect(conn.getByRole("link", { name: /コハダ/ })).toBeVisible();
  });

  test("ネタ詳細に複数の名産地が出て、逆方向にスタイルへ辿れる", async ({ page }) => {
    await page.goto("/ja/sushi/maguro");
    // 名産地（発祥を1つに決められないアイテムの土地との結びつき）は
    // 「この土地と、この素材」セクションの中に出る
    const conn = page.locator("section:visible", { hasText: "この土地と、この素材" });
    await expect(conn.getByRole("link", { name: /大間町/ })).toBeVisible();
    await expect(conn.getByRole("link", { name: /焼津市/ })).toBeVisible();
    // 代表ネタ関係の逆方向（ネタ側からはスタイルとして出る）
    await expect(conn.getByRole("link", { name: /江戸前寿司/ })).toBeVisible();
  });

  test("名産地のアイテムが地域ページにジャンル・層を跨いで合流する", async ({ page }) => {
    await page.goto("/ja/region/aomori");
    // 発祥アイテム（ラーメン）と名産地アイテム（寿司ネタ）が同じページに並ぶ
    await expect(page.getByRole("link", { name: /津軽ラーメン/ })).toBeVisible();
    const maguro = page.getByRole("link", { name: /マグロ/ });
    await expect(maguro).toBeVisible();
    await expect(maguro.getByText("名産地")).toBeVisible();
  });
});

test.describe("食材展開型（和牛・牡蠣）", () => {
  test("ingredient 型ジャンルもジャンル名+件数のカバーになる", async ({ page }) => {
    await page.goto("/ja/wagyu");
    await expect(page.getByRole("heading", { name: "和牛", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /松阪牛/ })).toBeVisible();
  });

  test("銘柄間の関係（但馬牛→神戸ビーフ）が双方向で辿れる", async ({ page }) => {
    await page.goto("/ja/wagyu/kobe-beef");
    const conn = page.locator("section:visible", { hasText: "この土地と、この素材" });
    await expect(conn.getByText("源流", { exact: true })).toBeVisible();
    await expect(conn.getByRole("link", { name: /但馬牛/ })).toBeVisible();
  });

  test("銘柄がデータ投入だけで空白県を埋める（滋賀=近江牛）", async ({ page }) => {
    await page.goto("/ja/region/shiga");
    await expect(page.getByRole("heading", { name: "滋賀県", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /近江牛/ })).toBeVisible();
  });

  test("基底アイテムの名産地が地域ページに合流する（広島=真牡蠣）", async ({ page }) => {
    await page.goto("/ja/region/hiroshima");
    await expect(page.getByRole("link", { name: /広島ラーメン/ })).toBeVisible();
    const magaki = page.getByRole("link", { name: /真牡蠣/ });
    await expect(magaki).toBeVisible();
    await expect(magaki.getByText("名産地")).toBeVisible();
  });
});

test.describe("このサイトについて（About）", () => {
  test("英日両方で表示され、編集方針が公開されている", async ({ page }) => {
    await page.goto("/ja/about");
    await expect(page.getByRole("heading", { name: "このサイトについて" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "編集方針" })).toBeVisible();
    await expect(page.getByText("ランキングや優劣はつけません。")).toBeVisible();

    await page.goto("/en/about");
    await expect(page.getByRole("heading", { name: "About Itadaki Atlas" })).toBeVisible();
    await expect(page.getByText("We do not rank.")).toBeVisible();
  });

  test("トップからリンクで到達できる", async ({ page }) => {
    // 2026-08 デザイン確定で About 導線はボトムシート内（種類カードの下）に移設された。
    await page.goto("/ja");
    const toggle = page.getByRole("button", { name: /シートを次の段階へ/ });
    await toggle.click();
    await toggle.click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("link", { name: "このサイトについて" }).click();
    await expect(page.getByRole("heading", { name: "このサイトについて" })).toBeVisible();
  });
});

test.describe("利用規約 / プライバシーポリシー / お問い合わせ / 共通フッター", () => {
  test("利用規約が英日両方で表示される", async ({ page }) => {
    await page.goto("/ja/terms");
    await expect(page.getByRole("heading", { name: "利用規約", exact: true })).toBeVisible();

    await page.goto("/en/terms");
    await expect(page.getByRole("heading", { name: "Terms of Use", exact: true })).toBeVisible();
  });

  test("プライバシーポリシーにCookieの節がある", async ({ page }) => {
    await page.goto("/ja/privacy");
    await expect(
      page.getByRole("heading", { name: "プライバシーポリシー", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: /Cookie/ })).toBeVisible();
  });

  test("問い合わせフォームから送信できる", async ({ page }) => {
    await page.goto("/ja/contact");

    await page.getByRole("radio", { name: "その他", exact: true }).check();
    await page.getByLabel("お名前", { exact: true }).fill("テスト太郎");
    await page.getByLabel("メールアドレス", { exact: true }).fill("test@example.com");
    await page
      .getByLabel("内容", { exact: true })
      .fill("E2Eテストからの問い合わせです。内容の確認をお願いします。");

    await page.getByRole("button", { name: "送信する" }).click();

    await expect(page.getByRole("status")).toContainText(
      "送信しました。内容を確認のうえ、必要に応じてご連絡します。",
    );
  });

  test("ジャンルページに共通フッターの利用規約リンクが表示される", async ({ page }) => {
    await page.goto("/ja/ramen");
    const footer = page.locator("footer");
    await expect(footer.getByRole("link", { name: "利用規約" })).toBeVisible();
  });
});

test.describe("共通ヘッダー / 言語切替（2026-08 デザイン確定）", () => {
  test("全ページ共通のヘッダーから言語切替できる", async ({ page }) => {
    // トップ（地図画面）
    await page.goto("/ja");
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "English" })).toBeVisible();
    await header.getByRole("link", { name: "English" }).click();
    // next-intl の Link はクライアント側遷移のため、URL 反映を明示的に待つ
    await page.waitForURL(/\/en(\/|$)/);
    expect(new URL(page.url()).pathname).toBe("/en");

    // 通常のコンテンツページでも同じ導線が使える
    await page.goto("/ja/about");
    await page.getByRole("banner").getByRole("link", { name: "English" }).click();
    await page.waitForURL(/\/en\/about(\/|$)/);
    expect(new URL(page.url()).pathname).toBe("/en/about");
  });

  test("SP幅（48pxヘッダー）でも言語切替が省略されない", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await page.goto("/ja");
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "English" })).toBeVisible();
    await expect(header.getByRole("link", { name: "日本語" })).toBeVisible();
  });
});

test.describe("棚ページ + その他アイテムの到達経路（2026-08 デザイン確定）", () => {
  test("棚ページが橙カバー・主要ジャンル・その他アイテムで構成される", async ({ page }) => {
    await page.goto("/ja/noodles");
    await expect(page.getByRole("heading", { name: "麺", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "主なジャンル" })).toBeVisible();
    await expect(page.getByRole("link", { name: /ラーメン/ }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "まだ数の少ない仲間たち" })).toBeVisible();
    await expect(page.getByRole("link", { name: /富士宮やきそば/ })).toBeVisible();
  });

  test("その他アイテムは棚slug経由で詳細ページに到達でき、つながりに同じ棚の仲間が出る", async ({ page }) => {
    await page.goto("/ja/noodles");
    await page.getByRole("link", { name: /富士宮やきそば/ }).click();
    await expect(page).toHaveURL(/\/ja\/noodles\/fujinomiya-yakisoba$/);
    await expect(page.getByRole("heading", { name: "富士宮やきそば", level: 1 })).toBeVisible();

    // つながり（同じ棚の仲間）が出る。行き止まり禁止（現在34件が行き止まりだった問題の解消）
    const conn = page.locator("section:visible", { hasText: "同じ系統を、もっと" });
    await expect(conn).toBeVisible();
    await expect(conn.getByRole("link").first()).toBeVisible();
  });

  test("同じ棚内の異なるアイテムも棚slugのURLで直接開ける（広島=真牡蠣、魚介棚）", async ({ page }) => {
    const res = await page.goto("/ja/seafood/magaki");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "真牡蠣", level: 1 })).toBeVisible();
  });

  test("存在しない棚slugは404", async ({ page }) => {
    const res = await page.goto("/ja/not-a-real-shelf-or-genre");
    expect(res?.status()).toBe(404);
  });

  test("sitemapに棚ページとその他アイテムのURLが出る", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    const xml = await res.text();
    expect(xml).toContain("/ja/noodles</loc>");
    expect(xml).toContain("/ja/noodles/fujinomiya-yakisoba</loc>");
  });
});

test.describe("地域ページの3群化（2026-08 デザイン確定）", () => {
  test("●■◆の3群見出しで表示され、名産地アイテムが正しい棚のURLへリンクする", async ({ page }) => {
    await page.goto("/ja/region/hiroshima");
    await expect(page.getByRole("heading", { name: "広島県", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: /この土地で生まれた/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /この土地が育てる/ })).toBeVisible();

    // 真牡蠣は genre を持たないため、棚(seafood)URLへ正しくリンクする必要がある
    const magaki = page.getByRole("link", { name: /真牡蠣/ });
    await expect(magaki).toBeVisible();
    await expect(magaki).toHaveAttribute("href", "/ja/seafood/magaki");
  });

  test("隣の土地へのチップに、掲載のある隣接県が並ぶ", async ({ page }) => {
    await page.goto("/ja/region/hiroshima");
    const neighbors = page.locator("section", { hasText: "隣の土地へ" });
    await expect(neighbors).toBeVisible();
    // 広島の陸隣接県（岡山・島根・山口）はいずれも掲載データがある
    await expect(neighbors.getByRole("link", { name: "岡山県" })).toBeVisible();
  });
});

test.describe("ジャンルページの新レイアウト（2026-08 デザイン確定）", () => {
  test("系統チップ・CTA・同じ棚の仲間チップが出る（ラーメン=系統あり）", async ({ page }) => {
    await page.goto("/ja/ramen");
    await expect(page.getByRole("heading", { name: "ラーメン", level: 1 })).toBeVisible();

    // 系統チップ（系統色付き。ラーメンのみ）
    const styleNav = page.getByRole("navigation", { name: "系統で選ぶ" });
    await expect(styleNav).toBeVisible();
    await expect(styleNav.getByRole("link", { name: /豚骨/ })).toBeVisible();

    // CTA: 「◯◯の一覧を地図で見る」（橙塗りボタン）
    await expect(page.getByRole("link", { name: "ラーメンの一覧を地図で見る" })).toBeVisible();

    // 末尾: 同じ棚の仲間チップ（棚ページへ）
    const shelfChip = page.getByRole("link", { name: "この棚の仲間" });
    await expect(shelfChip).toBeVisible();
    await expect(shelfChip).toHaveAttribute("href", "/ja/noodles");
  });

  test("系統を持たないジャンルでは系統チップが出ない（焼き鳥）", async ({ page }) => {
    await page.goto("/ja/yakitori");
    await expect(page.getByRole("navigation", { name: "系統で選ぶ" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "焼き鳥の一覧を地図で見る" })).toBeVisible();
  });
});

test.describe("タグページ（興味からさがす。2026-08 デザイン確定）", () => {
  test("/tags は件数>0のタグだけをkind別に表示する", async ({ page }) => {
    await page.goto("/ja/tags");
    await expect(page.getByRole("heading", { name: "興味からさがす", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /中華由来/ })).toBeVisible();
    // 牛肉タグは今回の付与対象外（件数0）なので出ない
    await expect(page.getByRole("link", { name: "牛肉" })).toHaveCount(0);
  });

  test("タグ詳細ページに該当アイテムと近いタグが出る", async ({ page }) => {
    await page.goto("/ja/tag/chinese_derived");
    await expect(page.getByRole("heading", { name: /中華由来/, level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /博多ラーメン/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "近いタグ" })).toBeVisible();
  });

  test("トップの「興味からさがす」カードから/tagsへ到達できる", async ({ page }) => {
    await page.goto("/ja");
    const toggle = page.getByRole("button", { name: /シートを次の段階へ/ });
    await toggle.click();
    await toggle.click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("link", { name: "興味からさがす" }).click();
    await expect(page.getByRole("heading", { name: "興味からさがす", level: 1 })).toBeVisible();
  });

  test("sitemapにタグページのURLが出る（件数>0のみ）", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    const xml = await res.text();
    expect(xml).toContain("/ja/tag/chinese_derived</loc>");
    expect(xml).not.toContain("/ja/tag/beef</loc>");
  });
});
