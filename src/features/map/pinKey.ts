import type { MapPin } from "./queries";

/**
 * ピンの選択・ハイライトの一意キー（2026-09 本場ピン対応）。
 *
 * kind='honba' は同じ slug（アイテム）が複数都市に別ピンを持ちうる
 * （例: 海鮮丼＝釧路/小樽/函館/金沢の4ピン）ため slug だけでは区別できない。
 * origin ピン・索引（IndexList）からの選択は従来どおり slug そのものが key になる
 * （互換性のため。既存の selectedSlug state と衝突しない）。
 *
 * `./queries.ts` から分離しているのは import 元の都合: queries.ts は
 * `@/lib/supabase/server`（next/headers 依存）を import しているため、
 * クライアントコンポーネントが**値として**そこから何かを import すると
 * サーバー専用コードがクライアントバンドルに巻き込まれてビルドが壊れる
 * （型のみの import は erasure されるため問題ないが、関数はここに置く必要がある）。
 */
export function mapPinKey(pin: Pick<MapPin, "kind" | "slug" | "originPref" | "originCity">): string {
  if (pin.kind !== "honba") return pin.slug;
  return `${pin.slug}::${pin.originPref ?? ""}${pin.originCity ?? ""}`;
}
