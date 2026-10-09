import { getTranslations } from "next-intl/server";

import { IndexRow } from "@/components/IndexRow";
import { SectionHeading } from "@/components/SectionHeading";
import { fetchPlaceNames } from "@/features/map/queries";
import { disambiguateSameNameEn, translateCityName } from "@/features/map/placeNames";
import type { Prefecture } from "@/lib/prefectures";

import { GUIDE_KINDS, type GuideKind } from "./kinds";
import type { GuideSummary } from "./types";

/**
 * ガイドをkind別にグルーピングして一覧表示する（`/guide` と `/guide/scene/[scene]` で
 * 共有。見た目・並び順（kind → sort_order）を1箇所にまとめ、両ページでズレないようにする）。
 * 1件も無いkindの見出しは出さない（`/tags` と同じ方針）。
 */
type Props = { guides: GuideSummary[]; locale: string };

export async function GuideKindSections({ guides, locale }: Props) {
  const t = await getTranslations("guide");
  const tp = await getTranslations("prefecture");
  // en は市区町村名を place_names で英語表記にする（日本語のまま出さない）
  const placeNames = locale === "en" ? await fetchPlaceNames("en") : {};

  // 「県名 市名」。en は place_names で英語表記にし、県名と市名が同綴りなら区別する
  const placeLabel = (pref: string, city: string | null): string => {
    const prefName = tp(pref as Prefecture);
    if (!city) return prefName;
    if (locale !== "en") return `${prefName} ${city}`;
    const cityName = translateCityName(pref, city, "en", placeNames);
    return disambiguateSameNameEn(prefName, city, cityName) ?? `${prefName} ${cityName}`;
  };

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
                        {placeLabel(g.pref, g.city)}
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
