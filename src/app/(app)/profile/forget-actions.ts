"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Leaving the app for good.
 *
 * The files go first, because nothing in the database cascades to
 * stored photographs and reports — delete the account without them and
 * the pictures would quietly outlive the person who asked to be
 * forgotten.
 */
export async function forgetMe(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  // ── Their photographs ──
  try {
    const { data: photo } = await supabase
      .from("profiles").select("photo_path").eq("id", user.id).maybeSingle();
    if (photo?.photo_path) {
      await supabase.storage.from("family-photos").remove([photo.photo_path]);
    }
  } catch {
    // A file that will not budge must not trap someone in the app;
    // the account still goes, and the orphan is cleaned up later.
  }

  // ── Their uploaded reports ──
  try {
    const { data: records } = await supabase
      .from("medical_records").select("file_url").eq("user_id", user.id);
    const paths = (records ?? [])
      .map((r: { file_url: string | null }) => r.file_url)
      .filter((p): p is string => !!p);
    if (paths.length) await supabase.storage.from("medical-records").remove(paths);
  } catch {
    // as above
  }

  // ── The account itself ──
  const { error } = await supabase.rpc("forget_me");
  if (error) {
    if (/Hand the Kutumbh on first/i.test(error.message)) {
      return {
        ok: false,
        error:
          "You look after your Kutumbh, and others depend on it. Hand the role to another " +
          "member on the family page first, then come back — otherwise the household would be " +
          "left with nobody able to complete a dish or invite anyone.",
      };
    }
    return { ok: false, error: "Something went wrong, and nothing was deleted. Please try again." };
  }

  await supabase.auth.signOut();
  return { ok: true };
}
