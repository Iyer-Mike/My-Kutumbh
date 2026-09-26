import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * What the thinking costs, and when to stop.
 *
 * The family has a month's allowance; each person has a day's. Either
 * one reached, the AI features wait — and everything the app works out
 * by rule carries on as before. Money is kept in rupees, to four places: a
 * reading of a bill costs about ₹1.30, and rounding every call to a whole
 * rupee would drift badly over a few hundred of them.
 */

// ── The ceiling, as the family set it ──
export const MONTH_FAMILY_RUPEES = 500; // a month, the whole Kutumbh
export const DAY_PERSON_RUPEES   =  50; // a day, one person

/**
 * The ceiling above the ceilings. One card pays for every Kutumbh, so
 * the app as a whole has a limit of its own — otherwise ten families
 * with ₹500 each would be ₹5,000 on that card.
 */
export const MONTH_APP_RUPEES = Number(process.env.AI_MONTH_APP_RUPEES ?? 2_000);

/**
 * Dollars to rupees. Approximate on purpose, and deliberately on the
 * high side: over-stating the cost only makes the app stop sooner,
 * which is the safe direction for a ceiling.
 */
const USD_TO_INR = Number(process.env.USD_TO_INR ?? 90);

/** Dollars per million tokens, from Anthropic's published prices. */
const PRICES: Record<string, { in: number; out: number }> = {
  "claude-opus-5":              { in: 5, out: 25 },
  "claude-haiku-4-5-20251001":  { in: 1, out: 5 },
  "claude-haiku-4-5":           { in: 1, out: 5 },
};

export type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

/**
 * What one answer cost, in rupees. Cache reads are a tenth of the input
 * price and cache writes a quarter more; an unknown model is priced as
 * the dearest we use, so a new model can never slip past the ceiling.
 */
export function rupeesFor(model: string, usage: Usage): number {
  const p = PRICES[model] ?? { in: 5, out: 25 };
  const inTok    = usage.input_tokens ?? 0;
  const outTok   = usage.output_tokens ?? 0;
  const cacheIn  = usage.cache_read_input_tokens ?? 0;
  const cacheNew = usage.cache_creation_input_tokens ?? 0;

  const usd =
    (inTok    * p.in        +
     cacheIn  * p.in * 0.1  +
     cacheNew * p.in * 1.25 +
     outTok   * p.out) / 1_000_000;

  // Four places kept, rounded up, so that many small calls still add up
  return Math.ceil(usd * USD_TO_INR * 10_000) / 10_000;
}

export type BudgetVerdict =
  | { ok: true; familyRupees: number; myRupees: number }
  | { ok: false; message: string; status: number };

/**
 * Asked before every AI call. A refusal is a plain sentence a family can
 * act on, not a status code.
 */
export async function checkBudget(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  kutumbhId: string | null,
): Promise<BudgetVerdict> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const dayStart   = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [familyRes, mineRes, appRes] = await Promise.all([
    kutumbhId
      ? supabase.from("ai_spend").select("cost_rupees").eq("kutumbh_id", kutumbhId).gte("created_at", monthStart)
      : supabase.from("ai_spend").select("cost_rupees").eq("user_id", userId).gte("created_at", monthStart),
    supabase.from("ai_spend").select("cost_rupees").eq("user_id", userId).gte("created_at", dayStart),
    // Nobody may read another family's spending, so the app's own total
    // comes back from a function that sees all and returns one number.
    supabase.rpc("ai_spend_month_total"),
  ]);

  // A ledger we cannot read must not lock the family out of the app.
  const sum = (rows: { cost_rupees: number }[] | null) =>
    (rows ?? []).reduce((t, r) => t + Number(r.cost_rupees ?? 0), 0);
  const familyRupees = sum(familyRes.data);
  const myRupees     = sum(mineRes.data);

  const appRupees = Number(appRes.data ?? 0);

  if (appRupees >= MONTH_APP_RUPEES) {
    return {
      ok: false,
      status: 429,
      message:
        "My Kutumbh has reached its own AI limit for this month, across all the families using it. " +
        "Everything the app works out by itself carries on as usual. If this is your app, raising the " +
        "limit is a one-line change on the server.",
    };
  }

  if (familyRupees >= MONTH_FAMILY_RUPEES) {
    return {
      ok: false,
      status: 429,
      message:
        `Your Kutumbh has used its ₹${MONTH_FAMILY_RUPEES} of AI for this month. ` +
        `Menus, logging, the shopping list and recipes all carry on as usual — ` +
        `the photograph readers and the coach will be back next month.`,
    };
  }
  if (myRupees >= DAY_PERSON_RUPEES) {
    return {
      ok: false,
      status: 429,
      message:
        `You've used your ₹${DAY_PERSON_RUPEES} of AI for today, so there's some left ` +
        `for the rest of the family. Everything else in the app works as usual; ` +
        `try this again tomorrow.`,
    };
  }
  return { ok: true, familyRupees, myRupees };
}

/**
 * Written down after the answer comes back. A ledger that fails to
 * record must never lose the family their answer, so this never throws.
 */
export async function recordSpend(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  args: { userId: string; kutumbhId: string | null; feature: string; model: string; usage: Usage },
): Promise<void> {
  try {
    const u = args.usage;
    await supabase.from("ai_spend").insert({
      user_id:            args.userId,
      kutumbh_id:         args.kutumbhId,
      feature:            args.feature,
      model:              args.model,
      input_tokens:       u.input_tokens ?? 0,
      output_tokens:      u.output_tokens ?? 0,
      cache_read_tokens:  u.cache_read_input_tokens ?? 0,
      cache_write_tokens: u.cache_creation_input_tokens ?? 0,
      cost_rupees:        rupeesFor(args.model, u),
    });
  } catch {
    // Silence here is deliberate: see the note above.
  }
}
