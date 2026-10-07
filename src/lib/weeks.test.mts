import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { addDays, monthStart, weekOf } from "./weeks.ts";

describe("calendar weeks, Sunday to Saturday", () => {
  test("Week 41 of 2026 is 4 to 10 October", () => {
    for (const d of ["2026-10-04", "2026-10-07", "2026-10-10"]) {
      assert.deepEqual(weekOf(d), { n: 41, start: "2026-10-04", end: "2026-10-10" });
    }
  });
  test("the week holding 1 January is Week 1, even when it starts in December", () => {
    assert.deepEqual(weekOf("2026-01-01"), { n: 1, start: "2025-12-28", end: "2026-01-03" });
    assert.equal(weekOf("2026-12-28").n, 1);          // 2026-12-27 to 2027-01-02
    assert.equal(weekOf("2026-12-22").n, 52);
  });
  test("helpers", () => {
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
    assert.equal(monthStart("2026-10-07"), "2026-10-01");
  });
});
