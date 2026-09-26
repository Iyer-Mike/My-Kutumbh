import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The Admin Desk's data.
 *
 * Every figure here comes from a database function that sees everything,
 * checks who is asking, and hands back only a count, a time or a total.
 * No food name, no lab value, no question put to the coach, no
 * photograph passes through this file — there is nothing here to leak.
 *
 * A member who is not the Admin gets an error from the database, which
 * arrives as an empty answer and a page that says it is not found.
 */

export type Household = {
  kutumbh_id: string;
  name: string | null;
  prime_name: string | null;
  members: number;
  created_at: string;
  last_logged: string | null;   // a date, the last day this family logged food
  logs_7d: number;
  logs_total: number;
  spend_month: number;
};

export type FeatureSpend = { feature: string; calls: number; spend_month: number };
export type Stranded = { full_name: string; joined: string; confirmed: boolean };
export type Invite = { kutumbh_name: string; made: string; expires: string; active: boolean; used: number };
export type AdminNotice = {
  id: string; kutumbh_id: string; kutumbh_name: string | null; title: string;
  body: string | null; from_admin: boolean; created_at: string; read_at: string | null;
};

export type Desk = {
  isAdmin: boolean;
  households: Household[];
  features: FeatureSpend[];
  stranded: Stranded[];
  invites: Invite[];
  notices: AdminNotice[];
  appSpend: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadDesk(supabase: SupabaseClient<any, any, any>): Promise<Desk> {
  const { data: isAdmin } = await supabase.rpc("is_app_admin");
  if (!isAdmin) {
    return { isAdmin: false, households: [], features: [], stranded: [], invites: [], notices: [], appSpend: 0 };
  }

  const [h, f, s, i, n, total] = await Promise.all([
    supabase.rpc("admin_households"),
    supabase.rpc("admin_spend_by_feature"),
    supabase.rpc("admin_stranded_people"),
    supabase.rpc("admin_invites"),
    supabase.rpc("admin_notices"),
    supabase.rpc("ai_spend_month_total"),
  ]);

  return {
    isAdmin: true,
    households: (h.data ?? []) as Household[],
    features:   (f.data ?? []) as FeatureSpend[],
    stranded:   (s.data ?? []) as Stranded[],
    invites:    (i.data ?? []) as Invite[],
    notices:    (n.data ?? []) as AdminNotice[],
    appSpend:   Number(total.data ?? 0),
  };
}

/** Whole rupees, always — the paisa is not used here either. */
export const money = (amount: number) =>
  amount >= 1 ? `₹${Math.round(amount).toLocaleString("en-IN")}` : amount > 0 ? "under ₹1" : "₹0";

/** "today", "3 days ago", "never" — a family's pulse, in words. */
export function since(iso: string | null): { label: string; days: number | null } {
  if (!iso) return { label: "never", days: null };
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return { label: "today", days: 0 };
  if (days === 1) return { label: "yesterday", days: 1 };
  if (days < 31) return { label: `${days} days ago`, days };
  return { label: `${Math.floor(days / 30)} months ago`, days };
}
