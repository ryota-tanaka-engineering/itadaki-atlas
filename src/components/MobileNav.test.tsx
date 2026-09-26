import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// next-intl の Link はロケール解決に Provider を要求するため、テストでは素の <a> に差し替える
// （既存の CoverInfo.test.tsx / ChainBridgeSection.test.tsx と同じパターン）。
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// useTranslations もキーをそのまま返す簡易モックに差し替える。
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { MobileNav } from "./MobileNav";

// RTL自動クリーンアップ（globals:false構成では効かない）に頼らず明示的にDOMを畳む
// （既存 ChainDetailBody.test.tsx / LineageTree.test.tsx と同じパターン）。
afterEach(() => {
  cleanup();
});

describe("MobileNav（SPヘッダーのメニュー）", () => {
  it("初期状態は閉じている（aria-expanded=false）", () => {
    render(<MobileNav />);
    expect(screen.getByRole("button", { name: "menuOpen" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("押下で aria-expanded が切り替わり、パネルに4本のリンクが出る", () => {
    render(<MobileNav />);
    const button = screen.getByRole("button", { name: "menuOpen" });

    fireEvent.click(button);

    expect(screen.getByRole("button", { name: "menuClose" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("link", { name: "navPlace" })).toHaveAttribute("href", "/#place");
    expect(screen.getByRole("link", { name: "navType" })).toHaveAttribute("href", "/#type");
    expect(screen.getByRole("link", { name: "navInterest" })).toHaveAttribute("href", "/tags");
    expect(screen.getByRole("link", { name: "navGuide" })).toHaveAttribute("href", "/guide");
  });

  it("再度押すと閉じる（aria-expanded=false・リンクが消える）", () => {
    render(<MobileNav />);
    const button = screen.getByRole("button", { name: "menuOpen" });

    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "menuClose" }));

    expect(screen.getByRole("button", { name: "menuOpen" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("link", { name: "navGuide" })).not.toBeInTheDocument();
  });

  it("リンクを押すと閉じる", () => {
    render(<MobileNav />);
    fireEvent.click(screen.getByRole("button", { name: "menuOpen" }));

    fireEvent.click(screen.getByRole("link", { name: "navGuide" }));

    expect(screen.getByRole("button", { name: "menuOpen" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("Escキーで閉じる", () => {
    render(<MobileNav />);
    fireEvent.click(screen.getByRole("button", { name: "menuOpen" }));
    expect(screen.getByRole("button", { name: "menuClose" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByRole("button", { name: "menuOpen" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
