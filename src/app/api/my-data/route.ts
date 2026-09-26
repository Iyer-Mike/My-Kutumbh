import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Everything the app holds about one person, handed back to them.
 *
 * Their own rows only — the database's own rules see to that, since
 * this asks with their session and not with any privileged key. A
 * family's shared things (dishes, the pantry, the shopping list) are
 * the family's, and are described rather than copied.
 *
 * Plain JSON, because it should be readable in fifty years by someone
 * who has never heard of this app.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const [profile, logs, records, notices, spend, membership, changes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("meal_logs").select("*").eq("user_id", user.id).order("logged_date", { ascending: true }),
    supabase.from("medical_records").select("*").eq("user_id", user.id).order("report_date", { ascending: true }),
    supabase.from("notices").select("*").eq("user_id", user.id),
    supabase.from("ai_spend").select("feature, model, cost_rupees, created_at").eq("user_id", user.id),
    supabase.from("kutumbh_members").select("kutumbh_id, role, joined_at").eq("user_id", user.id),
    supabase.from("prime_changes").select("*").or(`from_user.eq.${user.id},to_user.eq.${user.id}`),
  ]);

  const bundle = {
    what_this_is:
      "Everything My Kutumbh holds about one person, as it stood when this file was made. " +
      "Dates are as recorded. Money is in rupees. Anything shared with your family — dishes, " +
      "the pantry, the shopping list — belongs to the family and is not copied here.",
    made_on: new Date().toISOString(),
    account: {
      email: user.email,
      signed_up: user.created_at,
      last_signed_in: user.last_sign_in_at,
    },
    profile: profile.data ?? null,
    membership: membership.data ?? [],
    meals_logged: logs.data ?? [],
    medical_records: records.data ?? [],
    notices_to_me: notices.data ?? [],
    ai_spending: spend.data ?? [],
    prime_role_changes: changes.data ?? [],
    counts: {
      meals_logged: (logs.data ?? []).length,
      medical_records: (records.data ?? []).length,
    },
    a_note_about_files:
      "Photographs and uploaded reports are not inside this file. They stay in your account " +
      "until you remove them or ask to be forgotten; ask for them separately if you want copies.",
  };

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-kutumbh-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
