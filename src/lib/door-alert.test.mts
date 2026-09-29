import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { tellAdminIfWaiting } from "./door-alert.ts";

/**
 * The claim-send-release dance.
 *
 * What is being protected here is a person, not a feature: someone who
 * registers and is never announced sits behind the door indefinitely.
 * So the tests care most about the failure paths — no key, refused
 * post, thrown error — and that each of them leaves the claim free for
 * the next attempt.
 */

type Call = { name: string; args?: unknown };

function db({ claim = true, nameless = false }: { claim?: boolean | "error"; nameless?: boolean } = {}) {
  const calls: Call[] = [];
  const faults: unknown[] = [];

  const profiles = {
    select: () => profiles,
    eq: () => profiles,
    maybeSingle: () =>
      Promise.resolve({ data: nameless ? { full_name: null } : { full_name: "Venkata <b>Ramana</b>" } }),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = {
    rpc: (name: string) => {
      calls.push({ name });
      if (name === "admin_notice_claim") {
        return claim === "error"
          ? Promise.resolve({ data: null, error: { message: "boom" } })
          : Promise.resolve({ data: claim, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    from: (table: string) => {
      if (table === "app_faults") return { insert: (row: unknown) => { faults.push(row); return Promise.resolve({}); } };
      return profiles;
    },
  };

  return {
    client,
    rpcs: () => calls.map((c) => c.name),
    faults: () => faults,
  };
}

const user = { id: "u1", email: "someone@example.com", user_metadata: {} } as never;
const URL_ = "https://my-kutumbh.vercel.app";

let posted: { url: string; body: Record<string, unknown> }[] = [];
let answer: { ok: boolean; status: number } | Error = { ok: true, status: 200 };
const realFetch = globalThis.fetch;

beforeEach(() => {
  posted = [];
  answer = { ok: true, status: 200 };
  process.env.RESEND_API_KEY = "test-key";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.fetch = ((url: string, init: any) => {
    posted.push({ url: String(url), body: JSON.parse(init.body) });
    if (answer instanceof Error) return Promise.reject(answer);
    return Promise.resolve(answer as Response);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.RESEND_API_KEY;
});

describe("telling the Admin somebody is waiting", () => {
  test("claims first, then posts once", async () => {
    const { client, rpcs } = db();
    await tellAdminIfWaiting(client, user, URL_);

    assert.deepEqual(rpcs(), ["admin_notice_claim"]);
    assert.equal(posted.length, 1);
    assert.match(posted[0]!.url, /api\.resend\.com/);
  });

  test("nothing at all without a key — the claim stays free", async () => {
    delete process.env.RESEND_API_KEY;
    const { client, rpcs } = db();
    await tellAdminIfWaiting(client, user, URL_);

    assert.deepEqual(rpcs(), []);
    assert.equal(posted.length, 0);
  });

  test("somebody already told is not told again", async () => {
    const { client, rpcs } = db({ claim: false });
    await tellAdminIfWaiting(client, user, URL_);

    assert.deepEqual(rpcs(), ["admin_notice_claim"]);
    assert.equal(posted.length, 0);
  });

  test("before phase 25 has run, the page still renders", async () => {
    const { client } = db({ claim: "error" });
    await tellAdminIfWaiting(client, user, URL_);
    assert.equal(posted.length, 0);
  });

  test("a refused post gives the claim back and is written down", async () => {
    answer = { ok: false, status: 403 };
    const { client, rpcs, faults } = db();
    await tellAdminIfWaiting(client, user, URL_);

    assert.deepEqual(rpcs(), ["admin_notice_claim", "admin_notice_release"]);
    assert.equal(faults().length, 1);
    assert.match(JSON.stringify(faults()[0]), /resend_403/);
  });

  test("a post that throws does the same", async () => {
    answer = new Error("socket hang up");
    const { client, rpcs, faults } = db();
    await tellAdminIfWaiting(client, user, URL_);

    assert.deepEqual(rpcs(), ["admin_notice_claim", "admin_notice_release"]);
    assert.equal(faults().length, 1);
  });
});

describe("what the letter says", () => {
  test("names the person in the subject and links to the desk", async () => {
    const { client } = db();
    await tellAdminIfWaiting(client, user, URL_ + "/");

    const mail = posted[0]!.body;
    assert.match(String(mail.subject), /At the door/);
    assert.match(String(mail.text), /someone@example\.com/);
    assert.match(String(mail.text), /my-kutumbh\.vercel\.app\/admin/);
    assert.doesNotMatch(String(mail.text), /\/\/admin/);      // no doubled slash
  });

  test("a name is treated as text, never as markup", async () => {
    const { client } = db();
    await tellAdminIfWaiting(client, user, URL_);

    const html = String(posted[0]!.body.html);
    assert.match(html, /Venkata &lt;b&gt;Ramana&lt;\/b&gt;/);
    assert.doesNotMatch(html, /Venkata <b>Ramana<\/b>/);
  });

  /**
   * The app is never told whether a newcomer is a man or a woman, so
   * "he" would be a guess and "they", of one person at a door, reads
   * wrong. The letter is written to need neither. This test is here
   * because that is easy to undo by accident while editing wording.
   */
  const PRONOUN = /\b(he|she|him|her|hers|his|they|them|their|theirs)\b/i;

  test("no pronoun stands in for the newcomer", async () => {
    const { client } = db();
    await tellAdminIfWaiting(client, user, URL_);

    assert.doesNotMatch(String(posted[0]!.body.text), PRONOUN);
    assert.doesNotMatch(String(posted[0]!.body.subject), PRONOUN);
  });

  test("nor when no name was given", async () => {
    const { client } = db({ nameless: true });
    await tellAdminIfWaiting(client, user, URL_);

    const mail = posted[0]!.body;
    assert.doesNotMatch(String(mail.text), PRONOUN);
    assert.match(String(mail.subject), /Someone is at the door/);
    assert.match(String(mail.text), /no name was given/);
  });

  test("only the Admin is ever written to", async () => {
    const { client } = db();
    await tellAdminIfWaiting(client, user, URL_);

    assert.deepEqual(posted[0]!.body.to, ["iyer.mike@gmail.com"]);
  });
});
