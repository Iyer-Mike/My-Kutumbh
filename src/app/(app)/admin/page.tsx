import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageNav from "@/components/PageNav";
import { loadDesk, money, since, type Household } from "@/lib/admin";
import WriteToKutumbh from "@/components/WriteToKutumbh";
import WithdrawLetter from "@/components/WithdrawLetter";
import { MONTH_APP_RUPEES, MONTH_FAMILY_RUPEES } from "@/lib/ai-budget";
import { familyOf } from "@/lib/family";

export const dynamic = "force-dynamic";

const CARD = { background: "#FAF7FE", border: "1px solid #E0D4F2" };

/** Green while a family is alive, amber when it goes quiet, red when it never began. */
function pulse(h: Household) {
  const { days, label } = since(h.last_logged);
  if (days === null) return { colour: "#B0453A", word: "never logged" };
  if (days <= 2) return { colour: "#4A7C4A", word: label };
  if (days <= 10) return { colour: "#8A5A06", word: label };
  return { colour: "#B0453A", word: label };
}

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const desk = await loadDesk(supabase);
  // Not the Admin? Then this page does not exist. No sense saying otherwise.
  if (!desk.isAdmin) notFound();

  // Your own household is not somewhere you write letters to
  const { kutumbhId: myKutumbh } = await familyOf(supabase, user.id);
  const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const myName: string | null = me?.full_name ?? null;

  const people = desk.households.reduce((t, h) => t + h.members, 0);
  const quiet = desk.households.filter((h) => (since(h.last_logged).days ?? 999) > 10);
  const appPct = Math.min(100, Math.round((desk.appSpend / MONTH_APP_RUPEES) * 100));

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#F3EEFA" }}>
      <header
        className="px-5 pt-safe pb-5"
        style={{ background: "linear-gradient(160deg, #241238 0%, #3A2260 70%, #4E3080 100%)" }}
      >
        <PageNav />
        <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Admin Desk</p>
        <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>
          How the app is doing
        </h1>
        <p className="text-xs mt-1" style={{ color: "#C9B8E4" }}>
          {desk.households.length} household{desk.households.length !== 1 ? "s" : ""} · {people}{" "}
          {people === 1 ? "person" : "people"} · {money(desk.appSpend)} spent this month
        </p>
      </header>

      <main className="flex-1 px-5 py-6 space-y-5">

        {/* ── What the app has spent, against its own ceiling ── */}
        <section className="rounded-2xl px-4 py-4" style={CARD}>
          <p className="text-xs font-semibold uppercase tracking-widest m-0" style={{ color: "#6A6180" }}>
            The app&apos;s month
          </p>
          <p className="text-sm mt-2 mb-2" style={{ color: "#241C33" }}>
            <span className="font-semibold">{money(desk.appSpend)}</span>
            <span style={{ color: "#6A6180" }}> of {money(MONTH_APP_RUPEES)} — every family together</span>
          </p>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "#E7DCF7" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(appPct, desk.appSpend > 0 ? 2 : 0)}%`,
                background: appPct >= 100 ? "#B0453A" : appPct >= 80 ? "#8A5A06" : "#6B46B8",
              }}
            />
          </div>

          {desk.features.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {desk.features.map((f) => (
                <div key={f.feature} className="flex items-baseline justify-between text-xs">
                  <span style={{ color: "#241C33" }}>{f.feature.replace(/-/g, " ")}</span>
                  <span style={{ color: "#6A6180" }}>
                    {f.calls} {f.calls === 1 ? "call" : "calls"} · {money(f.spend_month)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Anyone who signed up and never got into a family ── */}
        {desk.stranded.length > 0 && (
          <section className="rounded-2xl px-4 py-4" style={{ background: "#FDF3F2", border: "1px solid #E8C4BF" }}>
            <p className="text-xs font-semibold uppercase tracking-widest m-0" style={{ color: "#B0453A" }}>
              Stuck at the door · {desk.stranded.length}
            </p>
            <p className="text-[11px] mt-1 mb-3" style={{ color: "#6A6180" }}>
              Signed up, but in no Kutumbh. Usually a confirmation email that never arrived.
            </p>
            {desk.stranded.map((s, n) => (
              <div key={n} className="flex items-baseline justify-between text-sm py-1">
                <span style={{ color: "#241C33" }}>{s.full_name}</span>
                <span className="text-xs" style={{ color: "#6A6180" }}>
                  {since(s.joined).label}
                  {!s.confirmed && " · never confirmed"}
                </span>
              </div>
            ))}
          </section>
        )}

        {/* ── The households ── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#6A6180" }}>
            Households
            {quiet.length > 0 && <span style={{ color: "#B0453A" }}> · {quiet.length} gone quiet</span>}
          </p>

          <div className="space-y-3">
            {desk.households.map((h) => {
              const p = pulse(h);
              const share = Math.min(100, Math.round((h.spend_month / MONTH_FAMILY_RUPEES) * 100));
              return (
                <div key={h.kutumbh_id} className="rounded-2xl px-4 py-3.5" style={CARD}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold m-0 truncate" style={{ color: "#241C33" }}>
                      {h.name ?? "Unnamed Kutumbh"}
                      {h.kutumbh_id === myKutumbh && (
                        <span
                          className="text-[10px] font-medium ml-2 px-1.5 py-0.5 rounded-full align-middle"
                          style={{ background: "#E7DCF7", color: "#6B46B8" }}
                        >
                          yours
                        </span>
                      )}
                    </p>
                    <span className="text-xs flex-shrink-0 font-medium" style={{ color: p.colour }}>
                      {p.word}
                    </span>
                  </div>

                  <p className="text-xs mt-1 mb-2" style={{ color: "#6A6180" }}>
                    {h.prime_name ?? "no Prime Member"} · {h.members} {h.members === 1 ? "member" : "members"} · joined{" "}
                    {since(h.created_at).label}
                  </p>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "#6A6180" }}>
                    <span>{h.logs_7d} logged this week</span>
                    <span>{h.logs_total} in all</span>
                    <span>
                      {money(h.spend_month)} of {money(MONTH_FAMILY_RUPEES)}
                      {share >= 80 ? " ⚠" : ""}
                    </span>
                  </div>

                  {h.kutumbh_id !== myKutumbh && (
                    <WriteToKutumbh
                      kutumbhId={h.kutumbh_id}
                      kutumbhName={h.name ?? "this Kutumbh"}
                      primeName={h.prime_name}
                      signature={myName}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── What has been said, both ways ── */}
        {desk.notices.length > 0 && (
          <section className="rounded-2xl px-4 py-4" style={CARD}>
            <p className="text-xs font-semibold uppercase tracking-widest m-0 mb-3" style={{ color: "#6A6180" }}>
              Letters
            </p>
            <div className="space-y-3">
              {desk.notices.map((n) => (
                <div key={n.id} className="text-xs">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold" style={{ color: n.from_admin ? "#6B46B8" : "#4A7C4A" }}>
                      {n.from_admin ? `You → ${n.kutumbh_name ?? "a Kutumbh"}` : `${n.kutumbh_name ?? "A Kutumbh"} → you`}
                    </span>
                    <span style={{ color: "#8A80A0" }}>
                      {since(n.created_at).label}{n.from_admin && (n.read_at ? " · read" : " · unread")}
                    </span>
                  </div>
                  <p className="m-0 mt-1" style={{ color: "#241C33" }}>{n.title}</p>
                  {n.body && <p className="m-0 mt-0.5 whitespace-pre-wrap" style={{ color: "#6A6180" }}>{n.body}</p>}
                  {n.from_admin && <div className="mt-1"><WithdrawLetter id={n.id} /></div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Invitations ── */}
        {desk.invites.length > 0 && (
          <section className="rounded-2xl px-4 py-4" style={CARD}>
            <p className="text-xs font-semibold uppercase tracking-widest m-0 mb-3" style={{ color: "#6A6180" }}>
              Invitations
            </p>
            {desk.invites.map((i, n) => (
              <div key={n} className="flex items-baseline justify-between text-xs py-1">
                <span style={{ color: "#241C33" }}>{i.kutumbh_name}</span>
                <span style={{ color: "#6A6180" }}>
                  {i.used} joined · {i.active ? "open" : "closed"}
                </span>
              </div>
            ))}
          </section>
        )}

        <p className="text-[11px] text-center pt-2 pb-4 m-0" style={{ color: "#8A80A0" }}>
          Counts and timings only. No family&apos;s food, labs, photographs or questions are visible here, to you or to
          anyone.
        </p>
      </main>
    </div>
  );
}
