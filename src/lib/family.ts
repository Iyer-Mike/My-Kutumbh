import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_TIME_ZONE } from "@/lib/dates";

export type Membership = {
  kutumbhId: string | null;
  kutumbhName: string | null;
  isPrime: boolean;
  timeZone: string;
};

/**
 * Which Kutumbh this person belongs to, and the zone its days are counted in.
 * A person with no family yet still gets a sensible day.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function familyOf(supabase: SupabaseClient<any, any, any>, userId: string): Promise<Membership> {
  const { data } = await supabase
    .from("kutumbh_members")
    .select("kutumbh_id, role, kutumbhs(name, time_zone)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  const k = data?.kutumbhs as unknown as { name: string | null; time_zone: string | null } | null;
  return {
    kutumbhId: data?.kutumbh_id ?? null,
    kutumbhName: k?.name ?? null,
    isPrime: data?.role === "owner",
    timeZone: k?.time_zone || DEFAULT_TIME_ZONE,
  };
}
