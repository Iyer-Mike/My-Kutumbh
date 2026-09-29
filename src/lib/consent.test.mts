import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { pendingConsents } from "./consent.ts";
import { PRIVACY, TERMS, DOCS, fingerprint } from "./legal.ts";

/**
 * A consent is to particular words, not to a document's name.
 *
 * The whole reason the fingerprint exists is that a promise about
 * somebody's blood report can be edited. If editing it left old
 * agreements standing, the record would say a family agreed to
 * something they never saw.
 */

type Row = { doc: string; fingerprint: string };

function db(rows: Row[] | "error") {
  let filter = "";
  const chain = {
    select: () => chain,
    or: (f: string) => {
      filter = f;
      return Promise.resolve(
        rows === "error"
          ? { data: null, error: { message: 'relation "consents" does not exist' } }
          : { data: rows, error: null },
      );
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = { from: () => chain } as any;
  return Object.assign(client, { seenFilter: () => filter });
}

const signedToday = (): Row[] => DOCS.map((d) => ({ doc: d.slug, fingerprint: fingerprint(d) }));

describe("what a member still has to agree to", () => {
  test("someone who has agreed to nothing is asked for both", async () => {
    const out = await pendingConsents(db([]), "u1");
    assert.deepEqual(out.map((d) => d.slug), ["privacy", "terms"]);
  });

  test("someone who agreed to today's words is asked for nothing", async () => {
    const out = await pendingConsents(db(signedToday()), "u1");
    assert.equal(out.length, 0);
  });

  test("a changed privacy notice is asked about again", async () => {
    const stale = signedToday().map((r) =>
      r.doc === "privacy" ? { ...r, fingerprint: "000000000000" } : r,
    );
    const out = await pendingConsents(db(stale), "u1");
    assert.deepEqual(out.map((d) => d.slug), ["privacy"]);
  });

  test("agreeing to the terms does not carry over to the privacy notice", async () => {
    const out = await pendingConsents(db([{ doc: "terms", fingerprint: fingerprint(TERMS) }]), "u1");
    assert.deepEqual(out.map((d) => d.slug), ["privacy"]);
  });

  test("before the table exists, nobody is shut out of their own food diary", async () => {
    const out = await pendingConsents(db("error"), "u1");
    assert.equal(out.length, 0);
  });

  /**
   * A child's agreement is given by whoever can give it. The filter is
   * where that lives now, so the filter is what is checked: rows this
   * person signed for THEMSELVES, plus rows anybody signed FOR them —
   * and never a row where they signed for somebody else.
   */
  test("it asks for both their own consents and any given for them", async () => {
    const client = db([]);
    await pendingConsents(client, "child-1");

    assert.equal(
      client.seenFilter(),
      "and(user_id.eq.child-1,on_behalf_of.is.null),on_behalf_of.eq.child-1",
    );
  });

  test("a guardian's consent settles it for the child", async () => {
    const out = await pendingConsents(db(signedToday()), "child-1");
    assert.equal(out.length, 0);
  });
});

describe("the fingerprint itself", () => {
  test("two documents do not share one", () => {
    assert.notEqual(fingerprint(PRIVACY), fingerprint(TERMS));
  });

  test("it follows the words, not the title or the version", () => {
    const renamed = { ...PRIVACY, title: "Something else", version: "1999-01-01" };
    assert.equal(fingerprint(renamed), fingerprint(PRIVACY));
  });

  test("one edited character changes it", () => {
    const edited = {
      ...PRIVACY,
      sections: PRIVACY.sections.map((s, i) => (i === 0 ? { ...s, body: [...s.body, "And one more thing."] } : s)),
    };
    assert.notEqual(fingerprint(edited), fingerprint(PRIVACY));
  });

  test("the promises a member is most likely to check are actually in there", () => {
    const words = PRIVACY.sections.flatMap((s) => s.body).join(" ");
    assert.match(words, /Prime Member/);      // who reads your blood report
    assert.match(words, /Anthropic/);          // what leaves the app
    assert.match(words, /Singapore/);          // where it lives
    assert.match(words, /Forget me/);          // how to end it
  });

  test("the terms say plainly that this is not a doctor", () => {
    const words = TERMS.sections.flatMap((s) => s.body).join(" ");
    assert.match(words, /not a doctor/i);
  });
});
