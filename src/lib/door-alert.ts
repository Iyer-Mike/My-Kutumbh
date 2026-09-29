import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { canSendMail, tellAdminSomebodyWaits } from "./mail.ts";
import { logFault } from "./faults.ts";

/**
 * Telling the Admin that somebody is behind the door.
 *
 * This runs when the newcomer opens the waiting room, which is where
 * both ways in end up: registering with a passcode redirects here, and
 * so does offering a code afterwards. One place to hook rather than
 * two, and the one place that is certainly reached.
 *
 * The order matters and is the whole design:
 *
 *   1. No key configured? Do nothing, claim nothing. When a key is
 *      added later, everyone still waiting gets announced on their
 *      next visit rather than being lost.
 *   2. Claim the right to send. The database hands it to one caller.
 *   3. Send. If it fails, give the claim back and write down why —
 *      the Admin hears about them next time instead of never.
 *
 * It returns nothing and raises nothing. A page must render whether or
 * not the post went out.
 */
export async function tellAdminIfWaiting(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  user: User,
  appUrl: string,
): Promise<void> {
  if (!canSendMail()) return;

  try {
    const { data: mine, error } = await supabase.rpc("admin_notice_claim");
    if (error || mine !== true) return;   // already told, or phase 25 not run

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const name =
      profile?.full_name ??
      (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null);

    const sent = await tellAdminSomebodyWaits({ name, email: user.email ?? null }, appUrl);

    if (!sent.ok) {
      await supabase.rpc("admin_notice_release");
      await logFault(supabase, { where: "door-alert", error: sent.why ?? "send_failed", userId: user.id });
    }
  } catch (e) {
    // The claim may or may not have been taken. Give it back and say so.
    try { await supabase.rpc("admin_notice_release"); } catch { /* nothing more to do */ }
    await logFault(supabase, { where: "door-alert", error: e, userId: user.id });
  }
}
