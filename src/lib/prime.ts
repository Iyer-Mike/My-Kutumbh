import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Who looks after a Kutumbh, and how that passes on.
 *
 * A family should outlive any one member's phone. The role moves three
 * ways: handed over at will, claimed after a week of silence, or taken
 * back by the one who was away.
 */

/** How long a Prime Member may be silent before the role can be taken. */
export const QUIET_DAYS = 7;

/** How long afterwards they may take it back. */
export const RECLAIM_DAYS = 14;

/**
 * Mark that this person is here. Written at most once an hour — silence
 * is measured in days, so there is no sense writing on every page.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function touchLastSeen(supabase: SupabaseClient<any, any, any>, userId: string, lastSeen: string | null) {
  const anHourAgo = Date.now() - 60 * 60 * 1000;
  if (lastSeen && new Date(lastSeen).getTime() > anHourAgo) return;
  await supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", userId);
}

export type PrimeState = {
  /** Days since the Prime Member last opened the app, null if never recorded. */
  primeQuietDays: number | null;
  /** May this member take the role, because the Prime Member has gone quiet? */
  canClaim: boolean;
  /** Was this person's role taken while they were away, recently enough to take back? */
  canReclaim: boolean;
  /** Who took it, if so. */
  takenBy: string | null;
};

/**
 * What this member may do about the role right now. Read-only — every
 * rule is enforced again in the database when they act.
 */
export async function primeState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  kutumbhId: string | null,
  primeUserId: string | null,
  isPrime: boolean,
): Promise<PrimeState> {
  const none: PrimeState = { primeQuietDays: null, canClaim: false, canReclaim: false, takenBy: null };
  if (!kutumbhId) return none;

  // Was my own role taken while I was away, and is it still within the fortnight?
  const { data: change } = await supabase
    .from("prime_changes")
    .select("created_at, to_user, kind")
    .eq("kutumbh_id", kutumbhId)
    .eq("from_user", userId)
    .eq("kind", "claim")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let canReclaim = false;
  let takenBy: string | null = null;
  if (change && !isPrime) {
    const days = (Date.now() - new Date(change.created_at).getTime()) / 86_400_000;
    if (days <= RECLAIM_DAYS) {
      canReclaim = true;
      takenBy = change.to_user as string;
    }
  }

  if (isPrime || !primeUserId) return { ...none, canReclaim, takenBy };

  const { data: prime } = await supabase
    .from("profiles")
    .select("last_seen_at")
    .eq("id", primeUserId)
    .maybeSingle();

  const seen = prime?.last_seen_at ? new Date(prime.last_seen_at).getTime() : null;
  const quietDays = seen === null ? null : Math.floor((Date.now() - seen) / 86_400_000);

  return {
    primeQuietDays: quietDays,
    canClaim: quietDays === null ? false : quietDays >= QUIET_DAYS,
    canReclaim,
    takenBy,
  };
}
