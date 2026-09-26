"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

/**
 * SP専用のヘッダーメニュー（本番レビュー対応: 詳細ページ・ガイドから他の入口へ
 * 横移動できない問題）。`SiteHeader.tsx` のPCナビ（土地/種類/興味/ガイド）と
 * 同じ4リンクを、メニューボタン押下でヘッダー直下に開くパネルに出す。
 *
 * 状態はこのクライアント部品に閉じ込め、`SiteHeader`（サーバー部品）は
 * `md:hidden` の位置にこれを置くだけにする。PC（md以上）はボタン自体を
 * `md:hidden` で隠すため、既存のPCナビ表示に影響しない。
 */
export function MobileNav() {
  const t = useTranslations("header");
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  // 外側クリックとEscで閉じる。開いている間だけリスナーを張る。
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  const navItems = [
    { key: "navPlace" as const, href: "/#place", mark: <MarkCircle /> },
    { key: "navType" as const, href: "/#type", mark: <MarkSquare /> },
    { key: "navInterest" as const, href: "/tags", mark: <MarkDiamond /> },
    // ガイドは記号を付けない（指示書: アイコンは作らず文字だけ）。
    { key: "navGuide" as const, href: "/guide", mark: null },
  ];

  return (
    // 位置決めの基準はこの div ではなく、`SiteHeader` の `sticky` なヘッダー要素
    // （sticky も absolute の containing block になる）。ここに `relative` を付けると
    // パネルの `top-full` / `inset-x-0` がこの小さな div 基準になり、幅いっぱいに
    // ならないので付けない。
    <div ref={containerRef} className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="border-border bg-background hover:bg-muted/60 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap"
      >
        <MiniMonMark />
        {open ? t("menuClose") : t("menuOpen")}
      </button>

      {open ? (
        <>
          {/* パネルの背後（地図・本文）を触れなくする透明レイヤー。
              ヘッダー(z-40)より上、パネルと同じz-50。パネルはDOM順で後ろに
              置くことで同z値でも視覚的に手前に重なる。 */}
          <div
            className="fixed inset-0 z-50"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            id={panelId}
            className="bg-background absolute inset-x-0 top-full z-50 border-b border-[#eee3d2] shadow-[0_4px_10px_rgba(91,74,55,0.08)] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
          >
            <nav
              aria-label={t("navLabel")}
              className="mx-auto flex max-w-6xl flex-col px-4 py-1 text-sm"
            >
              {navItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="text-foreground/80 hover:text-foreground flex items-center gap-2 border-b border-[#eee3d2] py-3 last:border-b-0"
                >
                  {item.mark}
                  {t(item.key)}
                </Link>
              ))}
            </nav>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** ボタンの記号。三本線（ハンバーガー）の定型を避け、ブランドの三つ紋
 *  （●■◆）を横に小さく並べる。色は `MonMark`（SiteHeader）と同じ。 */
function MiniMonMark() {
  return (
    <svg viewBox="0 0 36 10" width="24" height="7" aria-hidden="true" className="shrink-0">
      <circle cx="5" cy="5" r="3.2" fill="#ff8f00" />
      <rect x="13.8" y="1.8" width="6.4" height="6.4" fill="#e56000" />
      <path d="M27 1.2 L30.8 5 L27 8.8 L23.2 5 Z" fill="#ffc985" />
    </svg>
  );
}

function MarkCircle() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ backgroundColor: "#ff8f00" }}
    />
  );
}

function MarkSquare() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-2 shrink-0"
      style={{ backgroundColor: "#e56000" }}
    />
  );
}

function MarkDiamond() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-2 shrink-0 rotate-45"
      style={{ backgroundColor: "#ffc985" }}
    />
  );
}
