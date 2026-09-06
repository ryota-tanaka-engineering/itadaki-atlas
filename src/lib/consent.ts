/**
 * 計測 Cookie の同意状態（`.doc/20_data/03_log_design.md` §2）。
 *
 * GA4 は同意が「許可」のときだけ読み込む。Cloudflare Web Analytics は Cookie を使わないので
 * 同意に関係なく動かす。保存先は localStorage（同意そのものは端末ごとの設定なので共有不要）。
 */
export const CONSENT_STORAGE_KEY = "ia-analytics-consent";

export type ConsentState = "granted" | "denied" | "unset";

export function readConsent(storage: Pick<Storage, "getItem"> | null | undefined): ConsentState {
  try {
    const v = storage?.getItem(CONSENT_STORAGE_KEY);
    return v === "granted" || v === "denied" ? v : "unset";
  } catch {
    return "unset";
  }
}

export function writeConsent(
  storage: Pick<Storage, "setItem"> | null | undefined,
  state: Exclude<ConsentState, "unset">,
): void {
  try {
    storage?.setItem(CONSENT_STORAGE_KEY, state);
  } catch {
    // プライベートモード等で保存できない場合は、その場限りの同意として扱う
  }
}

const CHANGE_EVENT = "ia-analytics-consent-change";

/** useSyncExternalStore 用: 同意の変化（同一タブの書き込み・他タブの storage イベント）を購読する。 */
export function subscribeConsent(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** useSyncExternalStore 用: クライアントの現在値。 */
export function getConsentSnapshot(): ConsentState {
  return readConsent(typeof window === "undefined" ? null : window.localStorage);
}

/** 書き込んで購読者へ通知する（Analytics コンポーネントの決定ボタンから呼ぶ）。 */
export function setConsent(state: Exclude<ConsentState, "unset">): void {
  writeConsent(typeof window === "undefined" ? null : window.localStorage, state);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}
