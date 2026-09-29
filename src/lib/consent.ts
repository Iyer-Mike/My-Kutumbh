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
  const { data, error } = await supabase
    .from("consents")
    .select("doc, fingerprint")
    .eq("user_id", userId)
    .is("on_behalf_of", null);

  if (error) return [];

  const signed = new Set((data ?? []).map((r: { doc: string; fingerprint: string }) => `${r.doc}:${r.fingerprint}`));
  return DOCS.filter((d) => !signed.has(`${d.slug}:${fingerprint(d)}`));
}
