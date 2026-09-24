import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { Prefecture } from "@/lib/prefectures";

import { GUIDE_KINDS, type GuideKind } from "./kinds";
import type { GuideSummary } from "./types";

/**
 * ガイドをkind別にグルーピングして一覧表示する（`/guide` と `/guide/scene/[scene]` で
 * 共有。見た目・並び順（kind → sort_order）を1箇所にまとめ、両ページでズレないようにする）。
 * 1件も無いkindの見出しは出さない（`/tags` と同じ方針）。
 */
type Props = { guides: GuideSummary[] };

export async function GuideKindSections({ guides }: Props) {
  const t = await getTranslations("guide");
  const tp = await getTranslations("prefecture");

  const groups = GUIDE_KINDS.map((kind: GuideKind) => ({
    kind,
    guides: guides.filter((g) => g.kind === kind),
  })).filter((group) => group.guides.length > 0);

  return (
    <>
      {groups.map((group) => (
        <section key={group.kind} className="mb-10">
          <h2 className="font-serif border-border mb-3 border-b pb-2 text-lg">
            {t(`kind.${group.kind}`)}
          </h2>
          <ul className="divide-border divide-y">
            {group.guides.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/guide/${g.slug}`}
                  className="hover:bg-muted/40 -mx-2 block rounded-md px-2 py-3 transition-colors"
                >
                  <span className="block font-medium">{g.title}</span>
                  {g.summary && (
                    <span className="text-muted-foreground block text-sm">{g.summary}</span>
                  )}
                  {/* 場所を持つガイド（食の街・市場・祭り等）は県・市と時期メモを小さく添える
                      （2026-09-12「体験と場所」。CLAUDE.md体験原則3=土地との関係で言う） */}
                  {(g.pref || g.whenNote) && (
                    <span className="text-muted-foreground mt-1 flex flex-wrap gap-x-2 text-xs">
                      {g.pref && (
                        <span>
                          {tp(g.pref as Prefecture)}
                          {g.city ? ` ${g.city}` : ""}
                        </span>
                      )}
                      {g.whenNote && <span>{g.whenNote}</span>}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
