"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CorrectionEvent, IntakeSummary, LabFlag, Needs, Profile } from "@/lib/insights/types";
import type { AyurvedaSummary } from "@/lib/insights/ayurveda";
import type { Plan } from "@/lib/insights/actions";
import CoachChat from "@/components/CoachChat";
import PageNeeds from "./PageNeeds";
import PageIntake from "./PageIntake";
import PageReport from "./PageReport";
import PageAyurveda from "./PageAyurveda";
import Beginning from "./Beginning";
import { C, T } from "./bits";

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
  key: "week" | "month";
  label: string;
  intake: IntakeSummary;
  ayurveda: AyurvedaSummary;
  flags: LabFlag[];
  events: CorrectionEvent[];
  plan: Plan;
};

type Tab = "needs" | "intake" | "report" | "ayurveda";

const TABS: { key: Tab; label: string }[] = [
  { key: "needs", label: "Needs" },
  { key: "intake", label: "Intake" },
  { key: "report", label: "Report" },
  { key: "ayurveda", label: "Ayurveda" },
];

/**
 * What to offer asking, on each page. Two voices: asking about
 * yourself, and a Prime Member asking about someone else.
 */
const ASK: Record<Tab, { mine: string[]; theirs: (n: string) => string[] }> = {
  needs: {
    mine: ["What should I change first?", "Why is my sugar still high?", "Plan a day of meals for me"],
    theirs: (n) => [`What should ${n} change first?`, `Why is ${n}'s sugar still high?`, `Plan a day of meals for ${n}`],
  },
  intake: {
    mine: ["Which dishes would close my protein gap?", "What am I short of most?", "Am I eating enough?"],
    theirs: (n) => [`Which dishes would close ${n}'s protein gap?`, `What is ${n} short of most?`, `Is ${n} eating enough?`],
  },
  report: {
    mine: ["Explain this report in simple words", "Which foods lower my LDL?", "What should I ask my doctor?"],
    theirs: (n) => [`Explain ${n}'s report in simple words`, `Which foods lower ${n}'s LDL?`, `What should we ask the doctor?`],
  },
  ayurveda: {
    mine: ["Which bitter dishes can I add?", "What suits my Prakriti?", "Is my food too sweet?"],
    theirs: (n) => [`Which bitter dishes can ${n} add?`, `What suits ${n}'s Prakriti?`, `Is ${n}'s food too sweet?`],
  },
};

const STORE = "insights-tab-v1";

export default function InsightsPages({
  periods, needs, profile, age, primaryDosha, hasReport, reportDate, dishesToComplete,
  viewingOther, memberId, firstName,
}: {
  periods: Period[];
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
  const [periodKey, setPeriodKey] = useState<Period["key"]>("week");
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

      {/* ── Period: a week, or four ── */}
      <div className="flex gap-2" role="tablist" aria-label="Period">
        {periods.map((x) => (
          <button
            key={x.key}
            role="tab"
            aria-selected={x.key === periodKey}
            onClick={() => setPeriodKey(x.key)}
            className="px-4 py-2 rounded-full font-semibold"
            style={{
              fontSize: T.note,
              background: x.key === periodKey ? "#241238" : "#E4E0EC",
              color: x.key === periodKey ? "#fff" : C.ink2,
            }}
          >
            {x.label}
          </button>
        ))}
      </div>

      {/* ── The four pages ── */}
      <div className="flex gap-1" role="tablist" aria-label="Insights pages">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={t.key === tab}
            onClick={() => pick(t.key)}
            className="flex-1 py-2.5 rounded-xl font-semibold"
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
          Nothing logged in {p.label.toLowerCase()}.
          {!viewingOther && <> <Link href="/log" className="font-bold underline">Log a meal</Link> and this fills in.</>}
        </div>
      )}

      {tab === "needs" && (
        <PageNeeds
          plan={p.plan} flags={p.flags} intake={p.intake} needs={needs}
          hasReport={hasReport} viewingOther={viewingOther} firstName={firstName}
          onOpenReport={() => pick("report")}
        />
      )}

      {tab === "intake" && (
        <PageIntake
          gaps={p.plan.gaps} intake={p.intake} needs={needs} profile={profile} age={age}
          vitDLow={vitDLow} dishesToComplete={dishesToComplete}
          viewingOther={viewingOther} firstName={firstName}
        />
      )}

      {tab === "report" && (
        <PageReport
          flags={p.flags} gaps={p.plan.gaps} hasReport={hasReport} reportDate={reportDate}
          doctorNotes={p.plan.doctor} viewingOther={viewingOther} firstName={firstName}
          onOpenIntake={() => pick("intake")}
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
            <p className="m-0 mt-1.5" style={{ fontSize: T.body, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
              {tab === "needs" && "About these changes, or anything else."}
              {tab === "intake" && "About what is short, and what would close it."}
              {tab === "report" && "About these readings, in plain words."}
              {tab === "ayurveda" && "About the tastes, or what suits this Prakriti."}
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
            <div className="mt-3 rounded-xl p-3" style={{ background: "#fff" }}>
              <CoachChat
                memberId={memberId}
                firstName={firstName}
                viewingOther={viewingOther}
                page={tab}
                suggest={viewingOther ? ASK[tab].theirs(firstName) : ASK[tab].mine}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
