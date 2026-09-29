"use server";

import { createClient } from "@/lib/supabase/server";
import { fingerprint } from "@/lib/legal";
import { pendingConsents } from "@/lib/consent";
import { logFault } from "@/lib/faults";

/**
 * Writing down that somebody agreed.
 *
 * The version and the fingerprint come from the documents on the
 * server, never from the browser. If they were posted by the page, a
 * member could be recorded as agreeing to wording that was never on
 * their screen — which is the one thing a consent record exists to
 * rule out.
 *
 * ── Why a plain INSERT, one row at a time ────────────────────────
 *
 * This was an upsert at first, and it failed for every single person:
 *
 *   42P10: there is no unique or exclusion constraint matching the
 *          ON CONFLICT specification
 *
 * consents_once is a PARTIAL unique index (WHERE on_behalf_of IS
 * NULL). Postgres will not infer a partial index from ON CONFLICT
 * unless the statement repeats the same WHERE clause, and PostgREST
 * does not send one. The button simply never worked.
 *
 * So: no ON CONFLICT at all. Only the documents still outstanding are
 * written, and a duplicate key — somebody tapping twice, two taps
 * racing — is treated as the success it is. One row per statement, so
 * that one duplicate cannot roll back a second document that was new.
 */
export async function agreeToEverything(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const pending = await pendingConsents(supabase, user.id);
  if (pending.length === 0) return { ok: true };   // already done, or asked twice

  for (const doc of pending) {
    const { error } = await supabase.from("consents").insert({
      user_id: user.id,
      doc: doc.slug,
      version: doc.version,
      fingerprint: fingerprint(doc),
    });

    // 23505 is the unique index doing its job: this agreement is
    // already recorded, which is exactly what we wanted.
    if (error && error.code !== "23505") {
      await logFault(supabase, {
        where: "agree",
        error: `${error.code ?? "?"} ${error.message}`,
        userId: user.id,
      });
      return { ok: false, error: "That didn't go through. Please try again." };
    }
  }

  return { ok: true };
}
