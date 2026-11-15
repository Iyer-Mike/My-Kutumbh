"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canMailOthers, tellNewcomer } from "@/lib/mail";
import { decisionLetter } from "@/lib/door-letter";
import { logFault } from "@/lib/faults";

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

export async function decideOn(
  userId: string, admit: boolean, note: string,
  who?: { name: string | null; email: string | null; signature: string | null },
): Promise<{ ok: boolean; error?: string; mailed?: boolean }> {
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

  // Tell the newcomer by email when the app is able to write to other people.
  // When it is not, the Admin Desk offers the same letter to send by hand.
  let mailed = false;
  if (who?.email && canMailOthers()) {
    const letter = decisionLetter({
      name: who.name, admit, note, signature: who.signature,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://my-kutumbh.vercel.app",
    });
    const sent = await tellNewcomer(who.email, letter.subject, letter.text);
    mailed = sent.ok;
    if (!sent.ok) await logFault(supabase, { where: "door-letter", error: sent.why ?? "send_failed", userId });
  }

  revalidatePath("/admin");
  return { ok: true, mailed };
}
