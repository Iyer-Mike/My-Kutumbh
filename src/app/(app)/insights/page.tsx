import { createClient } from "@/lib/supabase/server";
import PageNav from "@/components/PageNav";
import InsightsPages, { type Period } from "@/components/insights/InsightsPages";
import { daysAgoLocal } from "@/lib/dates";
import { loadInsightsData } from "@/lib/insights/load";
import { computeNeeds, ageOn } from "@/lib/insights/needs";
import { summarizeIntake } from "@/lib/insights/intake";
import { summarizeAyurveda } from "@/lib/insights/ayurveda";
import { evaluateLabs, latestLabValues } from "@/lib/insights/labs";
import { evaluateIntelligence } from "@/lib/insights/intelligence";
import { planActions } from "@/lib/insights/actions";
import { familyOf } from "@/lib/family";

// Insights are individual. A member sees their own; the Prime Member can
// open any member of their Kutumbh with ?member=<user id>.
export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ member?: string }> }) {
  const { member } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const d = await loadInsightsData(supabase, user!.id, member);
  const needs = computeNeeds(d.profile, d.today);
  const labValues = latestLabValues(d.reports);

  // A week, or four. One day was removed deliberately — see InsightsPages.
  const period = (key: Period["key"], label: string, from: string): Period => {
    const inRange = d.entries.filter((e) => e.logged_date >= from && e.logged_date <= d.today);
    const intake = summarizeIntake(d.entries, from, d.today);
    const flags = evaluateLabs(labValues, { intake, needs, foods: d.foods, allergies: d.profile.allergies ?? [] });
    const events = evaluateIntelligence({ profile: d.profile, needs, intake, entries: inRange, labs: labValues });

    return {
      key, label, intake, flags, events,
      ayurveda: summarizeAyurveda(inRange, d.profile.primary_dosha),
      plan: planActions({ events, labFlags: flags, intake, needs, entries: inRange }),
    };
  };

  const periods: Period[] = [
    period("week", "1 week", daysAgoLocal(6, d.timeZone)),
    period("month", "4 weeks", daysAgoLocal(27, d.timeZone)),
  ];

  // Dishes still waiting for their details, which is why some of the
  // energy is an estimate rather than a reading. Same count the family
  // page shows, from the same column.
  const { kutumbhId } = await familyOf(supabase, user!.id);
  const { count: dishesToComplete } = kutumbhId
    ? await supabase
        .from("food_items")
        .select("id", { count: "exact", head: true })
        .eq("kutumbh_id", kutumbhId)
        .eq("needs_review", true)
    : { count: 0 };

  const reportDate = d.reports[0]?.report_date ?? null;
  const firstName = d.name.split(" ")[0];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#F3EEFA" }}>
      <header
        className="px-5 pt-safe pb-5"
        style={{ background: "linear-gradient(160deg, #241238 0%, #3A2260 70%, #4E3080 100%)" }}
      >
        <PageNav />
        <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
          {d.viewingOther ? "Prime Member view" : "Your nutrition & health"}
        </p>
        <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>
          {d.viewingOther ? `${d.name}'s Insights` : "Insights"}
        </h1>
        <p className="text-xs mt-1" style={{ color: "#C9B8E4" }}>
          {reportDate
            ? `Lab report · ${new Date(`${reportDate}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })}`
            : "No lab report · add one on Profile"}
        </p>
      </header>

      <main className="flex-1 px-4 py-5">
        <InsightsPages
          periods={periods}
          needs={needs}
          profile={d.profile}
          age={ageOn(d.profile.date_of_birth, d.today)}
          primaryDosha={d.profile.primary_dosha}
          hasReport={!!reportDate}
          reportDate={reportDate}
          dishesToComplete={dishesToComplete ?? 0}
          viewingOther={d.viewingOther}
          memberId={d.viewingOther ? d.targetId : null}
          firstName={firstName}
        />
      </main>
    </div>
  );
}
