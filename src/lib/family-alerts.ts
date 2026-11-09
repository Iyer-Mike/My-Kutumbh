import type { SupabaseClient } from "@supabase/supabase-js";
import { todayLocal } from "@/lib/dates";
import { primeState } from "@/lib/prime";

/** One reason the Kutumbh tab shows a "!": what it is, and where to deal with it. */
/** `area` says where it is shown: on the Kutumbh page itself, or under a Pantry card (shelf / menu / shop). */
export type Attention = { key: string; text: string; href: string; cta: string; area: "family" | "shelf" | "menu" | "shop" };

/**
 * The single source for the Kutumbh "!": the tab lights up if and only if this list is
 * not empty, and the Kutumbh page prints the same list, so the flag and its reasons never disagree.
 * Every question is asked on its own: a failure just means "no news".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function familyAttention(supabase: SupabaseClient<any, any, any>, o: {
  userId: string; kutumbhId: string | null; isPrime: boolean; timeZone: string;
}): Promise<Attention[]> {
  const { userId, kutumbhId, isPrime, timeZone } = o;
  if (!kutumbhId) return [];
  const out: Attention[] = [];
  const ask = async (fn: () => Promise<void>) => { try { await fn(); } catch { /* no news */ } };

  await Promise.all([
    ask(async () => {
      // Only the five the page shows
      const { data } = await supabase.from("notices").select("read_at")
        .eq("kutumbh_id", kutumbhId).in("kind", ["admin", "allowance", "member", "dishes"])
        .order("created_at", { ascending: false }).limit(5);
      const n = (data ?? []).filter((x: { read_at: string | null }) => !x.read_at).length;
      if (n > 0) out.push({ key: "notices", text: `${n} unread notice${n > 1 ? "s" : ""}`, href: "#notices", cta: "Read", area: "family" });
    }),
    ask(async () => {
      const { data: owner } = await supabase.from("kutumbh_members").select("user_id").eq("kutumbh_id", kutumbhId).eq("role", "owner").limit(1).maybeSingle();
      const st = await primeState(supabase, userId, kutumbhId, owner?.user_id ?? null, isPrime);
      if (st.canClaim) out.push({ key: "claim", text: "The Key Member has been away a week. You may take over", href: "#key-member", cta: "See", area: "family" });
      if (st.canReclaim) out.push({ key: "reclaim", text: "Your Key Member role was taken while you were away", href: "#key-member", cta: "See", area: "family" });
    }),
    ask(async () => {
      if (!isPrime) return;
      const { data } = await supabase.from("pantry_stock_events").select("on_date")
        .eq("kutumbh_id", kutumbhId).eq("kind", "count").order("on_date", { ascending: false }).limit(1);
      const last = data?.[0]?.on_date as string | undefined;
      if (!last) return;
      const days = Math.round((new Date(`${todayLocal(timeZone)}T00:00:00Z`).getTime() - new Date(`${last}T00:00:00Z`).getTime()) / 86400000);
      if (days > 35) out.push({ key: "stock", text: `Monthly stock check is due (last ${days} days ago)`, href: "/pantry?step=check", cta: "Start", area: "shelf" });
    }),
    ask(async () => {
      if (!isPrime) return;
      const { data: row } = await supabase.from("user_seen").select("value").eq("user_id", userId).eq("key", "shop_seen").maybeSingle();
      const seen = typeof row?.value === "string" ? row.value : "";
      let q = supabase.from("shopping_items").select("id", { count: "exact", head: true }).eq("kutumbh_id", kutumbhId).eq("status", "open");
      if (seen && !Number.isNaN(Date.parse(seen))) q = q.gt("created_at", seen);
      const { count } = await q;
      if ((count ?? 0) > 0) out.push({ key: "shopping", text: `${count} new item${count === 1 ? "" : "s"} on the shopping list`, href: "/pantry?step=shop", cta: "Open", area: "shop" });
    }),
  ]);
  const order = ["notices", "claim", "reclaim", "shopping", "stock"];
  return out.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}
