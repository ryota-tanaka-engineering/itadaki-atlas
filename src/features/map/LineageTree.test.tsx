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

import { LineageTree, type LineageNode } from "./LineageTree";

afterEach(() => {
  cleanup();
});

const parent: LineageNode = { key: "gyu-genryu", href: "/wagyu/gyu-genryu", name: "源流アイテム" };
const child: LineageNode = { key: "gyu-hary", href: "/wagyu/gyu-haseiryu", name: "派生アイテム" };
const sibling: LineageNode = { key: "gyu-kyodai", href: "/wagyu/gyu-kyodai", name: "兄弟アイテム" };
const selfName = "自分アイテム";

describe("LineageTree", () => {
  it("親・子・兄弟が揃う場合、全てリンクとして描画する", () => {
    render(
      <LineageTree
        heading="系譜"
        selfName={selfName}
        parents={[parent]}
        childItems={[child]}
        siblings={[sibling]}
      />,
    );

    expect(screen.getByText("系譜")).toBeInTheDocument();
    expect(screen.getByText(selfName)).toBeInTheDocument();

    const parentLink = screen.getByRole("link", { name: "源流アイテム" });
    expect(parentLink).toHaveAttribute("href", "/wagyu/gyu-genryu");

    const childLink = screen.getByRole("link", { name: "派生アイテム" });
    expect(childLink).toHaveAttribute("href", "/wagyu/gyu-haseiryu");

    const siblingLink = screen.getByRole("link", { name: "兄弟アイテム" });
    expect(siblingLink).toHaveAttribute("href", "/wagyu/gyu-kyodai");
  });

  it("自分だけ(親も子も兄弟も無い)の場合は null を返す", () => {
    const { container } = render(
      <LineageTree heading="系譜" selfName="対比のみのアイテム" parents={[]} childItems={[]} siblings={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("親のみの場合でも描画する", () => {
    render(<LineageTree heading="系譜" selfName={selfName} parents={[parent]} childItems={[]} siblings={[]} />);
    expect(screen.getByRole("link", { name: "源流アイテム" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "兄弟アイテム" })).not.toBeInTheDocument();
  });
});
