import { serializeJsonLd, type JsonLdObject } from "@/lib/jsonld";

/**
 * JSON-LD を `<script type="application/ld+json">` として埋める（2026-10-06）。
 *
 * サーバーコンポーネントで使う。中身は `src/lib/jsonld.ts` の純関数で組み立て、
 * ここでは文字列化（`<` のエスケープ込み）して出すだけ。`dangerouslySetInnerHTML` は
 * JSON 文字列に限って使う（HTML を流し込まない）。
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
