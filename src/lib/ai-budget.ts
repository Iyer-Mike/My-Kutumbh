import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * What the thinking costs, and when to stop.
 *
 * The family has a month's allowance; each person has a day's. Either
 * one reached, the AI features wait — and everything the app works out
 * by rule carries on as before. The money is counted in paise so that
 * nothing is ever lost to rounding.
 */

// ── The ceiling, as the family set it ──
export const MONTH_FAMILY_PAISE = 50_000; // ₹500 a month, the whole Kutumbh
export const DAY_PERSON_PAISE   =  5_000; // ₹50 a day, one person

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
 * What one answer cost, in paise. Cache reads are a tenth of the input
 * price and cache writes a quarter more; an unknown model is priced as
 * the dearest we use, so a new model can never slip past the ceiling.
 */
export function paiseFor(model: string, usage: Usage): number {
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

  return Math.ceil(usd * USD_TO_INR * 100);
}

export type BudgetVerdict =
  | { ok: true; familyPaise: number; myPaise: number }
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

  const [familyRes, mineRes] = await Promise.all([
    kutumbhId
      ? supabase.from("ai_spend").select("paise").eq("kutumbh_id", kutumbhId).gte("created_at", monthStart)
      : supabase.from("ai_spend").select("paise").eq("user_id", userId).gte("created_at", monthStart),
    supabase.from("ai_spend").select("paise").eq("user_id", userId).gte("created_at", dayStart),
  ]);

  // A ledger we cannot read must not lock the family out of the app.
  const sum = (rows: { paise: number }[] | null) => (rows ?? []).reduce((t, r) => t + (r.paise ?? 0), 0);
  const familyPaise = sum(familyRes.data);
  const myPaise     = sum(mineRes.data);

  if (familyPaise >= MONTH_FAMILY_PAISE) {
    return {
      ok: false,
      status: 429,
      message:
        `Your Kutumbh has used its ₹${MONTH_FAMILY_PAISE / 100} of AI for this month. ` +
        `Menus, logging, the shopping list and recipes all carry on as usual — ` +
        `the photograph readers and the coach will be back next month.`,
    };
  }
  if (myPaise >= DAY_PERSON_PAISE) {
    return {
      ok: false,
      status: 429,
      message:
        `You've used your ₹${DAY_PERSON_PAISE / 100} of AI for today, so there's some left ` +
        `for the rest of the family. Everything else in the app works as usual; ` +
        `try this again tomorrow.`,
    };
  }
  return { ok: true, familyPaise, myPaise };
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
      paise:              paiseFor(args.model, u),
    });
  } catch {
    // Silence here is deliberate: see the note above.
  }
}
