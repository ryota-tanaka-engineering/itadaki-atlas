import { fetchMapItems } from "@/features/map/queries";
import { MapView } from "@/features/map/MapView";

// データ取得はサーバー側（Platform 01_architecture.md §3）。
// src/app は薄く保ち、ロジックは features に置く（ia-nextjs-standards）。
export default async function Home() {
  const items = await fetchMapItems("ja");

  return (
    <main>
      <h1 className="sr-only">Itadaki Atlas — 日本の食の地理データベース</h1>
      <MapView items={items} />
    </main>
  );
}
