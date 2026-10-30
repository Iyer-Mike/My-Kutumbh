"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { familyOf } from "@/lib/family";

/**
 * The family's list of names. Only the Key Member may change it; the
 * database enforces that too (see phase30_family_names.sql).
 */
type Result = { ok: boolean; error?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function asKeyMember() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." as const };
  const f = await familyOf(supabase, user.id);
  if (!f.kutumbhId || !f.isPrime) return { error: "Only the Key Member can change the family list." as const };
  return { supabase, user, kutumbhId: f.kutumbhId };
}

function plainly(message: string): string {
  if (/planned_one_key/.test(message)) return "Someone else is already marked to be the Key Member. Change that first.";
  if (/relation .* does not exist|schema cache/.test(message)) return "The family list isn't switched on yet. Please try again later.";
  return "That didn't work just now. Please try again.";
}

export async function addPlanned(name: string, email: string, isKey: boolean): Promise<Result> {
  const who = await asKeyMember();
  if ("error" in who) return { ok: false, error: who.error };
  const n = name.trim();
  const e = email.trim().toLowerCase();
  if (!n) return { ok: false, error: "Add a name." };
  if (n.length > 60) return { ok: false, error: "That name is too long." };
  if (e && !EMAIL.test(e)) return { ok: false, error: "That doesn't look like an email address." };

  const { error } = await who.supabase.from("kutumbh_planned_members").insert({
    kutumbh_id: who.kutumbhId, name: n, email: e || null, is_key: isKey, created_by: who.user.id,
  });
  if (error) return { ok: false, error: plainly(error.message) };
  revalidatePath("/family");
  return { ok: true };
}

export async function removePlanned(id: string): Promise<Result> {
  const who = await asKeyMember();
  if ("error" in who) return { ok: false, error: who.error };
  const { error } = await who.supabase.from("kutumbh_planned_members").delete().eq("id", id).eq("kutumbh_id", who.kutumbhId);
  if (error) return { ok: false, error: plainly(error.message) };
  revalidatePath("/family");
  return { ok: true };
}

/** Mark who will manage the Kutumbh once they join; null clears it (you stay Key Member). */
export async function setPlannedKey(id: string | null): Promise<Result> {
  const who = await asKeyMember();
  if ("error" in who) return { ok: false, error: who.error };
  const clear = await who.supabase.from("kutumbh_planned_members").update({ is_key: false }).eq("kutumbh_id", who.kutumbhId).eq("is_key", true);
  if (clear.error) return { ok: false, error: plainly(clear.error.message) };
  if (id) {
    const { error } = await who.supabase.from("kutumbh_planned_members").update({ is_key: true }).eq("id", id).eq("kutumbh_id", who.kutumbhId);
    if (error) return { ok: false, error: plainly(error.message) };
  }
  revalidatePath("/family");
  return { ok: true };
}
