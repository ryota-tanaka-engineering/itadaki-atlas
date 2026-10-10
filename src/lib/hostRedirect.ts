/**
 * 旧ホスト（workers.dev）から正規ドメインへの 301（2026-10-10）。
 *
 * 独自ドメインに移るとき、workers.dev を無効化するとインデックス済みの URL が全部 404 になる。
 * workers.dev は残したまま、全パスを `NEXT_PUBLIC_SITE_URL` の同じパスへ恒久転送する。
 *
 * 今は SITE_URL 自体が workers.dev なので何もしない。`.env.production.local` で
 * SITE_URL を独自ドメインにしてデプロイした瞬間から自動で効く（追加作業なし）。
 *
 * 安全側の条件:
 * - 転送元は `*.workers.dev` だけ（プレビューや localhost は転送しない）
 * - 転送先は https かつ localhost でないときだけ（SITE_URL 未注入のビルドで本番を localhost に飛ばさない）
 */
export function canonicalHostRedirect(requestUrl: string, siteUrl: string): string | null {
  let req: URL;
  let site: URL;
  try {
    req = new URL(requestUrl);
    site = new URL(siteUrl);
  } catch {
    return null;
  }
  if (site.protocol !== "https:") return null;
  if (site.hostname === "localhost" || site.hostname === "127.0.0.1") return null;
  if (!req.hostname.endsWith(".workers.dev")) return null;
  if (req.hostname === site.hostname) return null;
  return `${site.origin}${req.pathname}${req.search}`;
}
