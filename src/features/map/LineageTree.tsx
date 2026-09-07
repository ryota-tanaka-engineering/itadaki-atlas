import { Link } from "@/i18n/navigation";

/**
 * 系統図（LineageTree）。作業パッケージ「詳細ページ概念図」§2。
 *
 * page.tsx が既に取得している「名前つきの関係」（fetchRelated の結果。
 * relationType='lineage' で源流/派生、relationType='sibling' で兄弟）だけを使い、
 * 「親 → 自分 → 子」+「兄弟」を樹形に描く。データ取得はしない（表示専用）。
 *
 * ランキング・優劣を示す表現は入れない（CLAUDE.md「禁止の継続」）。
 * 親も子も兄弟も無いアイテムでは描画しない。
 */
export type LineageNode = {
  key: string;
  href: string;
  name: string;
};

type Props = {
  heading: string;
  /** 現在表示中のアイテム名（リンクにしない。橙のリングで示す）。 */
  selfName: string;
  /** relationType='lineage' で自分が派生(to)側 = 相手が源流(from)側 */
  parents: LineageNode[];
  /** relationType='lineage' で自分が源流(from)側 = 相手が派生(to)側 */
  childItems: LineageNode[];
  /** relationType='sibling' */
  siblings: LineageNode[];
  className?: string;
};

function NodeCard({ node }: { node: LineageNode }) {
  return (
    <Link
      href={node.href}
      className="border-border hover:bg-muted/50 block rounded-lg border px-3 py-1.5 text-sm"
    >
      {node.name}
    </Link>
  );
}

function Connector() {
  return <div aria-hidden className="bg-border h-4 w-px" />;
}

export function LineageTree({ heading, selfName, parents, childItems, siblings, className }: Props) {
  if (parents.length === 0 && childItems.length === 0 && siblings.length === 0) return null;

  return (
    <section aria-labelledby="lineage-heading" className={className}>
      <h2 id="lineage-heading" className="mb-3 text-lg font-semibold">
        {heading}
      </h2>

      <div className="flex flex-col items-center gap-2">
        {parents.length > 0 && (
          <>
            <ul className="flex flex-wrap justify-center gap-2">
              {parents.map((node) => (
                <li key={node.key}>
                  <NodeCard node={node} />
                </li>
              ))}
            </ul>
            <Connector />
          </>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="ring-primary rounded-full px-4 py-1.5 text-sm font-semibold ring-2">
            {selfName}
          </span>
          {siblings.map((node) => (
            <NodeCard key={node.key} node={node} />
          ))}
        </div>

        {childItems.length > 0 && (
          <>
            <Connector />
            <ul className="flex flex-wrap justify-center gap-2">
              {childItems.map((node) => (
                <li key={node.key}>
                  <NodeCard node={node} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
