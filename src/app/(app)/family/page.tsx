import { createClient } from "@/lib/supabase/server";
import PageNav from "@/components/PageNav";
import InviteButton from "@/components/InviteButton";
import Link from "next/link";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

const DOSHA_COLORS: Record<string, string> = {
  vata:   "#C8832A",
  pitta:  "#D4573A",
  kapha:  "#4A7C44",
};

export default async function FamilyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get the current user's membership (limit 1 so duplicates don't break .single())
  const { data: memberships } = await supabase
    .from("kutumbh_members")
    .select("role, kutumbh_id, kutumbhs(id, name)")
    .eq("user_id", user!.id)
    .limit(1);

  const myMembership = memberships?.[0] ?? null;

  const kutumbhId   = (myMembership?.kutumbhs as unknown as { id: string; name: string } | null)?.id ?? null;
  const kutumbhName = (myMembership?.kutumbhs as unknown as { id: string; name: string } | null)?.name ?? null;
  const isOwner     = myMembership?.role === "owner";

  // ── Member list + profiles + today's meal summary ────────────────
  type MemberRow = {
    user_id: string;
    role: string;
    full_name: string | null;
    primary_dosha: string | null;
    item_count: number;
    kcal_today: number;
    isMe: boolean;
  };

  let members: MemberRow[] = [];

  if (kutumbhId) {
    // 1. All members
    const { data: allMembers } = await supabase
      .from("kutumbh_members")
      .select("user_id, role")
      .eq("kutumbh_id", kutumbhId);

    const memberIds = (allMembers ?? []).map((m) => m.user_id);

    // 2. Profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, primary_dosha")
      .in("id", memberIds);

    const profileMap = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p])
    );

    // 3. Today's meal logs
    const { data: logs } = await supabase
      .from("meal_logs")
      .select("user_id, calories")
      .in("user_id", memberIds)
      .eq("logged_date", todayISO());

    type LogSummary = { count: number; kcal: number };
    const logMap: Record<string, LogSummary> = {};
    (logs ?? []).forEach((log) => {
      if (!logMap[log.user_id]) logMap[log.user_id] = { count: 0, kcal: 0 };
      logMap[log.user_id].count++;
      logMap[log.user_id].kcal += log.calories ?? 0;
    });

    members = (allMembers ?? []).map((m) => {
      const p   = profileMap[m.user_id];
      const lm  = logMap[m.user_id] ?? { count: 0, kcal: 0 };
      return {
        user_id:       m.user_id,
        role:          m.role,
        full_name:     p?.full_name ?? null,
        primary_dosha: p?.primary_dosha ?? null,
        item_count:    lm.count,
        kcal_today:    Math.round(lm.kcal),
        isMe:          m.user_id === user!.id,
      };
    });

    // Prime Member first, then alphabetical
    members.sort((a, b) => {
      if (a.role === "owner" && b.role !== "owner") return -1;
      if (b.role === "owner" && a.role !== "owner") return 1;
      return (a.full_name ?? "").localeCompare(b.full_name ?? "");
    });
  }

  const primeName = members.find((m) => m.role === "owner")?.full_name ?? null;

  let dishTotal = 0;
  let dishPending = 0;
  if (isOwner && kutumbhId) {
    const { data: dishes } = await supabase
      .from("food_items")
      .select("needs_review")
      .eq("kutumbh_id", kutumbhId);
    dishTotal   = dishes?.length ?? 0;
    dishPending = (dishes ?? []).filter((d) => d.needs_review).length;
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#F6F5EE" }}>
      {/* Header */}
      <header
        className="px-5 pt-safe pb-5"
        style={{ background: "linear-gradient(160deg, #1C2B1C 0%, #2E4A2C 70%, #3D6638 100%)" }}
      >
        <PageNav />
        <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>My Kutumbh</p>
        <h1
          className="flex flex-wrap items-baseline gap-x-2 text-xl text-white"
          style={{ fontFamily: "var(--font-dm-serif)" }}
        >
          <span>{kutumbhName ?? "Kutumbh"}</span>
          {primeName && (
            <>
              <span style={{ color: "rgba(255,255,255,0.4)" }}>·</span>
              <span className="font-bold">{primeName}</span>
            </>
          )}
        </h1>
        {kutumbhName && (
          <p className="text-xs mt-1" style={{ color: "#8FBF88" }}>
            {isOwner ? "You're the Prime Member of the Kutumbh" : "You're a member of the Kutumbh"}
          </p>
        )}
      </header>

      <main className="flex-1 px-5 py-6 space-y-5">

        {!kutumbhName ? (
          /* ── No kutumbh yet ── */
          <div className="flex flex-col items-center justify-center text-center pt-16">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-5"
              style={{ background: "#EAF2E8" }}
            >
              🏠
            </div>
            <p className="text-sm" style={{ color: "#5A6055" }}>
              Complete onboarding to set up your Kutumbh.
            </p>
          </div>
        ) : (
          <>
            {/* ── Invite section (owner only) ── */}
            {isOwner && (
              <div
                className="rounded-2xl px-5 py-4 space-y-3"
                style={{ background: "#fff", border: "1px solid #E2E1D8" }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8A9085" }}>
                  Invite a Family Member
                </p>
                <p className="text-xs" style={{ color: "#5A6055" }}>
                  Share the link — anyone who opens it can join your family.
                </p>
                <InviteButton />
              </div>
            )}

            {/* ── Family Dishes (Prime Member only) ── */}
            {isOwner && (
              <Link
                href="/family/dishes"
                className="flex items-center justify-between gap-3 rounded-2xl px-5 py-4"
                style={{ background: "#fff", border: `1.5px solid ${dishPending ? "#E4B774" : "#E2E1D8"}` }}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8A9085" }}>
                    Family Dishes
                  </p>
                  <p className="text-xs mt-1" style={{ color: dishPending ? "#A5661A" : "#5A6055" }}>
                    {dishPending
                      ? `${dishPending} dish${dishPending > 1 ? "es" : ""} need your details`
                      : dishTotal
                        ? `${dishTotal} dish${dishTotal > 1 ? "es" : ""} · all complete`
                        : "Dishes your family adds will appear here"}
                  </p>
                </div>
                <span className="text-lg" style={{ color: "#4A7C44" }}>›</span>
              </Link>
            )}

            {/* ── Member cards ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#8A9085" }}>
                Family · {members.length} member{members.length !== 1 ? "s" : ""}
              </p>

              <div className="space-y-3">
                {members.map((m) => {
                  const dColor = m.primary_dosha ? DOSHA_COLORS[m.primary_dosha.toLowerCase()] ?? "#8A9085" : "#C5DFC2";
                  const initial = m.full_name?.[0]?.toUpperCase() ?? "?";

                  const cardClass = "rounded-2xl px-4 py-3.5 flex items-center gap-4";
                  const cardStyle = {
                    background: "#fff",
                    border: m.isMe ? "1.5px solid #4A7C44" : "1px solid #E2E1D8",
                  };

                  const inner = (
                    <>
                      {/* Avatar */}
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-semibold flex-shrink-0"
                        style={{ background: "#EAF2E8", color: "#4A7C44" }}
                      >
                        {initial}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate" style={{ color: "#1C201C" }}>
                            {m.full_name ?? "Family Member"}
                          </p>
                          {m.isMe && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                              style={{ background: "#EAF2E8", color: "#4A7C44" }}
                            >
                              You
                            </span>
                          )}
                          {m.role === "owner" && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                              style={{ background: "#FBEFD9", color: "#A5661A" }}
                            >
                              ★ Prime Member
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {m.primary_dosha && (
                            <span className="text-xs font-medium" style={{ color: dColor }}>
                              {m.primary_dosha.charAt(0).toUpperCase() + m.primary_dosha.slice(1)}
                            </span>
                          )}
                          {m.primary_dosha && m.item_count > 0 && (
                            <span style={{ color: "#C5DFC2" }}>·</span>
                          )}
                          <span className="text-xs" style={{ color: "#8A9085" }}>
                            {m.item_count > 0
                              ? `${m.item_count} item${m.item_count > 1 ? "s" : ""} today`
                              : "Nothing logged today"}
                          </span>
                        </div>
                      </div>

                      {/* Kcal pill */}
                      {m.kcal_today > 0 && (
                        <div
                          className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold text-center"
                          style={{ background: "#EAF2E8", color: "#4A7C44", minWidth: 60 }}
                        >
                          {m.kcal_today}
                          <br />
                          <span className="font-normal text-[10px]" style={{ color: "#8A9085" }}>kcal</span>
                        </div>
                      )}
                    </>
                  );

                  // The Prime Member can open any member's 7-day consumption
                  return isOwner ? (
                    <Link key={m.user_id} href={`/family/member/${m.user_id}`} className={cardClass} style={cardStyle}>
                      {inner}
                      <span className="text-lg flex-shrink-0" style={{ color: "#8A9085" }}>›</span>
                    </Link>
                  ) : (
                    <div key={m.user_id} className={cardClass} style={cardStyle}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Non-Prime Member: invite note ── */}
            {!isOwner && (
              <p className="text-xs text-center" style={{ color: "#8A9085" }}>
                Ask the Prime Member to invite more members.
              </p>
            )}

            {/* ── Quick link to Log ── */}
            <div className="pt-2">
              <Link
                href="/log"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold"
                style={{ background: "#1C2B1C", color: "#fff" }}
              >
                <span>+</span> Log your meals
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
