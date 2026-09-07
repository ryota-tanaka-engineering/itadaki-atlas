import type { GuideBlock, InlineToken } from "./markdown";

/**
 * ガイド本文の描画専用コンポーネント（`parseGuideMarkdown` の出力をJSXにする）。
 * 外部リンクは新規タブ + `rel="noopener noreferrer"`（詳細ページと同じ方針）。
 */
export function GuideBody({ blocks }: { blocks: GuideBlock[] }) {
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          const className =
            block.level === 2
              ? "font-serif border-border mt-8 mb-3 border-b pb-2 text-lg first:mt-0"
              : "mt-6 mb-2 text-base font-semibold";
          return block.level === 2 ? (
            <h2 key={i} className={className}>
              {block.text}
            </h2>
          ) : (
            <h3 key={i} className={className}>
              {block.text}
            </h3>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 leading-relaxed">
              {block.items.map((tokens, j) => (
                <li key={j}>{renderInline(tokens)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="leading-relaxed">
            {renderInline(block.tokens)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(tokens: InlineToken[]) {
  return tokens.map((token, i) => {
    if (token.kind === "bold") return <strong key={i}>{token.text}</strong>;
    if (token.kind === "link") {
      return (
        <a
          key={i}
          href={token.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-accent-dark underline"
        >
          {token.text}
        </a>
      );
    }
    return <span key={i}>{token.text}</span>;
  });
}
