"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CorrectionEvent, IntakeSummary, LabFlag, Needs, Profile } from "@/lib/insights/types";
import type { AyurvedaSummary } from "@/lib/insights/ayurveda";
import type { Plan } from "@/lib/insights/actions";
import CoachChat from "@/components/CoachChat";
import PageNeedsVsActual from "./PageNeedsVsActual";
import PageReport from "./PageReport";
import PageAyurveda from "./PageAyurveda";
import Beginning from "./Beginning";
import { C, T } from "./bits";
import { FAMILY, fieldLook } from "@/lib/brand";

/**
 * Insights, in four pages.
 *
 * Needs · Intake · Report · Ayurveda — what the body asks for, what it
 * got, what the lab found, what Ayurveda makes of it. Each page owns
 * one question, so nothing is said twice.
 *
 * Two periods only. A single day was removed deliberately: at
 * breakfast a member has eaten 300 of 2,250 kcal, and a page reporting
 * them 1,950 short is not merely useless but misleading. Today's
 * eating belongs on Home, where it is logged.
 */

export type Period = {
  key: string;                       // w0, w1… (the month's weeks), m
  group: "week" | "month";
  label: string;                     // "Week 41", "Month"
  sub: string;                       // its dates
  title: string;                     // how a sentence names it
  future: boolean;                   // a week still to come: shown, not opened
  intake: IntakeSummary;
  ayurveda: AyurvedaSummary;
  flags: LabFlag[];
  events: CorrectionEvent[];
  plan: Plan;
};

type Tab = "needs" | "report" | "ayurveda";

const TABS: { key: Tab; label: string }[] = [
  { key: "needs", label: "Needs vs Actual" },
  { key: "report", label: "Reports vs Analysis" },
  { key: "ayurveda", label: "Ayurveda" },
];

/**
 * What to offer asking — built from this member's own figures, so the
 * questions name the thing on the screen rather than a category. "Why
 * 3 katoris of dal?" is a question somebody might actually type; "What
 * should I eat more of?" is a form to fill in.
 */
function questionsFor(tab: Tab, p: Period, name: string | null): string[] {
  const me = name ?? "I";
  const mine = !name;
  const top = p.plan.actions[0];
  const gap = p.plan.gaps[0];
  const flag = p.flags.find((f) => f.known);
  const reading = flag?.readings[0];

  switch (tab) {
    case "needs":
      return [
        top ? (mine ? `Why ${top.headline.replace(/[.?!]$/, "")}?` : `Why should ${me} — ${top.headline.replace(/[.?!]$/, "")}?`) : "What should change first?",
        mine ? "What can I eat instead?" : `What can ${me} eat instead?`,
        gap
          ? (mine ? `Which of our dishes would close the ${gap.label.toLowerCase()} gap?` : `Which dishes would close ${me}'s ${gap.label.toLowerCase()} gap?`)
          : (mine ? "Plan a day of meals for me" : `Plan a day of meals for ${me}`),
      ];
    case "report":
      return [
        reading ? `What does ${reading.label} ${reading.value} mean for my food?` : "Explain this report in simple words",
        flag ? `Which foods bring ${flag.label.toLowerCase()} down?` : "Which foods help most?",
        "What should I ask my doctor?",
      ];
    case "ayurveda":
      return [
        "Which bitter dishes can we add?",
        mine ? "What suits my Prakriti?" : `What suits ${me}'s Prakriti?`,
        mine ? "Is my food too sweet?" : `Is ${me}'s food too sweet?`,
      ];
  }
}

/** What the page is showing at this moment, in a line or two. */
function onScreenFor(tab: Tab, p: Period): string {
  switch (tab) {
    case "needs":
      return [
        `Energy ${Math.round(p.intake.perDay.kcal)} kcal a day on ${p.intake.loggedDays} logged days.`,
        p.plan.actions.length ? `The changes shown: ${p.plan.actions.map((a) => a.headline).join(" | ")}` : "No changes are being suggested.",
        p.plan.doctor.length ? `Marked for a doctor: ${p.plan.doctor.join(" ")}` : "",
        p.plan.gaps.length
          ? `Short of target: ${p.plan.gaps.map((g) => `${g.label} ${g.had} of ${g.target} ${g.unit}`).join("; ")}.`
          : "Everything is within range for this period.",
      ].filter(Boolean).join("\n");
    case "report":
      return p.flags.filter((f) => f.known).map((f) =>
        `${f.label}: ${f.readings.map((r) => `${r.label} ${r.value}${r.unit ? " " + r.unit : ""}`).join(", ")}`,
      ).join("\n") || "No readings outside range.";
    case "ayurveda":
      return `Tastes this period: ${Object.entries(p.ayurveda.tasteShare).map(([t, v]) => `${t} ${Math.round((v as number) * 100)}%`).join(", ")}.`;
  }
}

const STORE = "insights-tab-v1";

export default function InsightsPages({
  periods, defaultKey, needs, profile, age, primaryDosha, hasReport, reportDate, dishesToComplete,
  viewingOther, memberId, firstName,
}: {
  periods: Period[];
  defaultKey: string;
  needs: Needs;
  profile: Profile;
  age: number | null;
  primaryDosha: string | null;
  hasReport: boolean;
  reportDate: string | null;
  dishesToComplete: number;
  viewingOther: boolean;
  memberId: string | null;
  firstName: string;
}) {
  const [tab, setTab] = useState<Tab>("needs");
  const [periodKey, setPeriodKey] = useState<string>(defaultKey);
  const [asking, setAsking] = useState(false);

  // Remember the page this reader keeps returning to — a convenience only
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && TABS.some((t) => t.key === saved)) setTab(saved as Tab);
    } catch { /* storage unavailable */ }
  }, []);

  function pick(next: Tab) {
    setTab(next);
    setAsking(false);
    try { localStorage.setItem(STORE, next); } catch { /* ignore */ }
  }

  const p = periods.find((x) => x.key === periodKey) ?? periods[0];

  // Too little to say anything honest with. Four empty tabs is a poor
  // way to meet a family; one card that says what is coming is better.
  const barelyAnything = periods.every((x) => x.intake.loggedDays < 3) && !hasReport;
  const nothingLogged = p.intake.items === 0;

  const vitDLow = p.flags.some((f) => f.key === "vitamin_d");

  if (barelyAnything) {
    return (
      <Beginning
        loggedDays={Math.max(...periods.map((x) => x.intake.loggedDays))}
        hasReport={hasReport}
        viewingOther={viewingOther}
        firstName={firstName}
      />
    );
  }

  return (
    <div className="grid gap-3">

      {/* ── When: last month, this month's weeks, this month. Changing it changes every page below. ── */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Month or week">
        {periods.map((x) => {
          const on = x.key === periodKey;
          return (
            <button
              key={x.key}
              role="tab"
              aria-selected={on}
              disabled={x.future}
              onClick={() => setPeriodKey(x.key)}
              className="flex-1 px-2 py-1.5 rounded-xl text-center leading-tight disabled:opacity-40"
              style={{
                minWidth: "3.6rem",
                background: on ? "#241238" : "#fff",
                color: on ? "#fff" : C.ink2,
                border: `2px solid ${on ? "#241238" : "#B9A8D6"}`,
              }}
            >
              <span className="block font-bold" style={{ fontSize: T.note }}>{x.label}</span>
              <span className="block" style={{ fontSize: 10, opacity: 0.85 }}>{x.sub}</span>
            </button>
          );
        })}
      </div>

      {/* ── The three pages ── */}
      <div className="grid grid-cols-3 gap-1" role="tablist" aria-label="Insights pages">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={t.key === tab}
            onClick={() => pick(t.key)}
            className="px-1 py-2.5 rounded-xl font-semibold leading-tight"
            style={{
              fontSize: T.note,
              background: t.key === tab ? "#241238" : "#E4E0EC",
              color: t.key === tab ? "#fff" : C.ink2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {nothingLogged && tab !== "report" && (
        <div className="rounded-2xl px-4 py-4" style={{ background: "#FBEBCF", color: "#6A3D06", border: "1px solid #F2B531", fontSize: T.body }}>
          Nothing logged in {p.title}.
          {!viewingOther && <> <Link href="/log" className="font-bold underline">Log a meal</Link> and this fills in.</>}
        </div>
      )}

      {tab === "needs" && (
        <PageNeedsVsActual
          plan={p.plan} flags={p.flags} gaps={p.plan.gaps} intake={p.intake} needs={needs}
          profile={profile} age={age} vitDLow={vitDLow}
          hasReport={hasReport} viewingOther={viewingOther} firstName={firstName}
          onOpenReport={() => pick("report")} dishesToComplete={dishesToComplete}
        />
      )}

      {tab === "report" && (
        <PageReport
          flags={p.flags} gaps={p.plan.gaps} hasReport={hasReport} reportDate={reportDate}
          doctorNotes={p.plan.doctor} viewingOther={viewingOther} firstName={firstName}
          onOpenIntake={() => pick("needs")}
        />
      )}

      {tab === "ayurveda" && (
        <PageAyurveda
          ayurveda={p.ayurveda} primaryDosha={primaryDosha}
          viewingOther={viewingOther} firstName={firstName}
        />
      )}

      {/* ── The coach, on every page, knowing which page it is ── */}
      <div className="rounded-2xl px-4 py-4" style={{ background: "#2D1B4E" }}>
        {!asking ? (
          <button onClick={() => setAsking(true)} className="w-full text-left">
            <p className="m-0 font-semibold uppercase tracking-widest" style={{ fontSize: T.label, color: "#C9B8E4" }}>
              Ask the coach
            </p>
            {/* Named, and about what is actually on this page — not a
                general invitation to ask something. */}
            <p className="m-0 mt-1.5" style={{ fontSize: T.body, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
              {viewingOther ? (
                <>About {firstName}&apos;s {tab === "needs" ? "changes and shortfalls" : tab === "report" ? "readings" : "tastes"}, or anything else.</>
              ) : (
                <>
                  {firstName}, ask me about{" "}
                  {tab === "needs" && (p.plan.actions[0]
                    ? <>the {p.plan.actions[0].id.replace(/^(more|less)-/, "")} — or anything else.</>
                    : "these changes, or anything else.")}
                  {tab === "report" && (p.flags.find((f) => f.known)
                    ? <>{p.flags.find((f) => f.known)!.label.toLowerCase()}, in plain words.</>
                    : "these readings, in plain words.")}
                  {tab === "ayurveda" && "the tastes, or what suits your Prakriti."}
                </>
              )}
            </p>
            <span
              className="inline-block mt-3 rounded-full px-4 py-2 font-semibold"
              style={{ fontSize: T.note, background: "rgba(255,255,255,0.14)", color: "#fff" }}
            >
              Ask a question
            </span>
          </button>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <p className="m-0 font-semibold uppercase tracking-widest" style={{ fontSize: T.label, color: "#C9B8E4" }}>
                Ask the coach
              </p>
              <button onClick={() => setAsking(false)} className="font-medium" style={{ fontSize: T.note, color: "#C9B8E4" }}>
                Close
              </button>
            </div>
            <div className="mt-3 rounded-xl p-3" style={fieldLook(FAMILY.gold)}>
              <CoachChat
                memberId={memberId}
                firstName={firstName}
                viewingOther={viewingOther}
                page={tab}
                suggest={questionsFor(tab, p, viewingOther ? firstName : null)}
                onScreen={onScreenFor(tab, p)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
