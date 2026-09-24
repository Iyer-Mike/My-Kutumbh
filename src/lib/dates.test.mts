import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { clampDay, dayLabel, daysAgoLocal, daysAheadLocal, daysFromToday, todayLocal } from "./dates.ts";

// A fixed moment in India: 24 Sep 2026, mid-morning
const NOW = new Date("2026-09-24T04:30:00Z");

describe("moving between days", () => {
  test("today, yesterday, tomorrow", () => {
    assert.equal(todayLocal(NOW), "2026-09-24");
    assert.equal(daysAgoLocal(1, NOW), "2026-09-23");
    assert.equal(daysAheadLocal(1, NOW), "2026-09-25");
  });

  test("late evening in India is still the same day", () => {
    // 23:30 IST on the 24th is 18:00 UTC
    assert.equal(todayLocal(new Date("2026-09-24T18:00:00Z")), "2026-09-24");
  });

  test("counting days either way", () => {
    assert.equal(daysFromToday("2026-09-24", NOW), 0);
    assert.equal(daysFromToday("2026-09-21", NOW), -3);
    assert.equal(daysFromToday("2026-10-01", NOW), 7);
  });
});

describe("keeping a date inside what a page allows", () => {
  test("a date in range is left alone", () => {
    assert.equal(clampDay("2026-09-22", 30, 0, NOW), "2026-09-22");
  });

  test("too far back or forward is pulled to the edge", () => {
    assert.equal(clampDay("2026-01-01", 30, 0, NOW), "2026-08-25");
    assert.equal(clampDay("2026-12-31", 30, 6, NOW), "2026-09-30");
  });

  test("nonsense means today", () => {
    assert.equal(clampDay("not-a-date", 30, 0, NOW), "2026-09-24");
    assert.equal(clampDay(null, 30, 0, NOW), "2026-09-24");
    assert.equal(clampDay("2026-13-45", 30, 0, NOW), "2026-09-24");
  });
});

describe("naming a day", () => {
  test("the near days have names", () => {
    assert.equal(dayLabel("2026-09-24", NOW), "Today");
    assert.equal(dayLabel("2026-09-23", NOW), "Yesterday");
    assert.equal(dayLabel("2026-09-25", NOW), "Tomorrow");
  });

  test("further out shows the date", () => {
    assert.match(dayLabel("2026-09-20", NOW), /20 Sep/);
  });
});
