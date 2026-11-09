// The bottom-bar "!" badges are fetched by BottomNav. Anything that changes
// what they should say calls refreshAlerts() so the badge follows at once.
import { createClient } from "@/lib/supabase/client";
import { readSeen, writeSeen } from "@/lib/seen";

export const ALERTS_EVENT = "mk-alerts-refresh";

export function refreshAlerts() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ALERTS_EVENT));
}

/** Remember, on the account (so every device agrees), that the shopping list has been looked at now. */
export async function markShoppingSeen() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await writeSeen(supabase, user.id, "shop_seen", new Date().toISOString());
  } catch { /* a badge is never worth an error */ }
  refreshAlerts();
}

export { readSeen };
