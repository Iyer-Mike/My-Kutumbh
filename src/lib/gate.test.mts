import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  HOME, START, afterSignIn, emailReturnTo, isAuthPath, isPublicPath, isStartPath, safeRedirect, signInHref,
} from "./gate.ts";

describe("who may pass without an account", () => {
  test("the way in is public", () => {
    for (const p of ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/join/ABC123", "/auth/callback"]) {
      assert.equal(isPublicPath(p), true, p);
    }
  });

  test("the app itself is not", () => {
    for (const p of ["/dashboard", "/log", "/insights", "/family", "/profile", "/pantry", "/recipes", "/recipes/12"]) {
      assert.equal(isPublicPath(p), false, p);
    }
  });

  test("onboarding is its own case", () => {
    assert.equal(isStartPath("/onboarding"), true);
    assert.equal(isAuthPath("/login?redirect=/x"), true);
    assert.equal(isAuthPath("/dashboard"), false);
  });
});

describe("coming back to where you were going", () => {
  test("a deep link is remembered", () => {
    assert.equal(signInHref("/recipes/12"), "/login?redirect=%2Frecipes%2F12");
    assert.equal(signInHref("/insights", "?member=abc"), "/login?redirect=%2Finsights%3Fmember%3Dabc");
  });

  test("a public page needs no return trip", () => {
    assert.equal(signInHref("/join/ABC123"), "/login");
  });

  test("only our own pages are worth returning to", () => {
    assert.equal(safeRedirect("https://example.com/steal"), HOME);
    assert.equal(safeRedirect("//example.com"), HOME);
    assert.equal(safeRedirect("/login"), HOME);
    assert.equal(safeRedirect(null), HOME);
    assert.equal(safeRedirect("/pantry"), "/pantry");
  });
});

describe("an invite comes first", () => {
  test("before the page they asked for", () => {
    assert.equal(afterSignIn("/pantry", "ABC123"), "/join/ABC123");
    assert.equal(afterSignIn(null, "ABC123"), "/join/ABC123");
  });

  test("and without one, they carry on", () => {
    assert.equal(afterSignIn("/pantry", null), "/pantry");
    assert.equal(afterSignIn(null, null), HOME);
  });

  test("a confirmation email returns to the right place", () => {
    assert.equal(emailReturnTo("https://app.test", "/join/ABC123"), "https://app.test/auth/callback?next=%2Fjoin%2FABC123");
    assert.equal(emailReturnTo("https://app.test", null), `https://app.test/auth/callback?next=%2Fonboarding`);
    assert.equal(START, "/onboarding");
  });
});
