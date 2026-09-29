import type { SupabaseClient } from "@supabase/supabase-js";
import { DOCS, fingerprint, type Doc } from "./legal.ts";

/**
 * Whether this person has agreed to today's words.
 *
 * Not "has agreed at some point" — the fingerprint of each document is
 * compared with what was signed. Rewrite a paragraph and everyone is
 * asked again, which is the only honest way to change a promise about
 * somebody's medical reports.
 *
 * A child whose guardian agreed on their behalf is not asked again.
 * Putting two documents of terms in front of a twelve-year-old would
 * be a formality performed at the wrong person; the consent that
 * counts was given by whoever can give it.
 *
 * Before phase 26 has run there is no consents table. Everyone carries
 * on as before rather than being shut out of their own food diary by a
 * door that does not exist yet — the same choice `standingOf` makes,
 * for the same reason.
 */
export async function pendingConsents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<Doc[]> {
  // Two ways a document can already be settled for this person:
  //
  //   they agreed themselves      user_id = them, on_behalf_of null
  //   a guardian agreed for them  on_behalf_of = them
  //
  // A row where they are the user_id AND on_behalf_of is set is the
  // opposite case — them agreeing for a child — and settles nothing
  // for themselves, so it must not be counted.
  const { data, error } = await supabase
    .from("consents")
    .select("doc, fingerprint")
    .or(`and(user_id.eq.${userId},on_behalf_of.is.null),on_behalf_of.eq.${userId}`);

  if (error) return [];

  const signed = new Set((data ?? []).map((r: { doc: string; fingerprint: string }) => `${r.doc}:${r.fingerprint}`));
  return DOCS.filter((d) => !signed.has(`${d.slug}:${fingerprint(d)}`));
}
