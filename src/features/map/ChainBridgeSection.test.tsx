import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { ChainBridgeSection } from "./ChainBridgeSection";
import type { Chain } from "./queries";

const sampleChain: Chain = {
  slug: "ichiran",
  nameJa: "一蘭",
  nameEn: "Ichiran — tonkotsu ramen chain from Fukuoka",
  bridgeJa: "一蘭の細麺・濃厚豚骨は、博多・久留米の屋台文化から広まった豚骨ラーメンの流れを汲むとされる。",
  bridgeEn:
    "Ichiran's thin noodles and rich tonkotsu broth are said to trace back to the street-stall tonkotsu culture of Hakata and Kurume.",
  recommendations: [
    { key: "hakata", slug: "hakata", genreSlug: "ramen", shelfSlug: "noodles", nameJa: "博多ラーメン", nameEn: "Hakata ramen", nameRomaji: "hakata-ramen" },
    { key: "kurume", slug: "kurume", genreSlug: "ramen", shelfSlug: "noodles", nameJa: "久留米ラーメン", nameEn: "Kurume ramen", nameRomaji: "kurume-ramen" },
  ],
};

describe("ChainBridgeSection", () => {
  it("chainsが空なら何も描画しない（データ駆動でジャンル非表示）", () => {
    const { container } = render(
      <ChainBridgeSection heading="見出し" intro="導入文" chains={[]} locale="ja" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("ja: 日本語名・bridge_ja・推薦アイテムの日本語名を表示する", () => {
    render(
      <ChainBridgeSection heading="その味、ご当地にもあります" intro="導入文" chains={[sampleChain]} locale="ja" />,
    );
    expect(screen.getByText("一蘭")).toBeInTheDocument();
    expect(screen.getByText(sampleChain.bridgeJa)).toBeInTheDocument();
    const hakataLink = screen.getByRole("link", { name: "博多ラーメン" });
    expect(hakataLink).toHaveAttribute("href", "/ramen/hakata");
    expect(screen.getByRole("link", { name: "久留米ラーメン" })).toHaveAttribute(
      "href",
      "/ramen/kurume",
    );
  });

  it("en: 英語名・bridge_en・推薦アイテムの英語名を表示する", () => {
    render(<ChainBridgeSection heading="Heading" intro="Intro" chains={[sampleChain]} locale="en" />);
    expect(screen.getByText(sampleChain.nameEn)).toBeInTheDocument();
    expect(screen.getByText(sampleChain.bridgeEn)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hakata ramen" })).toBeInTheDocument();
  });

  it("推薦アイテムのgenreSlugが無ければ shelfSlug 経由のURLになる（棚内その他アイテム）", () => {
    const chainWithShelfOnlyItem: Chain = {
      ...sampleChain,
      recommendations: [
        {
          key: "nagasaki-champon",
          slug: "nagasaki-champon",
          genreSlug: null,
          shelfSlug: "noodles",
          nameJa: "長崎ちゃんぽん",
          nameEn: "Nagasaki champon",
          nameRomaji: "nagasaki-champon",
        },
      ],
    };
    render(
      <ChainBridgeSection heading="見出し" intro="導入文" chains={[chainWithShelfOnlyItem]} locale="ja" />,
    );
    expect(screen.getByRole("link", { name: "長崎ちゃんぽん" })).toHaveAttribute(
      "href",
      "/noodles/nagasaki-champon",
    );
  });
});
