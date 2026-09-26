import { createClient } from "@/lib/supabase/server";
import PageNav from "@/components/PageNav";
import Face from "@/components/Face";
import FacePicker from "@/components/FacePicker";
import { signedFaces } from "@/lib/faces";
import NoticesCard, { type Notice } from "@/components/NoticesCard";
import InviteButton from "@/components/InviteButton";
import Link from "next/link";
import { todayLocal } from "@/lib/dates";
import { familyOf } from "@/lib/family";
import FamilyTimeZoneCard from "@/components/FamilyTimeZoneCard";

const DOSHA_COLORS: Record<string, string> = {
  vata:   "#C8832A",
  pitta:  "#D4573A",
  kapha:  "#6B46B8",
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
  const { timeZone } = await familyOf(supabase, user!.id);

  const kutumbhId   = (myMembership?.kutumbhs as unknown as { id: string; name: string } | null)?.id ?? null;
  const kutumbhName = (myMembership?.kutumbhs as unknown as { id: string; name: string } | null)?.name ?? null;
  const isOwner     = myMembership?.role === "owner";

  // ── Member list + profiles + today's meal summary ────────────────
  type MemberRow = {
    user_id: string;
    role: string;
    full_name: string | null;
    primary_dosha: string | null;
    photo_path: string | null;
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
      .from("family_roster")
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
      .eq("logged_date", todayLocal(timeZone));

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
        photo_path:    null as string | null,   // filled in below
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

  // Faces are asked for on their own, so the page still opens where the
  // photo store has not been made yet
  const { data: faceRows } = kutumbhId
    ? await supabase.from("family_roster").select("id, photo_path").in("id", members.map((m) => m.user_id))
    : { data: null };
  for (const row of faceRows ?? []) {
    const m = members.find((x) => x.user_id === row.id);
    if (m) m.photo_path = row.photo_path;
  }

  // The family together, and each face in it
  const { data: kutumbhRow } = kutumbhId
    ? await supabase.from("kutumbhs").select("photo_path").eq("id", kutumbhId).maybeSingle()
    : { data: null };
  const familyPhoto: string | null = kutumbhRow?.photo_path ?? null;
  const faceUrls = await signedFaces(supabase, [...members.map((m) => m.photo_path), familyPhoto]);

  const { data: noticeRows } = kutumbhId
    ? await supabase
        .from("notices")
        .select("id, kind, title, body, from_admin, created_at, read_at")
        .eq("kutumbh_id", kutumbhId)
        .in("kind", ["admin", "allowance", "member", "dishes"])
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: null };
  const notices = (noticeRows ?? []) as Notice[];

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

  // Pantry Shelf, at a glance
  let shelfCount = 0;
  let toBuy = 0;
  if (kutumbhId) {
    const [{ count: shelf }, { count: buying }] = await Promise.all([
      supabase.from("pantry_items").select("id", { count: "exact", head: true }).eq("kutumbh_id", kutumbhId),
      supabase.from("shopping_items").select("id", { count: "exact", head: true })
        .eq("kutumbh_id", kutumbhId).eq("status", "open"),
    ]);
    shelfCount = shelf ?? 0;
    toBuy = buying ?? 0;
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#F3EEFA" }}>
      {/* Header */}
      <header
        className="px-5 pt-safe pb-5"
        style={{ background: "linear-gradient(160deg, #241238 0%, #3A2260 70%, #4E3080 100%)" }}
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
          <p className="text-xs mt-1" style={{ color: "#C9B8E4" }}>
            {isOwner ? "You're the Prime Member of the Kutumbh" : "You're a member of the Kutumbh"}
          </p>
        )}
      </header>

      <main className="flex-1 px-5 py-6 space-y-5">

        {notices.length > 0 && <NoticesCard notices={notices} isPrime={isOwner} />}

        {/* The family together. The Prime Member keeps it; everyone sees it. */}
        {kutumbhId && (familyPhoto || isOwner) && (
          <section className="rounded-2xl px-4 py-5 grid gap-1 justify-items-center"
            style={{ background: "#FAF7FE", border: "1px solid #E0D4F2" }}>
            {isOwner ? (
              <FacePicker
                kutumbhId={kutumbhId}
                subject={{ kind: "family" }}
                name={kutumbhName}
                url={familyPhoto ? faceUrls[familyPhoto] : null}
                currentPath={familyPhoto}
                size={96}
                label="Add the family photo"
              />
            ) : (
              <Face url={familyPhoto ? faceUrls[familyPhoto] : null} name={kutumbhName} size={96} />
            )}
            <p className="text-[11px] mt-1 text-center m-0" style={{ color: "#6A6180" }}>
              {familyPhoto ? kutumbhName : "A picture of everyone, for the top of this page"}
            </p>
          </section>
        )}

        {!kutumbhName ? (
          /* ── No kutumbh yet ── */
          <div className="flex flex-col items-center justify-center text-center pt-16">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-5"
              style={{ background: "#E7DCF7" }}
            >
              🏠
            </div>
            <p className="text-sm" style={{ color: "#625A75" }}>
              Complete onboarding to set up your Kutumbh.
            </p>
          </div>
        ) : (
          <>
            {/* ── Invite section (owner only) ── */}
            {isOwner && (
              <div
                className="rounded-2xl px-5 py-4 space-y-3"
                style={{ background: "#FAF7FE", border: "1px solid #E0D4F2" }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6A6180" }}>
                  Invite a Family Member
                </p>
                <p className="text-xs" style={{ color: "#625A75" }}>
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
                style={{ background: "#FAF7FE", border: `1.5px solid ${dishPending ? "#F2B531" : "#E0D4F2"}` }}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6A6180" }}>
                    Family Dishes
                  </p>
                  <p className="text-xs mt-1" style={{ color: dishPending ? "#8A5A06" : "#625A75" }}>
                    {dishPending
                      ? `${dishPending} dish${dishPending > 1 ? "es" : ""} need your details`
                      : dishTotal
                        ? `${dishTotal} dish${dishTotal > 1 ? "es" : ""} · all complete`
                        : "Dishes your family adds will appear here"}
                  </p>
                </div>
                <span className="text-lg" style={{ color: "#6B46B8" }}>›</span>
              </Link>
            )}

            {/* ── Pantry Shelf (everyone: anyone can flag what's low) ── */}
            <Link
              href="/pantry"
              className="flex items-center justify-between gap-3 rounded-2xl px-5 py-4"
              style={{ background: "#FAF7FE", border: `1.5px solid ${toBuy ? "#F2B531" : "#E0D4F2"}` }}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6A6180" }}>
                  Pantry Shelf
                </p>
                <p className="text-xs mt-1" style={{ color: toBuy ? "#8A5A06" : "#625A75" }}>
                  {toBuy
                    ? `${toBuy} thing${toBuy > 1 ? "s" : ""} to buy`
                    : shelfCount
                      ? `${shelfCount} item${shelfCount > 1 ? "s" : ""} on the shelf · nothing to buy`
                      : "What the kitchen holds, and what needs buying"}
                </p>
              </div>
              <span className="text-lg" style={{ color: "#6B46B8" }}>›</span>
            </Link>

            {/* ── The family's day (Prime Member) ── */}
            {isOwner && kutumbhId && (
              <FamilyTimeZoneCard kutumbhId={kutumbhId} timeZone={timeZone} />
            )}

            {/* ── Recipes ── */}
            <Link
              href="/recipes"
              className="flex items-center justify-between gap-3 rounded-2xl px-5 py-4"
              style={{ background: "#FAF7FE", border: "1.5px solid #E0D4F2" }}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6A6180" }}>
                  Recipes
                </p>
                <p className="text-xs mt-1" style={{ color: "#625A75" }}>
                  How every dish on the menu is cooked
                </p>
              </div>
              <span className="text-lg" style={{ color: "#6B46B8" }}>›</span>
            </Link>

            {/* ── Member cards ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#6A6180" }}>
                Family · {members.length} member{members.length !== 1 ? "s" : ""}
              </p>

              <div className="space-y-3">
                {members.map((m) => {
                  const dColor = m.primary_dosha ? DOSHA_COLORS[m.primary_dosha.toLowerCase()] ?? "#6A6180" : "#CBB4EE";

                  const cardClass = "rounded-2xl px-4 py-3.5 flex items-center gap-4";
                  const cardStyle = {
                    background: "#FAF7FE",
                    border: m.isMe ? "1.5px solid #6B46B8" : "1px solid #E0D4F2",
                  };

                  const inner = (
                    <>
                      <Face url={faceUrls[m.photo_path ?? ""]} name={m.full_name} size={44} />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate" style={{ color: "#241C33" }}>
                            {m.full_name ?? "Family Member"}
                          </p>
                          {m.isMe && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                              style={{ background: "#E7DCF7", color: "#6B46B8" }}
                            >
                              You
                            </span>
                          )}
                          {m.role === "owner" && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                              style={{ background: "#FBEBCB", color: "#8A5A06" }}
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
                            <span style={{ color: "#CBB4EE" }}>·</span>
                          )}
                          <span className="text-xs" style={{ color: "#6A6180" }}>
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
                          style={{ background: "#E7DCF7", color: "#6B46B8", minWidth: 60 }}
                        >
                          {m.kcal_today}
                          <br />
                          <span className="font-normal text-[10px]" style={{ color: "#6A6180" }}>kcal</span>
                        </div>
                      )}
                    </>
                  );

                  // The Prime Member can open any member's 7-day consumption
                  return isOwner ? (
                    <Link key={m.user_id} href={`/family/member/${m.user_id}`} className={cardClass} style={cardStyle}>
                      {inner}
                      <span className="text-lg flex-shrink-0" style={{ color: "#6A6180" }}>›</span>
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
              <p className="text-xs text-center" style={{ color: "#6A6180" }}>
                Ask the Prime Member to invite more members.
              </p>
            )}

            {/* ── Quick link to Log ── */}
            <div className="pt-2">
              <Link
                href="/log"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold"
                style={{ background: "#241238", color: "#fff" }}
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
