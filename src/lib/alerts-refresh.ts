// The bottom-bar "!" badges are fetched by BottomNav. Anything that changes
// what they should say calls refreshAlerts() so the badge follows at once,
// instead of waiting for the next page change.
export const ALERTS_EVENT = "mk-alerts-refresh";
const SHOP_COOKIE = "mk-shop-seen";

export function refreshAlerts() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ALERTS_EVENT));
}

/** Remember (on this device) that the shopping list has been looked at now. */
export function markShoppingSeen() {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${SHOP_COOKIE}=${encodeURIComponent(new Date().toISOString())}; path=/; max-age=31536000; samesite=lax`;
  } catch { /* a badge is never worth an error */ }
  refreshAlerts();
}

export const SHOP_SEEN_COOKIE = SHOP_COOKIE;
