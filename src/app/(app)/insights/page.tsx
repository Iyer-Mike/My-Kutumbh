import { createClient } from "@/lib/supabase/server";
import PageNav from "@/components/PageNav";
import InsightsPages, { type Period } from "@/components/insights/InsightsPages";
import { addDays, dayOfWeek, monthStart, weekOf } from "@/lib/weeks";
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

  // The weeks of this calendar month, Sunday to Saturday, laid out for the
  // whole month so the strip stays put until the month changes; then the
  // month itself. A week belongs to the month its Sunday falls in. Weeks
  // still to come are shown but cannot be opened.
  const long = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });
  const period = (
    key: string, group: Period["group"], label: string, sub: string, title: string, from: string, to: string, future = false,
  ): Period => {
    const inRange = d.entries.filter((e) => e.logged_date >= from && e.logged_date <= to);
    const intake = summarizeIntake(d.entries, from, to);
    const flags = evaluateLabs(labValues, { intake, needs, foods: d.foods, allergies: d.profile.allergies ?? [] });
    const events = evaluateIntelligence({ profile: d.profile, needs, intake, entries: inRange, labs: labValues });

    return {
      key, group, label, sub, title, future, intake, flags, events,
      ayurveda: summarizeAyurveda(inRange, d.profile.primary_dosha),
      plan: planActions({ events, labFlags: flags, intake, needs, entries: inRange }),
    };
  };

  const first = monthStart(d.today);
  const month = d.today.slice(0, 7);
  const periods: Period[] = [];
  const firstSunday = addDays(first, (7 - dayOfWeek(first)) % 7);
  for (let s = firstSunday, i = 0; s.slice(0, 7) === month; s = addDays(s, 7), i++) {
    const wk = weekOf(s);
    const future = s > d.today;
    periods.push(period(
      `w${i}`, "week", `Week ${wk.n}`, `${long(wk.start)}–${long(wk.end)}`,
      `Week ${wk.n} (${long(wk.start)}–${long(wk.end)})`,
      future ? d.today : wk.start, future ? d.today : (wk.end > d.today ? d.today : wk.end), future,
    ));
  }
  const monthName = new Date(`${d.today}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", month: "long" });
  periods.push(period("m", "month", "Month", monthName, monthName, first, d.today));

  // Open on the week we are in; in the days before the month's first Sunday, on the month
  const thisWeek = weekOf(d.today).start;
  const defaultKey = periods.find((x) => x.group === "week" && x.sub.startsWith(long(thisWeek)))?.key ?? "m";

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
          defaultKey={defaultKey}
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
