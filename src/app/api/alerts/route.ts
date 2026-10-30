import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { familyOf } from "@/lib/family";
import { todayLocal } from "@/lib/dates";

/**
 * Which bottom tabs have news. Booleans only, never counts or content.
 * Every question is asked on its own and any failure just means "no news":
 * a badge must never get in the way of the app.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({}, { status: 401, headers: { "Cache-Control": "no-store" } });

  const out = { home: false, family: false, profile: false };
  const { kutumbhId, isPrime, timeZone } = await familyOf(supabase, user.id);

  const ask = async (fn: () => Promise<void>) => { try { await fn(); } catch { /* no news */ } };

  await Promise.all([
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
      const { count } = await supabase.from("notices").select("id", { count: "exact", head: true })
        .eq("kutumbh_id", kutumbhId).in("kind", ["admin", "allowance", "member", "dishes"]).is("read_at", null);
      if ((count ?? 0) > 0) out.family = true;
    }),
    // Profile, Admin only: somebody is waiting to be let in
    ask(async () => {
      const { data: isAdmin } = await supabase.rpc("is_app_admin");
      if (isAdmin !== true) return;
      const { data: waiting } = await supabase.rpc("admin_waiting");
      if (Array.isArray(waiting) && waiting.length > 0) out.profile = true;
    }),
  ]);

  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
