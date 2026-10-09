import { Link } from "@/i18n/navigation";
import { LabelChip } from "@/components/ui/chip";

/*
 * 詳細ページカバー（橙エリア）の情報密度を上げるためのチップ列
 * （2026-09 本番体験レビュー「余白多くて無駄なスペース多い」「情報量が少ない」対応）。
 *
 * 2026-09-30 デザイン刷新: チップ3種（src/components/ui/chip.tsx）に合わせる。
 * - 事実（発祥・系統・距離）は押せない分類ラベル → 罫なし・半透明の白塗り（LabelChip onBrand）
 * - タグはタグページへの遷移リンク → 容器を持たない下線リンク（下線はクリーム）
 * 橙カバー上の2色運用（白文字 / クリーム #ffe9cf）は維持する。
 */
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
    <ul className="mt-5 flex flex-wrap gap-1.5">
      {facts.map((f) => (
        <li key={f.key}>
          <LabelChip tone="onBrand" size="md" dotColor={f.dotColor} dotStroke="#fffdf7">
            {f.label}
          </LabelChip>
        </li>
      ))}
    </ul>
  );
}

export type CoverTag = {
  slug: string;
  label: string;
};

/** タグ: そのアイテムのタグをカバー内に並べ、/tag/[slug] へリンクする。 */
export function CoverTagChips({
  tags,
  ariaLabel,
  label,
}: {
  tags: CoverTag[];
  ariaLabel: string;
  /** 下線リンクの前に置く小さな見出し語（「興味:」）。下線リンクが何への遷移か分かるようにする。 */
  label?: string;
}) {
  if (tags.length === 0) return null;
  return (
    <nav aria-label={ariaLabel} className="mt-3 flex flex-wrap items-baseline gap-x-2">
      {label && (
        <span aria-hidden="true" className="type-caption text-cream">
          {label}
        </span>
      )}
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {tags.map((tag) => (
          <li key={tag.slug}>
            <Link
              href={`/tag/${tag.slug}`}
              className="type-small decoration-cream/70 inline-block py-1 underline decoration-[1.5px] underline-offset-4 hover:decoration-white"
            >
              {tag.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
