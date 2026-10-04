import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// next-intl の Link はロケール解決に Provider を要求するため、テストでは素の <a> に差し替える
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { CoverFactChips, CoverTagChips } from "./CoverInfo";

afterEach(() => cleanup());

describe("CoverFactChips（詳細ページカバーの事実チップ）", () => {
  it("factsが空なら何も描画しない", () => {
    const { container } = render(<CoverFactChips facts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("発祥・系統・東京からの距離のラベルを表示する", () => {
    render(
      <CoverFactChips
        facts={[
          { key: "origin", label: "発祥: 北海道札幌市" },
          { key: "style", label: "味噌", dotColor: "#e08a2e" },
          { key: "distance", label: "東京から北へ約830km" },
        ]}
      />,
    );
    expect(screen.getByText("発祥: 北海道札幌市")).toBeInTheDocument();
    expect(screen.getByText("味噌")).toBeInTheDocument();
    expect(screen.getByText("東京から北へ約830km")).toBeInTheDocument();
  });
});

describe("CoverFactChips 濃さの目盛り（2026-10 詳細ページの情報を厚くする）", () => {
  it("meter があれば ● ○ の目盛りを装飾として添え、ラベルの数値で読み上げる", () => {
    render(<CoverFactChips facts={[{ key: "richness", label: "濃さ: ややこってり（4/5）", meter: { value: 4, max: 5 } }]} />);
    expect(screen.getByText("濃さ: ややこってり（4/5）")).toBeInTheDocument();
    const meter = screen.getByTestId("cover-meter");
    expect(meter).toHaveTextContent("●●●●○");
    expect(meter).toHaveAttribute("aria-hidden", "true");
  });

  it("meter の値が範囲外でも目盛りは max 個に収まる", () => {
    render(<CoverFactChips facts={[{ key: "r", label: "x", meter: { value: 9, max: 5 } }]} />);
    expect(screen.getByTestId("cover-meter")).toHaveTextContent("●●●●●");
  });
});

describe("CoverTagChips（詳細ページカバーのタグチップ）", () => {
  it("tagsが空なら何も描画しない", () => {
    const { container } = render(<CoverTagChips tags={[]} ariaLabel="タグ" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("タグを /tag/[slug] へのリンクとして表示する", () => {
    render(
      <CoverTagChips tags={[{ slug: "chinese_derived", label: "中華由来" }]} ariaLabel="タグ" />,
    );
    const link = screen.getByRole("link", { name: "中華由来" });
    expect(link).toHaveAttribute("href", "/tag/chinese_derived");
  });
});
