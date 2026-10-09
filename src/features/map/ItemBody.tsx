import type { BodyChapter } from "./markdown";

/**
 * 詳細ページ本文の目次と章（CLAUDE.md「詳細ページの確定構造」3節）。
 *
 * body_md が無いアイテムは呼び出し側で丸ごとスキップする（章も目次も出さない。
 * Tier1でもページが欠けて見えない設計 — ia-atlas-content Skill 5節）。
 *
 * SP/PCで目次の置き場所が変わる（本文内 / サイドバー）ため、レイアウトの都合上
 * ページ側で2箇所にレンダーされる想定の**表示専用**コンポーネントにしてある
 * （display:none の側はアクセシビリティツリーからも除外されるため重複は実害にならない）。
 */
export function TableOfContents({
  chapters,
  heading,
  className,
}: {
  chapters: BodyChapter[];
  heading: string;
  className?: string;
}) {
  if (chapters.length === 0) return null;
  return (
    <nav aria-label={heading} className={className}>
      <h2 className="type-label mb-2">{heading}</h2>
      <ol className="type-small border-rule space-y-1.5 border-l pl-3">
        {chapters.map((ch, i) => (
          <li key={ch.id}>
            <a href={`#${ch.id}`} className="group text-foreground hover:text-brand-accent-dark">
              <span className="text-brand-accent-dark mr-2 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="link-underline">{ch.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function BodyChapters({ chapters }: { chapters: BodyChapter[] }) {
  return (
    <>
      {chapters.map((ch, i) => (
        <section
          key={ch.id}
          id={ch.id}
          className="mb-section scroll-mt-[calc(var(--header-height)+1rem)]"
        >
          <h2 className="type-title mb-3 flex items-baseline gap-3">
            <span className="text-brand-accent-dark font-sans text-sm font-semibold tabular-nums" aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>
            {ch.title}
          </h2>
          <div className="type-body space-y-4">
            {ch.paragraphs.map((paragraph, pi) => (
              <p key={pi}>
                {paragraph.map((token, ti) =>
                  token.bold ? (
                    <strong key={ti}>{token.text}</strong>
                  ) : (
                    <span key={ti}>{token.text}</span>
                  ),
                )}
              </p>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
