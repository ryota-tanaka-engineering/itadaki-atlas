import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// next-intl の Link はロケール解決に Provider を要求するため、テストでは素の <a> に差し替える
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { ItemConnections, type RegionPill } from "./ItemConnections";

const baseProps = {
  styleTitle: "同じ系統を、もっと",
  styleSiblings: [],
  viewAllHref: null,
  viewAllLabel: null,
  landTitle: "この土地と、この素材",
  landItems: [],
  regionPageHref: null,
  regionPageLabel: null,
};

describe("ItemConnections 本場（relationType='本場'）の表示", () => {
  it("noteがあれば pill のラベルと理由の一文を両方表示する", () => {
    const regions: RegionPill[] = [
      {
        key: "fukuoka-本場",
        href: "/region/fukuoka",
        label: "福岡県 本場",
        note: "屋台文化から広まった豚骨ラーメンの系譜にあたるため。",
      },
    ];
    render(<ItemConnections {...baseProps} regionsTitle="名産地" regions={regions} />);

    expect(screen.getByText("福岡県 本場")).toBeInTheDocument();
    expect(
      screen.getByText("屋台文化から広まった豚骨ラーメンの系譜にあたるため。"),
    ).toBeInTheDocument();
  });

  it("noteが無いregionでは理由の一文が描画されない", () => {
    const regions: RegionPill[] = [
      { key: "fukuoka-名産地", href: "/region/fukuoka", label: "福岡県 名産地" },
    ];
    const { container } = render(
      <ItemConnections {...baseProps} regionsTitle="名産地" regions={regions} />,
    );

    expect(screen.getByText("福岡県 名産地")).toBeInTheDocument();
    // note用リスト（mt-1.5 space-y-1）が描画されないこと
    expect(container.querySelector(".mt-1\\.5.space-y-1")).toBeNull();
  });

  it("noteありとnoteなしが混在する場合、noteがある行だけ理由が出る", () => {
    const regions: RegionPill[] = [
      { key: "a", href: "/region/a", label: "県A 名産地" },
      { key: "b", href: "/region/b", label: "県B 本場", note: "理由の一文B" },
    ];
    render(<ItemConnections {...baseProps} regionsTitle="名産地" regions={regions} />);

    expect(screen.getByText("県A 名産地")).toBeInTheDocument();
    expect(screen.getByText("県B 本場")).toBeInTheDocument();
    expect(screen.getByText("理由の一文B")).toBeInTheDocument();
    expect(screen.queryByText("理由の一文A")).toBeNull();
  });

  it("regions・landItems・viewAllHref・regionPageHrefが全て空なら何も描画しない", () => {
    const { container } = render(
      <ItemConnections {...baseProps} regionsTitle={null} regions={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
