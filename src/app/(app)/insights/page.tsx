import { createClient } from "@/lib/supabase/server";
import PageNav from "@/components/PageNav";
import InsightsPages, { type Period } from "@/components/insights/InsightsPages";
import { addDays, monthStart, weekOf } from "@/lib/weeks";
import { loadInsightsData } from "@/lib/insights/load";
import { computeNeeds, ageOn } from "@/lib/insights/needs";
import { summarizeIntake } from "@/lib/insights/intake";
import { summarizeAyurveda } from "@/lib/insights/ayurveda";
import { evaluateLabs, latestLabValues } from "@/lib/insights/labs";
import { evaluateIntelligence } from "@/lib/insights/intelligence";
import { planActions } from "@/lib/insights/actions";
import { familyOf } from "@/lib/family";

// Insights are individual. A member sees their own; the Key Member can
// open any member of their Kutumbh with ?member=<user id>.
export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ member?: string }> }) {
  const { member } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const d = await loadInsightsData(supabase, user!.id, member);
  const needs = computeNeeds(d.profile, d.today);
  const labValues = latestLabValues(d.reports);

  // The reader's own strip: today, the six days before it, the current
  // calendar week and the three before it, and the month. A day in
  // progress is marked partial — see InsightsPages.
  const long = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });
  const period = (
    key: string, group: Period["group"], label: string, sub: string, title: string, from: string, to: string, partial = false,
  ): Period => {
    const inRange = d.entries.filter((e) => e.logged_date >= from && e.logged_date <= to);
    const intake = summarizeIntake(d.entries, from, to);
    const flags = evaluateLabs(labValues, { intake, needs, foods: d.foods, allergies: d.profile.allergies ?? [] });
    const events = evaluateIntelligence({ profile: d.profile, needs, intake, entries: inRange, labs: labValues });

    return {
      key, group, label, sub, title, partial, intake, flags, events,
      ayurveda: summarizeAyurveda(inRange, d.profile.primary_dosha),
      plan: planActions({ events, labFlags: flags, intake, needs, entries: inRange }),
    };
  };

  const periods: Period[] = [period("d0", "day", "Today", long(d.today), "today, so far", d.today, d.today, true)];
  for (let i = 1; i <= 6; i++) {
    const day = addDays(d.today, -i);
    periods.push(period(`d${i}`, "day", `D-${i}`, long(day), long(day), day, day));
  }
  for (let i = 0; i <= 3; i++) {
    const wk = weekOf(addDays(d.today, -7 * i));
    const to = wk.end > d.today ? d.today : wk.end;
    periods.push(period(`w${i}`, "week", `Week ${wk.n}`, `${long(wk.start)}–${long(wk.end)}`, `Week ${wk.n} (${long(wk.start)}–${long(wk.end)})`, wk.start, to));
  }
  const monthName = new Date(`${d.today}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", month: "long" });
  periods.push(period("m", "month", "Month", monthName, monthName, monthStart(d.today), d.today));

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
          {d.viewingOther ? "Key Member view" : "Your nutrition & health"}
        </p>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>
            {d.viewingOther ? `${d.name}'s Insights` : "Insights"}
          </h1>
          <p className="text-[11px] text-right pt-2 shrink-0" style={{ color: "#C9B8E4" }}>
            {reportDate
              ? `Latest report ${new Date(`${reportDate}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })} ✓`
              : "No lab report · add one on Profile"}
          </p>
        </div>
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
