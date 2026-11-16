import type { SupabaseClient } from "@supabase/supabase-js";
import { standingOf } from "./admission.ts";

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
export const DAY_PERSON_RUPEES   = 100; // a day, one person

/**
 * A new family starts small. Anyone may register without the Admin's
 * approval, so a Kutumbh's first month has a starter allowance; after that
 * it has the usual one. The Admin can set either figure for a family by hand.
 */
export const STARTER_RUPEES = 100;
export const STARTER_DAYS   = 30;

/** This family's AI allowance for the month, in rupees. */
export function familyAllowance(createdAt: string | null | undefined, override: number | null | undefined, now = Date.now()): number {
  if (override != null && Number.isFinite(Number(override)) && Number(override) >= 0) return Number(override);
  const born = createdAt ? Date.parse(createdAt) : NaN;
  if (Number.isFinite(born) && now - born < STARTER_DAYS * 86_400_000) return STARTER_RUPEES;
  return MONTH_FAMILY_RUPEES;
}

export type FamilyLimit = { allowance: number; blocked: boolean; starter: boolean };

/** What this family may spend, and whether the Admin has paused it. A limit we cannot read falls back to the usual one. */
export async function familyLimit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  kutumbhId: string | null,
): Promise<FamilyLimit> {
  const usual: FamilyLimit = { allowance: MONTH_FAMILY_RUPEES, blocked: false, starter: false };
  if (!kutumbhId) return usual;
  try {
    const [{ data: fam }, { data: lim }] = await Promise.all([
      supabase.from("kutumbhs").select("created_at").eq("id", kutumbhId).maybeSingle(),
      supabase.from("kutumbh_limits").select("ai_month_rupees, blocked").eq("kutumbh_id", kutumbhId).maybeSingle(),
    ]);
    const override = lim?.ai_month_rupees != null ? Number(lim.ai_month_rupees) : null;
    const allowance = familyAllowance(fam?.created_at ?? null, override);
    return { allowance, blocked: lim?.blocked === true, starter: override == null && allowance === STARTER_RUPEES };
  } catch {
    return usual;
  }
}

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
  | { ok: true; familyRupees: number; myRupees: number; allowance: number; starter: boolean }
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
  // Only someone let in may spend money. Every AI route asks here, so a person
  // who has been turned away cannot reach an AI feature by any route.
  if ((await standingOf(supabase, userId)) !== "admitted") {
    return {
      ok: false,
      status: 403,
      message: "The AI features open once you have been welcomed in to My Kutumb Bhojan.",
    };
  }

  const limit = await familyLimit(supabase, kutumbhId);
  if (limit.blocked) {
    return {
      ok: false,
      status: 403,
      message: "The AI features are paused for your Kutumbh. Please write to the person who looks after My Kutumb Bhojan.",
    };
  }

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
        "My Kutumb Bhojan has reached its own AI limit for this month, across all the families using it. " +
        "Everything the app works out by itself carries on as usual. If this is your app, raising the " +
        "limit is a one-line change on the server.",
    };
  }

  if (familyRupees >= limit.allowance) {
    return {
      ok: false,
      status: 429,
      message:
        `Your Kutumbh has used its ₹${limit.allowance} of AI for this month. ` +
        `Menus, logging, the shopping list and recipes all carry on as usual. ` +
        (limit.starter
          ? `A new Kutumbh starts with a smaller allowance for its first ${STARTER_DAYS} days; it rises to ₹${MONTH_FAMILY_RUPEES} after that.`
          : `The photograph readers and the coach will be back next month.`),
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
  return { ok: true, familyRupees, myRupees, allowance: limit.allowance, starter: limit.starter };
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
