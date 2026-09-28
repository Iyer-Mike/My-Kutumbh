import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Whether this person has been let into My Kutumbh at all.
 *
 * Two doors: the Admin admits a household to the app, and a Prime
 * Member admits people to their family. This is the first.
 *
 * Someone waiting has an account and nothing else — no family, no
 * logging, no coach, and no way to spend anyone's money.
 */

export type Standing = "admitted" | "waiting" | "declined" | "unknown";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function standingOf(supabase: SupabaseClient<any, any, any>, userId: string): Promise<Standing> {
  const { data, error } = await supabase
    .from("app_admissions")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  // Before phase 24 has run there is no such table. Everyone carries on
  // as before rather than being shut out by a door that does not exist.
  if (error) return "admitted";

  if (!data) return "unknown";
  if (data.status === "admitted") return "admitted";
  if (data.status === "declined") return "declined";
  return "waiting";
}
