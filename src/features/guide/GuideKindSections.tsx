import { getTranslations } from "next-intl/server";

import { IndexRow } from "@/components/IndexRow";
import { SectionHeading } from "@/components/SectionHeading";
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
        <section key={group.kind} className="mb-section">
          <SectionHeading count={group.guides.length}>{t(`kind.${group.kind}`)}</SectionHeading>
          <ul className="divide-rule divide-y">
            {group.guides.map((g) => (
              <li key={g.slug}>
                {/* 場所を持つガイド（食の街・市場・祭り等）は県・市を行末に、時期メモを注に添える
                    （2026-09-12「体験と場所」。CLAUDE.md体験原則3=土地との関係で言う） */}
                <IndexRow
                  href={`/guide/${g.slug}`}
                  name={g.title}
                  summary={g.summary}
                  labels={
                    g.pref ? (
                      <span className="type-caption text-muted-foreground">
                        {tp(g.pref as Prefecture)}
                        {g.city ? ` ${g.city}` : ""}
                      </span>
                    ) : null
                  }
                  note={g.whenNote}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
