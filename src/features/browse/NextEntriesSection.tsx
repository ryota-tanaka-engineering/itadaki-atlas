import { Link } from "@/i18n/navigation";

/**
 * トップシート「次の入口」節（体験原則6「行き止まりを作らない」対応。
 * 体験検品2026-09-24「五十音索引で終わり、次の入口が無い」への対処）。
 *
 * 索引の最後まで読み切った人に、地図・索引以外の主要導線（ガイド・興味・土地・
 * このサイトについて・規約系）をまとめて見せる。デザイン規約（CLAUDE.md「デザイン」節）
 * により橙・紙の配色を守り、黒は使わない。SiteFooter は「トップには置かない」設計の
 * 部品のため流用せず、同じリンク先(/terms, /privacy)だけを踏襲した専用コンポーネントにする。
 *
 * PC幅で単一カラム左寄せになっていた問題（体験検品2026-09-26）に対応し、横並び+折り返し
 * （flex-wrap）にする。「土地の索引へ」は `/#place` へのハッシュ遷移ではなく、
 * 「土地からさがす」カードと同じハンドラ（onPlaceClick）を呼ぶボタンにする
 * （体験検品2026-09-26「土地の索引へを押すとシートがfullのまま地図が画面外」対応。
 * ハッシュ遷移だとシートが full のまま「地図をタップする」説明カードに着地し、
 * 肝心の地図が画面外になっていたため）。
 */
type Props = {
  heading: string;
  guideLabel: string;
  interestLabel: string;
  placeLabel: string;
  aboutLabel: string;
  termsLabel: string;
  privacyLabel: string;
  /** 「土地からさがす」カードボタンと同じハンドラ（絞り込み解除+シートを地図が見える段階へ）。 */
  onPlaceClick: () => void;
};

type Entry =
  | { kind: "link"; href: "/guide" | "/tags" | "/about" | "/terms" | "/privacy"; label: string }
  | { kind: "button"; label: string; onClick: () => void };

export function NextEntriesSection({
  heading,
  guideLabel,
  interestLabel,
  placeLabel,
  aboutLabel,
  termsLabel,
  privacyLabel,
  onPlaceClick,
}: Props) {
  const entries: Entry[] = [
    { kind: "link", href: "/guide", label: guideLabel },
    { kind: "link", href: "/tags", label: interestLabel },
    { kind: "button", label: placeLabel, onClick: onPlaceClick },
    { kind: "link", href: "/about", label: aboutLabel },
    { kind: "link", href: "/terms", label: termsLabel },
    { kind: "link", href: "/privacy", label: privacyLabel },
  ];

  return (
    <section aria-labelledby="next-entries-heading" className="border-border mb-8 border-t pt-6">
      <h2 id="next-entries-heading" className="font-serif mb-2 text-lg">
        {heading}
      </h2>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {entries.map((entry) =>
          entry.kind === "link" ? (
            <li key={entry.href}>
              <Link href={entry.href} className="text-muted-foreground text-sm underline">
                {entry.label}
              </Link>
            </li>
          ) : (
            <li key="place">
              <button
                type="button"
                onClick={entry.onClick}
                className="text-muted-foreground text-sm underline"
              >
                {entry.label}
              </button>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
