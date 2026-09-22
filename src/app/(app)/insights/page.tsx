import { createClient } from "@/lib/supabase/server";
import PageNav from "@/components/PageNav";
import InsightsView, { type InsightsPeriod } from "@/components/InsightsView";
import { daysAgoLocal } from "@/lib/dates";
import { loadInsightsData } from "@/lib/insights/load";
import { computeNeeds } from "@/lib/insights/needs";
import { summarizeIntake } from "@/lib/insights/intake";
import { summarizeAyurveda } from "@/lib/insights/ayurveda";
import { evaluateLabs, latestLabValues } from "@/lib/insights/labs";
import { evaluateIntelligence } from "@/lib/insights/intelligence";

// Insights are individual. A member sees their own; the Prime Member can
// open any member of their Kutumbh with ?member=<user id>.
export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ member?: string }> }) {
  const { member } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const d = await loadInsightsData(supabase, user!.id, member);
  const needs = computeNeeds(d.profile, d.today);
  const labValues = latestLabValues(d.reports);

  const period = (key: InsightsPeriod["key"], label: string, from: string): InsightsPeriod => {
    const inRange = d.entries.filter((e) => e.logged_date >= from && e.logged_date <= d.today);
    const intake = summarizeIntake(d.entries, from, d.today);
    return {
      key, label, intake,
      ayurveda: summarizeAyurveda(inRange, d.profile.primary_dosha),
      flags: evaluateLabs(labValues, { intake, needs, foods: d.foods, allergies: d.profile.allergies ?? [] }),
      events: evaluateIntelligence({ profile: d.profile, needs, intake, entries: inRange, labs: labValues }),
    };
  };

  const periods = [
    period("today", "Today", d.today),
    period("week", "7 days", daysAgoLocal(6)),
    period("month", "30 days", d.from30),
  ];

  const reportDate = d.reports[0]?.report_date ?? null;
  const firstName = d.name.split(" ")[0];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#F6F5EE" }}>
      <header
        className="px-5 pt-safe pb-5"
        style={{ background: "linear-gradient(160deg, #1C2B1C 0%, #2E4A2C 70%, #3D6638 100%)" }}
      >
        <PageNav />
        <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
          {d.viewingOther ? "Prime Member view" : "Your nutrition & health"}
        </p>
        <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>
          {d.viewingOther ? `${d.name}'s Insights` : "Insights"}
        </h1>
        <p className="text-xs mt-1" style={{ color: "#8FBF88" }}>
          {reportDate
            ? `Using the lab report of ${new Date(`${reportDate}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })}`
            : "No lab report yet — upload one on Profile for health-based food guidance"}
        </p>
      </header>

      <main className="flex-1 px-4 py-5">
        <InsightsView
          periods={periods}
          needs={needs}
          primaryDosha={d.profile.primary_dosha}
          hasReport={!!reportDate}
          viewingOther={d.viewingOther}
          memberId={d.viewingOther ? d.targetId : null}
          firstName={firstName}
        />
      </main>
    </div>
  );
}
