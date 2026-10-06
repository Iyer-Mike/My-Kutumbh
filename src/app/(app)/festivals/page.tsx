import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { familyOf } from "@/lib/family";
import { daysFromToday, longDateFor, todayLocal } from "@/lib/dates";
import { BUILT_IN_FESTIVALS } from "@/lib/festivals";
import PageNav from "@/components/PageNav";
import FestivalAdder from "@/components/FestivalAdder";
import FestivalRemove from "@/components/FestivalRemove";
import { BRAND as B } from "@/lib/brand";

type Row = { key: string; name: string; date: string; own: boolean; id?: string };

export default async function FestivalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { kutumbhId, isPrime, timeZone } = await familyOf(supabase, user.id);
  const today = todayLocal(timeZone);

  // The family's own list; where the table is not made yet, only the built-in one shows
  const { data: own } = kutumbhId
    ? await supabase.from("family_festivals").select("id, name, festival_date").gte("festival_date", today).order("festival_date")
    : { data: [] as { id: string; name: string; festival_date: string }[] | null };

  const rows: Row[] = [
    ...BUILT_IN_FESTIVALS.filter((f) => f.date >= today).map((f) => ({ key: `b-${f.date}-${f.name}`, name: f.name, date: f.date, own: false })),
    ...(own ?? []).map((f) => ({ key: f.id, name: f.name, date: f.festival_date, own: true, id: f.id })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="flex flex-col min-h-screen" style={{ background: B.page }}>
      <header className="px-5 pt-safe pb-5" style={{ background: B.headerGradient }}>
        <PageNav />
        <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>Festival days</h1>
        <p className="text-xs mt-1" style={{ color: B.gold }}>Tap a day for its menu</p>
      </header>
      <main className="flex-1 px-4 py-5 pb-24 grid gap-3 content-start">
        {rows.length === 0 && <p className="text-sm" style={{ color: B.muted }}>No festivals ahead.</p>}
        {rows.map((r) => {
          const off = daysFromToday(r.date, timeZone);
          const href = off === 0 ? "/dashboard" : `/dashboard?date=${r.date}&fest=1`;
          return (
            <div key={r.key} className="rounded-2xl flex items-center justify-between gap-2 pl-4 pr-1"
              style={r.own
                ? { background: "#E6F6EA", border: "2.5px solid #2E8B57", minHeight: 64 }
                : { background: "#E8F2FD", border: "2.5px solid #2E64A0", minHeight: 64 }}>
              <Link href={href} className="flex-1 min-w-0 py-3">
                <span className="block text-sm font-bold" style={{ color: "#241238" }}>🪔 {r.name}</span>
                <span className="block text-xs" style={{ color: "#4A3F5E" }}>
                  {longDateFor(r.date)} · {off === 0 ? "today" : off === 1 ? "tomorrow" : `in ${off} days`}{r.own ? " · your family's" : ""}
                </span>
              </Link>
              {r.own && isPrime && r.id ? <FestivalRemove id={r.id} name={r.name} /> : <span className="text-lg pr-3" style={{ color: "#6B46B8" }} aria-hidden>›</span>}
            </div>
          );
        })}
        <p className="text-xs" style={{ color: B.muted2, lineHeight: 1.5 }}>
          Lunar dates vary by region · {isPrime ? "Check your family's calendar, then add or correct below." : "The Key Member can add your family's own."}
        </p>
        {isPrime && kutumbhId && <FestivalAdder kutumbhId={kutumbhId} userId={user.id} />}
      </main>
    </div>
  );
}
