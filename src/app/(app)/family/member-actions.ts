"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Showing someone out, and letting oneself out.
 *
 * Who may do either is decided in the database. These only carry the
 * request across and turn a raised exception into a sentence.
 */

type Result = { ok: boolean; error?: string };

function plainly(message: string): string {
  if (/not_the_prime_member/.test(message)) return "Only the Key Member can remove someone.";
  if (/cannot_remove_yourself/.test(message)) return "You can't remove yourself. Hand the role on first, then leave.";
  if (/not_in_your_kutumbh/.test(message)) return "That person isn't in your Kutumbh.";
  if (/hand_the_role_on_first/.test(message))
    return "You look after this Kutumbh, and others depend on it. Hand the role to another member first, then you can leave.";
  if (/not_in_a_kutumbh/.test(message)) return "You aren't in a Kutumbh.";
  return "That didn't work just now. Please try again.";
}

/** The Key Member removes a member. */
export async function removeMember(userId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { p_user: userId });
  if (error) return { ok: false, error: plainly(error.message) };
  revalidatePath("/family");
  return { ok: true };
}

/** A member leaves of their own accord. */
export async function leaveKutumbh(): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_kutumbh");
  if (error) return { ok: false, error: plainly(error.message) };
  revalidatePath("/family");
  revalidatePath("/dashboard");
  return { ok: true };
}
