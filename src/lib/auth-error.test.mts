import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { authErrorText, checkEmail, NETWORK_MESSAGE } from "./auth-error.ts";

describe("checking an email address as typed", () => {
  test("a good address is cleaned and passes", () => {
    assert.deepEqual(checkEmail("  Asha.Rao@Gmail.com "), { email: "asha.rao@gmail.com", problem: null });
    assert.equal(checkEmail("a.b+c@remedazo.co.in").problem, null);
    // Addresses with the letter "s" were once refused by a faulty pattern
    assert.equal(checkEmail("isserjasveen@gmail.com").problem, null);
    assert.equal(checkEmail("sss@sss.subs").problem, null);
  });
  test("each slip gets its own sentence", () => {
    assert.match(checkEmail("").problem!, /type your email/);
    assert.match(checkEmail("asha rao@gmail.com").problem!, /space/);
    assert.match(checkEmail("asha.gmail.com").problem!, /needs an @/);
    assert.match(checkEmail("asha@@gmail.com").problem!, /more than one @/);
    assert.match(checkEmail("@gmail.com").problem!, /before the @/);
    assert.match(checkEmail("asha@").problem!, /after the @/);
    assert.match(checkEmail("asha@gmail").problem!, /not complete/);
    assert.match(checkEmail("asha@gmail,com").problem!, /not complete|not allowed/);
  });
  test("a common typing slip is named with the fix", () => {
    assert.match(checkEmail("asha@gmial.com").problem!, /asha@gmail\.com/);
    assert.match(checkEmail("asha@gmail.con").problem!, /asha@gmail\.com/);
  });
});

describe("what a person is told when sign-in or sign-up fails", () => {
  test("known causes get plain words", () => {
    assert.match(authErrorText({ code: "email_address_invalid", message: 'Email address "x@y" is invalid' }), /not accepted/);
    assert.match(authErrorText({ message: "User already registered" }), /already has an account/);
    assert.match(authErrorText({ message: "Invalid login credentials" }), /Incorrect email or password/);
    assert.match(authErrorText({ message: "Email not confirmed" }), /confirm your email/);
    assert.match(authErrorText({ code: "over_email_send_rate_limit", message: "email rate limit exceeded" }), /wait a few minutes/);
    assert.match(authErrorText({ status: 503, message: "upstream" }), /server had a problem/);
  });
  test("a dropped connection is not blamed on the account", () => {
    assert.equal(authErrorText({ message: "Failed to fetch" }), NETWORK_MESSAGE);
  });
  test("an unknown cause still says what the server said", () => {
    assert.match(authErrorText({ message: "Something odd" }), /Something odd/);
  });
});
