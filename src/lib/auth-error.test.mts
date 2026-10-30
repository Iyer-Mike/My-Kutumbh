import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isNetworkError, authErrorText, withOneRetry, NETWORK_MESSAGE } from "./auth-error.ts";

describe("a dropped connection is not a wrong password", () => {
  test("the browser's own wording is recognised", () => {
    assert.equal(isNetworkError({ message: "Failed to fetch" }), true);
    assert.equal(isNetworkError({ message: "Load failed" }), true);
    assert.equal(isNetworkError({ name: "AuthRetryableFetchError", message: "x" }), true);
  });
  test("real answers from the server are left alone", () => {
    assert.equal(isNetworkError({ message: "Invalid login credentials" }), false);
    assert.equal(isNetworkError({ message: "User already registered" }), false);
    assert.equal(isNetworkError(null), false);
  });
  test("a network failure reads plainly; anything else keeps the server's words", () => {
    assert.equal(authErrorText({ message: "Failed to fetch" }), NETWORK_MESSAGE);
    assert.equal(authErrorText({ message: "Invalid login credentials" }), "Invalid login credentials");
  });
});

describe("one more try, only for a failed connection", () => {
  test("retries once after a network failure and returns the second answer", async () => {
    let calls = 0;
    const r = await withOneRetry(async () => ({ error: ++calls === 1 ? { message: "Failed to fetch" } : null }));
    assert.equal(calls, 2);
    assert.equal(r.error, null);
  });
  test("never retries an answer such as a wrong password", async () => {
    let calls = 0;
    const r = await withOneRetry(async () => { calls++; return { error: { message: "Invalid login credentials" } }; });
    assert.equal(calls, 1);
    assert.equal(r.error?.message, "Invalid login credentials");
  });
});
