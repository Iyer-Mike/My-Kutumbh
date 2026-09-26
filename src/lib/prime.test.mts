import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { primeState, touchLastSeen, QUIET_DAYS, RECLAIM_DAYS } from "./prime.ts";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();

/**
 * A stand-in for the database. It answers two questions: was my role
 * taken while I was away, and when was the Prime Member last here.
 */
function db({ change = null, primeSeen = null }: { change?: unknown; primeSeen?: string | null }) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: () => Promise.resolve({ data: current }),
    update: () => ({ eq: () => { writes++; return Promise.resolve({}); } }),
  };
  let current: unknown = null;
  let writes = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = {
    from: (table: string) => {
      current = table === "prime_changes" ? change : { last_seen_at: primeSeen };
      return chain;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { client, writes: () => writes };
}

describe("when a member may take the role on", () => {
  test("not while the Prime Member is using the app", async () => {
    const { client } = db({ primeSeen: daysAgo(1) });
    const s = await primeState(client, "me", "k1", "prime", false);
    assert.equal(s.canClaim, false);
    assert.equal(s.primeQuietDays, 1);
  });

  test("not on the sixth quiet day", async () => {
    const { client } = db({ primeSeen: daysAgo(QUIET_DAYS - 1) });
    const s = await primeState(client, "me", "k1", "prime", false);
    assert.equal(s.canClaim, false);
  });

  test("yes on the seventh", async () => {
    const { client } = db({ primeSeen: daysAgo(QUIET_DAYS) });
    const s = await primeState(client, "me", "k1", "prime", false);
    assert.equal(s.canClaim, true);
    assert.equal(s.primeQuietDays, QUIET_DAYS);
  });

  test("the Prime Member is never offered their own role", async () => {
    const { client } = db({ primeSeen: daysAgo(30) });
    const s = await primeState(client, "me", "k1", "me", true);
    assert.equal(s.canClaim, false);
  });

  test("a family with no Kutumbh is left alone", async () => {
    const { client } = db({ primeSeen: daysAgo(30) });
    const s = await primeState(client, "me", null, "prime", false);
    assert.equal(s.canClaim, false);
    assert.equal(s.canReclaim, false);
  });
});

describe("when the one who was away may take it back", () => {
  test("the day after it was taken", async () => {
    const { client } = db({ change: { created_at: daysAgo(1), to_user: "other", kind: "claim" } });
    const s = await primeState(client, "me", "k1", "other", false);
    assert.equal(s.canReclaim, true);
    assert.equal(s.takenBy, "other");
  });

  test("on the last day of the fortnight", async () => {
    // Just inside, not exactly on it: a boundary tested to the
    // microsecond is a test that fails at random.
    const { client } = db({ change: { created_at: daysAgo(RECLAIM_DAYS - 0.02), to_user: "other", kind: "claim" } });
    const s = await primeState(client, "me", "k1", "other", false);
    assert.equal(s.canReclaim, true);
  });

  test("not after the fortnight has passed", async () => {
    const { client } = db({ change: { created_at: daysAgo(RECLAIM_DAYS + 1), to_user: "other", kind: "claim" } });
    const s = await primeState(client, "me", "k1", "other", false);
    assert.equal(s.canReclaim, false);
  });

  test("not if they already have the role back", async () => {
    const { client } = db({ change: { created_at: daysAgo(1), to_user: "other", kind: "claim" } });
    const s = await primeState(client, "me", "k1", "me", true);
    assert.equal(s.canReclaim, false);
  });

  test("nothing was taken, nothing to take back", async () => {
    const { client } = db({ change: null, primeSeen: daysAgo(1) });
    const s = await primeState(client, "me", "k1", "prime", false);
    assert.equal(s.canReclaim, false);
  });
});

describe("marking that someone is here", () => {
  test("not written again within the hour", async () => {
    const { client, writes } = db({});
    await touchLastSeen(client, "me", hoursAgo(0.5));
    assert.equal(writes(), 0);
  });

  test("written once the hour has passed", async () => {
    const { client, writes } = db({});
    await touchLastSeen(client, "me", hoursAgo(2));
    assert.equal(writes(), 1);
  });

  test("written for someone never seen before", async () => {
    const { client, writes } = db({});
    await touchLastSeen(client, "me", null);
    assert.equal(writes(), 1);
  });
});
