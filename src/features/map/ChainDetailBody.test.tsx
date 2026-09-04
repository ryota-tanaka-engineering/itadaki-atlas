import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { ChainDetailBody } from "./ChainDetailBody";
import type { ConnectionCard } from "./ItemConnections";
import type { OtherChain } from "./ChainDetailBody";

// このファイルは同じ見出しテキスト（例:「この味が好きなら」）の有無を複数の it() で
// 検証するため、RTL自動クリーンアップ（globals:false構成では効かない）に頼らず明示的にDOMを畳む。
afterEach(() => {
  cleanup();
});

const recommendItems: ConnectionCard[] = [
  { key: "hakata", href: "/ramen/hakata", name: "博多ラーメン" },
  { key: "kurume", href: "/ramen/kurume", name: "久留米ラーメン" },
];

const otherChains: OtherChain[] = [
  { slug: "ippudo", name: "一風堂" },
  { slug: "tenkaippin", name: "天下一品" },
];

describe("ChainDetailBody", () => {
  it("bridge文を表示する", () => {
    render(
      <ChainDetailBody
        bridge="一蘭の細麺・濃厚豚骨は、博多・久留米の屋台文化から広まった豚骨ラーメンの流れを汲むとされる。"
        style={null}
        styleLabel="系統"
        founded={null}
        foundedLabel="創業"
        recommendHeading="この味が好きなら"
        recommendItems={[]}
        otherChainsHeading="他のチェーンも見る"
        otherChains={[]}
        genreHref={null}
        genreLinkLabel={null}
      />,
    );
    expect(
      screen.getByText(
        "一蘭の細麺・濃厚豚骨は、博多・久留米の屋台文化から広まった豚骨ラーメンの流れを汲むとされる。",
      ),
    ).toBeInTheDocument();
  });

  it("style・foundedが無ければ事実欄ごと出ない", () => {
    const { container } = render(
      <ChainDetailBody
        bridge="bridge"
        style={null}
        styleLabel="系統"
        founded={null}
        foundedLabel="創業"
        recommendHeading="この味が好きなら"
        recommendItems={[]}
        otherChainsHeading="他のチェーンも見る"
        otherChains={[]}
        genreHref={null}
        genreLinkLabel={null}
      />,
    );
    expect(container.querySelector("dl")).not.toBeInTheDocument();
  });

  it("style・foundedがあれば事実として表示する", () => {
    render(
      <ChainDetailBody
        bridge="bridge"
        style="豚骨（天然とんこつ）"
        styleLabel="系統"
        founded="1960年・福岡市"
        foundedLabel="創業"
        recommendHeading="この味が好きなら"
        recommendItems={[]}
        otherChainsHeading="他のチェーンも見る"
        otherChains={[]}
        genreHref={null}
        genreLinkLabel={null}
      />,
    );
    expect(screen.getByText("系統")).toBeInTheDocument();
    expect(screen.getByText("豚骨（天然とんこつ）")).toBeInTheDocument();
    expect(screen.getByText("創業")).toBeInTheDocument();
    expect(screen.getByText("1960年・福岡市")).toBeInTheDocument();
  });

  it("推薦アイテムをカードで表示し、hrefが解決済みの値のまま出る", () => {
    render(
      <ChainDetailBody
        bridge="bridge"
        style={null}
        styleLabel="系統"
        founded={null}
        foundedLabel="創業"
        recommendHeading="この味が好きなら"
        recommendItems={recommendItems}
        otherChainsHeading="他のチェーンも見る"
        otherChains={[]}
        genreHref={null}
        genreLinkLabel={null}
      />,
    );
    expect(screen.getByRole("heading", { name: "この味が好きなら" })).toBeInTheDocument();
    const hakataLink = screen.getByRole("link", { name: "博多ラーメン" });
    expect(hakataLink).toHaveAttribute("href", "/ramen/hakata");
    expect(screen.getByRole("link", { name: "久留米ラーメン" })).toHaveAttribute(
      "href",
      "/ramen/kurume",
    );
  });

  it("推薦アイテムが空ならセクションごと出ない", () => {
    render(
      <ChainDetailBody
        bridge="bridge"
        style={null}
        styleLabel="系統"
        founded={null}
        foundedLabel="創業"
        recommendHeading="この味が好きなら"
        recommendItems={[]}
        otherChainsHeading="他のチェーンも見る"
        otherChains={[]}
        genreHref={null}
        genreLinkLabel={null}
      />,
    );
    expect(screen.queryByRole("heading", { name: "この味が好きなら" })).not.toBeInTheDocument();
  });

  it("他のチェーンを丸ピルで表示する", () => {
    render(
      <ChainDetailBody
        bridge="bridge"
        style={null}
        styleLabel="系統"
        founded={null}
        foundedLabel="創業"
        recommendHeading="この味が好きなら"
        recommendItems={[]}
        otherChainsHeading="他のチェーンも見る"
        otherChains={otherChains}
        genreHref={null}
        genreLinkLabel={null}
      />,
    );
    expect(screen.getByRole("link", { name: "一風堂" })).toHaveAttribute("href", "/chain/ippudo");
    expect(screen.getByRole("link", { name: "天下一品" })).toHaveAttribute(
      "href",
      "/chain/tenkaippin",
    );
  });

  it("genreHref/genreLinkLabelがあればジャンルへのリンクが出る", () => {
    render(
      <ChainDetailBody
        bridge="bridge"
        style={null}
        styleLabel="系統"
        founded={null}
        foundedLabel="創業"
        recommendHeading="この味が好きなら"
        recommendItems={[]}
        otherChainsHeading="他のチェーンも見る"
        otherChains={[]}
        genreHref="/ramen"
        genreLinkLabel="ラーメンの一覧へ"
      />,
    );
    expect(screen.getByRole("link", { name: "ラーメンの一覧へ" })).toHaveAttribute(
      "href",
      "/ramen",
    );
  });
});
