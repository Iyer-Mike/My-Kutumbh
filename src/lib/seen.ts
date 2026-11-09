import type { SupabaseClient } from "@supabase/supabase-js";

/** "Already looked at" notes kept per person on the server (table user_seen), so phone and browser agree. */
export async function readSeen<T = unknown>(supabase: SupabaseClient, userId: string, key: string): Promise<T | null> {
  const { data } = await supabase.from("user_seen").select("value").eq("user_id", userId).eq("key", key).maybeSingle();
  return (data?.value ?? null) as T | null;
}

export async function writeSeen(supabase: SupabaseClient, userId: string, key: string, value: unknown) {
  await supabase.from("user_seen").upsert({ user_id: userId, key, value, updated_at: new Date().toISOString() });
}
