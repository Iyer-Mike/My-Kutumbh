import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { familyOf } from "@/lib/family";
import { hourLocal, todayLocal } from "@/lib/dates";
import { primeState } from "@/lib/prime";

/**
 * Which bottom tabs have news. Booleans only, never counts or content.
 * Every question is asked on its own and any failure just means "no news":
 * a badge must never get in the way of the app.
 */
/** From this hour (family time) a day with nothing logged earns a "!" on Log. */
const EVENING_HOUR = 18;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({}, { status: 401, headers: { "Cache-Control": "no-store" } });

  const out = { home: false, log: false, family: false, profile: false };
  const { kutumbhId, isPrime, timeZone } = await familyOf(supabase, user.id);

  const ask = async (fn: () => Promise<void>) => { try { await fn(); } catch { /* no news */ } };

  await Promise.all([
    // Log: evening has come and this person has logged nothing today
    ask(async () => {
      if (!kutumbhId || hourLocal(timeZone) < EVENING_HOUR) return;
      const { count } = await supabase.from("meal_logs").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).eq("logged_date", todayLocal(timeZone));
      if ((count ?? 0) === 0) out.log = true;
    }),
    // Home: the Key Member changed the menu since this member last looked
    ask(async () => {
      if (!kutumbhId) return;
      const today = todayLocal(timeZone);
      const { data: seen } = await supabase.from("menu_seen").select("seen_at").eq("user_id", user.id).eq("kutumbh_id", kutumbhId).maybeSingle();
      const since = seen?.seen_at ?? new Date(Date.now() - 86400000).toISOString();
      const { count } = await supabase.from("menu_changes").select("kutumbh_id", { count: "exact", head: true })
        .eq("kutumbh_id", kutumbhId).gte("planned_date", today).gt("updated_at", since).neq("author_id", user.id);
      if ((count ?? 0) > 0) out.home = true;
    }),
    // Home, Key Member: festival-menu suggestions waiting for a decision
    ask(async () => {
      if (!kutumbhId || !isPrime) return;
      const { count } = await supabase.from("festival_suggestions").select("id", { count: "exact", head: true })
        .eq("kutumbh_id", kutumbhId).eq("status", "pending");
      if ((count ?? 0) > 0) out.home = true;
    }),
    // Kutumbh: a letter or notice nobody has opened yet
    ask(async () => {
      if (!kutumbhId) return;
      // Only the five the Kutumbh page actually shows: a hidden older one must not keep the "!" lit
      const { data } = await supabase.from("notices").select("read_at")
        .eq("kutumbh_id", kutumbhId).in("kind", ["admin", "allowance", "member", "dishes"])
        .order("created_at", { ascending: false }).limit(5);
      if ((data ?? []).some((n: { read_at: string | null }) => !n.read_at)) out.family = true;
    }),
    // Kutumbh: the Key Member has been away a week (a member may take over),
    // or the role was taken while this person was away (they may reclaim it)
    ask(async () => {
      if (!kutumbhId) return;
      const { data: owner } = await supabase.from("kutumbh_members").select("user_id").eq("kutumbh_id", kutumbhId).eq("role", "owner").limit(1).maybeSingle();
      const st = await primeState(supabase, user.id, kutumbhId, owner?.user_id ?? null, isPrime);
      if (st.canClaim || st.canReclaim) out.family = true;
    }),
    // Kutumbh, Key Member: the monthly stock check is overdue (only once a first count has been made)
    ask(async () => {
      if (!kutumbhId || !isPrime) return;
      const { data } = await supabase.from("pantry_stock_events").select("on_date")
        .eq("kutumbh_id", kutumbhId).eq("kind", "count").order("on_date", { ascending: false }).limit(1);
      const last = data?.[0]?.on_date as string | undefined;
      if (!last) return;
      const days = (new Date(`${todayLocal(timeZone)}T00:00:00Z`).getTime() - new Date(`${last}T00:00:00Z`).getTime()) / 86400000;
      if (days > 35) out.family = true;
    }),
    // Kutumbh, Key Member: things on the shopping list (the pantry has run short)
    ask(async () => {
      if (!kutumbhId || !isPrime) return;
      // Only lines added since this person last opened the shopping list.
      // A list that has been looked at is not news, even while items remain.
      const { data: row } = await supabase.from("user_seen").select("value").eq("user_id", user.id).eq("key", "shop_seen").maybeSingle();
      const seen = typeof row?.value === "string" ? row.value : "";
      let q = supabase.from("shopping_items").select("id", { count: "exact", head: true })
        .eq("kutumbh_id", kutumbhId).eq("status", "open");
      if (seen && !Number.isNaN(Date.parse(seen))) q = q.gt("created_at", seen);
      const { count } = await q;
      if ((count ?? 0) > 0) out.family = true;
    }),
    // Profile, Admin only: somebody is waiting to be let in, a family has written
    // back and not been read (a welcome note to one person has no family: not a reply), or the app has met a fault in the last day
    ask(async () => {
      const { data: isAdmin } = await supabase.rpc("is_app_admin");
      if (isAdmin !== true) return;
      const [waiting, notices, faults] = await Promise.all([
        supabase.rpc("admin_waiting"), supabase.rpc("admin_notices"), supabase.rpc("admin_faults"),
      ]);
      const w = Array.isArray(waiting.data) && waiting.data.length > 0;
      const unreadReply = Array.isArray(notices.data) && notices.data.some((n: { from_admin: boolean; read_at: string | null; kutumbh_id: string | null }) => !n.from_admin && !n.read_at && n.kutumbh_id != null);
      const dayAgo = Date.now() - 86_400_000;
      const fault = Array.isArray(faults.data) && faults.data.some((f: { last_seen: string }) => new Date(f.last_seen).getTime() > dayAgo);
      if (w || unreadReply || fault) out.profile = true;
    }),
  ]);

  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
