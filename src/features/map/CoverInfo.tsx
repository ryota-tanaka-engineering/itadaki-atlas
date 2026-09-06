import { Link } from "@/i18n/navigation";

/**
 * 詳細ページカバー（橙エリア）の情報密度を上げるためのチップ列
 * （2026-09 本番体験レビュー「余白多くて無駄なスペース多い」「情報量が少ない」対応）。
 *
 * 橙カバー上の2色運用（白文字 / クリーム #ffe9cf）を守るため、色は呼び出し側の
 * トークンに揃えてハードコードする。橙塗りボタンと混同しないよう、塗りは
 * 使わず「白抜き/クリームの細罫」だけで縁取る（CLAUDE.md「デザイン」節）。
 */
const CHIP_CLASS =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap";
const CHIP_STYLE = { borderColor: "#ffe9cf", color: "#ffe9cf" } as const;

export type CoverFact = {
  key: string;
  label: string;
  /** 系統チップのみ。系統色のドットを添える。 */
  dotColor?: string;
};

/** 事実の帯: 発祥（県・市）/ 系統 / 東京からの距離。データが無い項目は呼び出し側で配列から外す。 */
export function CoverFactChips({ facts }: { facts: CoverFact[] }) {
  if (facts.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {facts.map((f) => (
        <li key={f.key} className={CHIP_CLASS} style={CHIP_STYLE}>
          {f.dotColor && (
            <span
              aria-hidden
              className="inline-block size-2.5 rounded-full border"
              style={{ backgroundColor: f.dotColor, borderColor: "#fffdf7" }}
            />
          )}
          {f.label}
        </li>
      ))}
    </ul>
  );
}

export type CoverTag = {
  slug: string;
  label: string;
};

/** タグ: そのアイテムのタグをカバー内にチップ表示し、/tag/[slug] へリンクする。 */
export function CoverTagChips({ tags, ariaLabel }: { tags: CoverTag[]; ariaLabel: string }) {
  if (tags.length === 0) return null;
  return (
    <nav aria-label={ariaLabel} className="mt-2">
      <ul className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <li key={tag.slug}>
            <Link href={`/tag/${tag.slug}`} className={`${CHIP_CLASS} hover:bg-white/10`} style={CHIP_STYLE}>
              {tag.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
