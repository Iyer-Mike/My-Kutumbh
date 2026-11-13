import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageNav from "@/components/PageNav";
import DeleteBill from "@/components/DeleteBill";
import { BRAND as B, FAMILY, look } from "@/lib/brand";
import { familyOf } from "@/lib/family";
import { todayLocal, longDateFor } from "@/lib/dates";
import { CATEGORIES } from "@/lib/pantry";
import { SPEND_LABEL, addMonths, billAmount, daysInMonth, monthOf, monthReport, type SpendBill, type SpendLine } from "@/lib/spend";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const LABEL = new Map<string, string>([...CATEGORIES.map((c) => [c.key, c.label] as const), ...Object.entries(SPEND_LABEL)]);
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function SpendPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { kutumbhId, isPrime, timeZone, kutumbhName } = await familyOf(supabase, user!.id);
  // Spending is the Key Member's to see
  if (!kutumbhId || !isPrime) redirect("/pantry");

  const today = todayLocal(timeZone);
  const thisMonth = monthOf(today);
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : thisMonth;
  const from = addMonths(month, -1);   // last month too, for the comparison

  const [{ data: billRows }, { count: people }] = await Promise.all([
    supabase.from("bills").select("id, bill_date, shop, total").eq("kutumbh_id", kutumbhId)
      .gte("bill_date", `${from}-01`).lt("bill_date", `${addMonths(month, 1)}-01`).order("bill_date", { ascending: false }),
    supabase.from("kutumbh_members").select("user_id", { count: "exact", head: true }).eq("kutumbh_id", kutumbhId),
  ]);
  const bills = (billRows ?? []).map((b) => ({ ...b, total: b.total != null ? Number(b.total) : null })) as SpendBill[];
  const ids = bills.map((b) => b.id);
  const { data: lineRows } = ids.length
    ? await supabase.from("bill_lines").select("bill_id, name, quantity, unit, category, price, is_food").in("bill_id", ids)
    : { data: [] as never[] };
  const lines = ((lineRows ?? []) as (SpendLine & { quantity: number | null; unit: string | null })[])
    .map((l) => ({ ...l, price: l.price != null ? Number(l.price) : null }));

  const now = monthReport(bills, lines, month);
  const before = monthReport(bills, lines, from);
  const change = before.total > 0 ? Math.round(((now.total - before.total) / before.total) * 100) : null;
  const days = month === thisMonth ? Number(today.slice(8, 10)) : daysInMonth(month);
  const perPersonDay = people && days ? now.total / people / days : null;
  const maxCat = Math.max(1, ...now.byCategory.map((c) => c.amount));
  const mine = bills.filter((b) => monthOf(b.bill_date) === month);

  const nav = "px-3 py-1.5 rounded-xl text-xs font-semibold";
  return (
    <div className="flex flex-col min-h-screen" style={{ background: B.page }}>
      <header className="px-5 pt-safe pb-5" style={{ background: B.headerGradient }}>
        <PageNav />
        <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>{kutumbhName ?? "Your Kutumbh"}</p>
        <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>Spending</h1>
        <p className="text-xs mt-1" style={{ color: B.gold }}>From the bills you checked and approved · only you can see this</p>
      </header>

      <main className="flex-1 px-4 py-5 grid gap-4 content-start">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/pantry/spend?m=${addMonths(month, -1)}`} className={nav} style={{ background: "#EDE7F7", color: "#4B2E8A" }}>← {monthName(addMonths(month, -1))}</Link>
          <p className="m-0 text-sm font-bold" style={{ color: B.ink }}>{monthName(month)}</p>
          {month < thisMonth
            ? <Link href={`/pantry/spend?m=${addMonths(month, 1)}`} className={nav} style={{ background: "#EDE7F7", color: "#4B2E8A" }}>{monthName(addMonths(month, 1))} →</Link>
            : <span className={nav} aria-hidden style={{ visibility: "hidden" }}>→</span>}
        </div>

        {now.bills === 0 ? (
          <section className="rounded-2xl px-4 py-4" style={look(FAMILY.violet)}>
            <p className="m-0 text-sm" style={{ color: B.ink }}>No bills recorded for {monthName(month)}.</p>
            <p className="m-0 mt-1 text-xs" style={{ color: B.muted2 }}>
              Photograph a shop bill on the <Link href="/pantry" className="underline font-semibold">Pantry</Link> page, check it, and it appears here.
            </p>
          </section>
        ) : (
          <>
            <section className="rounded-2xl px-4 py-4 grid gap-1" style={look(FAMILY.green)}>
              <p className="m-0 text-xs font-bold uppercase tracking-wide" style={{ color: FAMILY.green.ink }}>Spent in {monthName(month)}</p>
              <p className="m-0 text-3xl font-bold" style={{ color: FAMILY.green.ink }}>{inr(now.total)}</p>
              <p className="m-0 text-xs" style={{ color: FAMILY.green.ink }}>
                From {now.bills} bill{now.bills === 1 ? "" : "s"}. Only bills photographed here are counted.
                {change != null && <> {change === 0 ? "Same as" : `${Math.abs(change)}% ${change > 0 ? "more" : "less"} than`} {monthName(from)} ({inr(before.total)}).</>}
              </p>
              {perPersonDay != null && (
                <p className="m-0 text-xs" style={{ color: FAMILY.green.ink }}>
                  About {inr(perPersonDay)} per person per day ({people} {people === 1 ? "person" : "people"}, {days} days).
                </p>
              )}
            </section>

            <section className="rounded-2xl px-4 py-3 grid gap-2" style={look(FAMILY.blue)}>
              <p className="m-0 text-xs font-bold uppercase tracking-wide" style={{ color: FAMILY.blue.ink }}>Where it went</p>
              {now.byCategory.map((c) => (
                <div key={c.category} className="grid gap-0.5">
                  <p className="m-0 text-sm flex justify-between" style={{ color: B.ink }}><span>{LABEL.get(c.category) ?? c.category}</span><span className="tabular-nums">{inr(c.amount)}</span></p>
                  <div className="h-2 rounded-full" style={{ background: "#fff", border: `1px solid ${FAMILY.blue.line}` }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(3, (c.amount / maxCat) * 100)}%`, background: FAMILY.blue.edge }} />
                  </div>
                </div>
              ))}
              {now.unpriced > 0 && <p className="m-0 text-xs" style={{ color: B.muted2 }}>{now.unpriced} line{now.unpriced === 1 ? "" : "s"} had no price, so they are not in this split.</p>}
            </section>

            {now.byShop.length > 0 && (
              <section className="rounded-2xl px-4 py-3 grid gap-1" style={look(FAMILY.violet)}>
                <p className="m-0 text-xs font-bold uppercase tracking-wide" style={{ color: FAMILY.violet.ink }}>By shop</p>
                {now.byShop.map((s) => (
                  <p key={s.shop} className="m-0 text-sm flex justify-between" style={{ color: B.ink }}><span>{s.shop}</span><span className="tabular-nums">{inr(s.amount)}</span></p>
                ))}
              </section>
            )}

            <section className="grid gap-2">
              <p className="m-0 text-xs font-bold uppercase tracking-wide" style={{ color: B.violet }}>The bills</p>
              {mine.map((b) => {
                const ls = lines.filter((l) => l.bill_id === b.id);
                return (
                  <details key={b.id} className="rounded-xl px-3 py-2" style={{ background: "#fff", border: `1.5px solid ${FAMILY.violet.edge}` }}>
                    <summary className="cursor-pointer text-sm flex justify-between gap-2" style={{ color: B.ink }}>
                      <span>{longDateFor(b.bill_date)} · {b.shop ?? "Shop not named"}</span>
                      <span className="tabular-nums font-semibold">{inr(billAmount(b, lines))}</span>
                    </summary>
                    <ul className="m-0 mt-2 p-0 list-none grid gap-0.5">
                      {ls.map((l, i) => (
                        <li key={i} className="text-xs flex justify-between gap-2" style={{ color: B.muted }}>
                          <span>{l.name}{!l.is_food ? ` (${(LABEL.get(l.category) ?? "spending only").toLowerCase()})` : ""}</span><span className="tabular-nums">{l.price != null ? inr(l.price) : "no price"}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2"><DeleteBill id={b.id} label={`the ${longDateFor(b.bill_date)} bill`} /></div>
                  </details>
                );
              })}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
