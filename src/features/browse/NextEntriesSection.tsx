import { Link } from "@/i18n/navigation";

/**
 * トップシート「次の入口」節（体験原則6「行き止まりを作らない」対応。
 * 体験検品2026-09-24「五十音索引で終わり、次の入口が無い」への対処）。
 *
 * 索引の最後まで読み切った人に、地図・索引以外の主要導線（ガイド・興味・土地・
 * このサイトについて・規約系）をまとめて見せる。デザイン規約（CLAUDE.md「デザイン」節）
 * により橙・紙の配色を守り、黒は使わない。SiteFooter は「トップには置かない」設計の
 * 部品のため流用せず、同じリンク先(/terms, /privacy)だけを踏襲した専用コンポーネントにする。
 */
type Props = {
  heading: string;
  guideLabel: string;
  interestLabel: string;
  placeLabel: string;
  aboutLabel: string;
  termsLabel: string;
  privacyLabel: string;
};

export function NextEntriesSection({
  heading,
  guideLabel,
  interestLabel,
  placeLabel,
  aboutLabel,
  termsLabel,
  privacyLabel,
}: Props) {
  const links: { href: "/guide" | "/tags" | "/#place" | "/about" | "/terms" | "/privacy"; label: string }[] = [
    { href: "/guide", label: guideLabel },
    { href: "/tags", label: interestLabel },
    { href: "/#place", label: placeLabel },
    { href: "/about", label: aboutLabel },
    { href: "/terms", label: termsLabel },
    { href: "/privacy", label: privacyLabel },
  ];

  return (
    <section aria-labelledby="next-entries-heading" className="border-border mb-8 border-t pt-6">
      <h2 id="next-entries-heading" className="font-serif mb-2 text-lg">
        {heading}
      </h2>
      <ul className="divide-border divide-y">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-muted-foreground block py-2 text-sm underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
