"use server";

import { createClient } from "@/lib/supabase/server";
import { DOCS, fingerprint } from "@/lib/legal";

/**
 * Writing down that somebody agreed.
 *
 * The version and the fingerprint come from the documents on the
 * server, never from the browser. If they were posted by the page, a
 * member could be recorded as agreeing to wording that was never on
 * their screen — which is the one thing a consent record exists to
 * rule out.
 */
export async function agreeToEverything(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const rows = DOCS.map((d) => ({
    user_id: user.id,
    doc: d.slug,
    version: d.version,
    fingerprint: fingerprint(d),
  }));

  // Agreeing twice to the same words is not a second consent, and the
  // unique index says so. Someone who taps twice should not see an
  // error for it.
  const { error } = await supabase
    .from("consents")
    .upsert(rows, { onConflict: "user_id,doc,fingerprint", ignoreDuplicates: true });

  if (error) {
    return {
      ok: false,
      error: /relation .* does not exist/i.test(error.message)
        ? "The app is not quite ready for this yet. Try again shortly."
        : "That didn't go through. Please try again.",
    };
  }

  return { ok: true };
}
