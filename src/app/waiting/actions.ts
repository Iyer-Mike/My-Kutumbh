"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Whichever code they are holding.
 *
 * Six digits is a family's number; anything else is an Admin passcode.
 * Rather than making a newcomer know the difference, try the likely one
 * first and then the other.
 */
export async function offerCode(code: string): Promise<{ ok: boolean; went?: "family" | "waiting"; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const clean = code.trim();
  const digits = clean.replace(/\D/g, "");

  // A family's six-digit number lets them in at once
  if (digits.length === 6) {
    const { error } = await supabase.rpc("join_with_code", { p_code: digits });
    if (!error) {
      revalidatePath("/family");
      return { ok: true, went: "family" };
    }
    if (/too_many_tries/.test(error.message)) {
      return { ok: false, error: "Too many tries just now. Wait an hour, or ask for a fresh code." };
    }
    if (/in_another_family/.test(error.message)) {
      return { ok: false, error: "You're already in a Kutumbh with other people." };
    }
    if (/invite_expired|invite_closed/.test(error.message)) {
      return { ok: false, error: "That number has expired. Ask the family for a fresh one." };
    }
    // Not a family number after all — fall through and try the other kind
  }

  const { error: claimError } = await supabase.rpc("claim_app_invite", { p_code: clean });
  if (!claimError) {
    revalidatePath("/waiting");
    return { ok: true, went: "waiting" };
  }

  if (/passcode_expired/.test(claimError.message)) {
    return { ok: false, error: "That passcode has expired — they last a day. Ask for a fresh one." };
  }

  return { ok: false, error: "That code wasn't recognised. Check it against the message you were sent." };
}
