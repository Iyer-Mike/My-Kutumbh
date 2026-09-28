"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * The app's own door: writing a passcode, and deciding about somebody
 * who has knocked. Who may do either is settled in the database.
 */

export async function makePasscode(email: string, note: string): Promise<{ ok: boolean; passcode?: string; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_make_invite", {
    p_email: email ?? "",
    p_note: note ?? "",
  });

  if (error) {
    return { ok: false, error: /not_permitted/.test(error.message) ? "That isn't yours to do." : "The passcode wasn't made. Try again." };
  }

  revalidatePath("/admin");
  return { ok: true, passcode: (data as { passcode: string }).passcode };
}

export async function decideOn(userId: string, admit: boolean, note: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_decide", {
    p_user: userId,
    p_admit: admit,
    p_note: note ?? "",
  });

  if (error) {
    return {
      ok: false,
      error: /not_permitted/.test(error.message)
        ? "That isn't yours to do."
        : /nobody_by_that_name/.test(error.message)
        ? "That person is no longer waiting."
        : "It didn't go through. Try again.",
    };
  }

  revalidatePath("/admin");
  return { ok: true };
}
