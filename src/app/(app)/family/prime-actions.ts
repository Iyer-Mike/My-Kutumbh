"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Moving the role. Each of these only carries the request across — who
 * may do what is decided in the database, where it cannot be talked
 * around by a page.
 */

type Result = { ok: boolean; error?: string };

function plainly(message: string, fallback: string): string {
  // The database raises in plain English already; pass it on where it helps
  if (/Only the Prime Member/i.test(message)) return "Only the Prime Member can hand the role on.";
  if (/not in your Kutumbh/i.test(message)) return "That person isn't in your Kutumbh.";
  if (/already have it/i.test(message)) return "You already have it.";
  if (/within the week/i.test(message)) return "The Prime Member has opened the app this week, so the role stays with them.";
  if (/nothing to take back/i.test(message)) return "There's nothing to take back.";
  if (/moved on since/i.test(message)) return "The role has moved on since, so it can't be taken back now.";
  return fallback;
}

export async function handOverPrime(toUserId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("hand_over_prime", { p_to: toUserId });
  if (error) return { ok: false, error: plainly(error.message, "It couldn't be handed over just now.") };
  revalidatePath("/family");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function claimPrime(): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_prime");
  if (error) return { ok: false, error: plainly(error.message, "It couldn't be taken on just now.") };
  revalidatePath("/family");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function reclaimPrime(): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reclaim_prime");
  if (error) return { ok: false, error: plainly(error.message, "It couldn't be taken back just now.") };
  revalidatePath("/family");
  revalidatePath("/dashboard");
  return { ok: true };
}
