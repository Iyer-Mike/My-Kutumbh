import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { decisionLetter } from "./door-letter.ts";

describe("the letter to a newcomer", () => {
  test("a welcome names the person, carries the note and the sign-in link", () => {
    const l = decisionLetter({ name: "Asha", admit: true, note: " Glad you are here. ", appUrl: "https://x.app/", signature: "Mohan" });
    assert.match(l.subject, /Welcome/);
    assert.match(l.text, /^Dear Asha,/);
    assert.match(l.text, /Glad you are here\./);
    assert.match(l.text, /https:\/\/x\.app\/login/);
    assert.match(l.text, /— Mohan$/);
  });
  test("no name and no note still reads properly", () => {
    const l = decisionLetter({ name: null, admit: true, note: null, appUrl: "https://x.app", signature: null });
    assert.match(l.text, /^Dear friend,/);
    assert.doesNotMatch(l.text, /\n\n\n/);
  });
  test("a decline says so and gives no sign-in steps", () => {
    const l = decisionLetter({ name: "Ravi", admit: false, note: null, appUrl: "https://x.app", signature: "Mohan" });
    assert.match(l.text, /not approved/);
    assert.doesNotMatch(l.text, /login/);
  });
});
