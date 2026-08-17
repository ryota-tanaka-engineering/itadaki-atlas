"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "motion/react";

/**
 * 3段階スナップのボトムシート（.doc/30_features/02_ui_ux.md §2.1）。
 *
 * | 段階   | 状態                | 用途 |
 * | peak   | 下部に僅かに表示     | 地図を最大限見せる。ピンタップ時のアイテムカード |
 * | half   | 地図半分 + リスト半分 | 地図とリストを見比べる |
 * | full   | 実質リストページ      | 索引を読む・詳細を読む |
 *
 * ページ遷移なしで地図と詳細を往復できることが体験の核心なので、
 * このシートはアンマウントせず位置だけを変える。
 */
export type Snap = "peak" | "half" | "full";

export const SNAPS: Snap[] = ["peak", "half", "full"];

/** 各スナップでの「シート上端の位置」を viewport 高さに対する比率で持つ。 */
const SNAP_RATIO: Record<Snap, number> = {
  peak: 0.88,
  half: 0.5,
  full: 0.06,
};

export function snapOffset(snap: Snap, viewportHeight: number): number {
  return Math.round(SNAP_RATIO[snap] * viewportHeight);
}

type Props = {
  snap: Snap;
  onSnapChange: (snap: Snap) => void;
  /** ピーク位置に出す要約（アイテム未選択なら索引の見出し） */
  peak: React.ReactNode;
  children: React.ReactNode;
  labelledBy?: string;
};

export function BottomSheet({ snap, onSnapChange, peak, children, labelledBy }: Props) {
  const y = useMotionValue(0);
  const [vh, setVh] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // viewport 高さを実測する。dvh はモバイルのURLバー出没で変わるので resize で追う。
  useEffect(() => {
    const update = () => setVh(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // スナップ変更をアニメーションで反映
  useEffect(() => {
    if (vh === 0) return;
    const controls = animate(y, snapOffset(snap, vh), {
      type: "spring",
      stiffness: 400,
      damping: 40,
    });
    return () => controls.stop();
  }, [snap, vh, y]);

  // full 以外ではリストをスクロールさせない（ドラッグと競合するため）
  useEffect(() => {
    const el = scrollRef.current;
    if (el && snap !== "full") el.scrollTop = 0;
  }, [snap]);

  if (vh === 0) {
    // 初回描画では高さが不明。SSR/CSRの不一致を避けるため描画しない。
    return null;
  }

  const handleDragEnd = (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
    const current = y.get();
    // 速度が乗っていれば方向に1段送る。そうでなければ最も近い段に吸着する。
    const flick = Math.abs(info.velocity.y) > 500;
    if (flick) {
      const i = SNAPS.indexOf(snap);
      const next = info.velocity.y > 0 ? Math.min(i + 1, SNAPS.length - 1) : Math.max(i - 1, 0);
      onSnapChange(SNAPS[next]);
      return;
    }
    const nearest = SNAPS.reduce((best, s) =>
      Math.abs(snapOffset(s, vh) - current) < Math.abs(snapOffset(best, vh) - current) ? s : best,
    );
    onSnapChange(nearest);
  };

  const cycle = () => {
    const i = SNAPS.indexOf(snap);
    onSnapChange(SNAPS[(i + 1) % SNAPS.length]);
  };

  return (
    <motion.div
      role="dialog"
      aria-labelledby={labelledBy}
      aria-modal={false}
      className="bg-background absolute inset-x-0 top-0 z-20 flex flex-col rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.12)]"
      style={{ y, height: vh }}
      drag="y"
      dragConstraints={{ top: snapOffset("full", vh), bottom: snapOffset("peak", vh) }}
      dragElastic={0.02}
      onDragEnd={handleDragEnd}
    >
      {/* つまみ。キーボードでも段階を送れるようにボタンにする（F-07） */}
      <button
        type="button"
        onClick={cycle}
        aria-label={`シートを次の段階へ（現在: ${snap}）`}
        className="flex w-full shrink-0 cursor-grab justify-center py-3 active:cursor-grabbing"
      >
        <span aria-hidden className="bg-muted-foreground/40 h-1.5 w-10 rounded-full" />
      </button>

      <div className="shrink-0 px-4 pb-2">{peak}</div>

      <div
        ref={scrollRef}
        className={`min-h-0 flex-1 overflow-y-auto px-4 pb-8 ${snap === "full" ? "" : "overflow-hidden"}`}
      >
        {children}
      </div>
    </motion.div>
  );
}
