"use client";

import Script from "next/script";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { buttonVariants } from "@/components/ui/button";
import { getConsentSnapshot, setConsent, subscribeConsent, type ConsentState } from "@/lib/consent";

/**
 * 計測タグ（`.doc/20_data/03_log_design.md` §2）。
 *
 * - Cloudflare Web Analytics: Cookie 不要なので常時読み込む（NEXT_PUBLIC_CF_BEACON_TOKEN が
 *   設定されているときだけ）
 * - GA4: 同意バナーで「許可」されたときだけ gtag を読み込む（NEXT_PUBLIC_GA_ID が
 *   設定されているときだけ）。EU/英国からの閲覧を想定し、同意前は一切送らない
 *
 * どちらの環境変数も未設定なら何も描画しない（ローカル・E2E はこの状態）。
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const CF_BEACON_TOKEN = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;

export function Analytics() {
  const t = useTranslations("consent");
  // サーバー描画では "loading"（バナーもタグも出さない）。クライアントで保存値に置き換わる
  const consent: ConsentState | "loading" = useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    () => "loading" as const,
  );
  const decide = (state: "granted" | "denied") => setConsent(state);

  return (
    <>
      {CF_BEACON_TOKEN ? (
        <Script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon={JSON.stringify({ token: CF_BEACON_TOKEN })}
          strategy="afterInteractive"
        />
      ) : null}

      {GA_ID && consent === "granted" ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${GA_ID}',{anonymize_ip:true});`}
          </Script>
        </>
      ) : null}

      {GA_ID && consent === "unset" ? (
        <div
          role="region"
          aria-label={t("label")}
          className="border-border bg-background fixed inset-x-0 bottom-0 z-50 border-t px-4 py-3 shadow-[0_-4px_16px_rgba(91,74,55,0.08)]"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">{t("text")}</p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => decide("denied")}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {t("decline")}
              </button>
              <button
                type="button"
                onClick={() => decide("granted")}
                className={buttonVariants({ size: "sm" })}
              >
                {t("accept")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
