"use client";

import Link from "next/link";
import { Card, C, T } from "./bits";

/**
 * What a family sees before there is anything to say.
 *
 * Four tabs of empty cards is a poor way to meet someone. Until there
 * is food logged or a report to read, Insights shows one card instead:
 * what will appear here, and the two things that make it appear.
 *
 * This is most families' first impression of the page, so it is worth
 * as much care as the full version.
 */
export default function Beginning({
  loggedDays, hasReport, viewingOther, firstName,
}: {
  loggedDays: number;
  hasReport: boolean;
  viewingOther: boolean;
  firstName: string;
}) {
  const who = viewingOther ? firstName : "you";
  const needsFood = loggedDays < 3;

  return (
    <div className="grid gap-3">
      <Card>
        <p className="m-0 font-semibold" style={{ fontSize: T.say, color: C.ink }}>
          {loggedDays === 0
            ? `Nothing has been logged yet`
            : `${loggedDays} ${loggedDays === 1 ? "day" : "days"} logged so far`}
        </p>
        <p className="m-0 mt-2" style={{ fontSize: T.body, color: C.ink2, lineHeight: 1.55 }}>
          Insights reads what {who} {viewingOther ? "eats" : "eat"} against what {who} {viewingOther ? "needs" : "need"},
          and against {viewingOther ? "their" : "your"} lab report. It needs a little of both before it can say anything
          worth reading.
        </p>

        <div className="mt-4 grid gap-3">
          {/* The two things that fill this page */}
          <div className="flex gap-3 items-start">
            <span
              className="flex-shrink-0 rounded-full flex items-center justify-center font-bold"
              style={{
                width: "1.7rem", height: "1.7rem", fontSize: T.note, lineHeight: 1,
                background: needsFood ? "#E7DCF7" : "#E1F0DE",
                color: needsFood ? C.purple : C.leaf,
              }}
            >
              {needsFood ? "1" : "✓"}
            </span>
            <div>
              <p className="m-0 font-semibold" style={{ fontSize: T.body, color: C.ink }}>
                Log three days of meals
              </p>
              <p className="m-0 mt-0.5" style={{ fontSize: T.note, color: C.ink3, lineHeight: 1.5 }}>
                {needsFood
                  ? "Three days is enough for a fair average. Breakfast, lunch and dinner, roughly as eaten — exactness can wait."
                  : "Done. The averages here have something to stand on."}
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <span
              className="flex-shrink-0 rounded-full flex items-center justify-center font-bold"
              style={{
                width: "1.7rem", height: "1.7rem", fontSize: T.note, lineHeight: 1,
                background: hasReport ? "#E1F0DE" : "#E7DCF7",
                color: hasReport ? C.leaf : C.purple,
              }}
            >
              {hasReport ? "✓" : "2"}
            </span>
            <div>
              <p className="m-0 font-semibold" style={{ fontSize: T.body, color: C.ink }}>
                Add a lab report, if there is one
              </p>
              <p className="m-0 mt-0.5" style={{ fontSize: T.note, color: C.ink3, lineHeight: 1.5 }}>
                {hasReport
                  ? "Done. The readings are read against the food."
                  : "A photograph or PDF of a blood test. Not required — the page works without it, but with it the advice is about this body rather than bodies in general."}
              </p>
            </div>
          </div>
        </div>

        {!viewingOther && (
          <div className="flex gap-2 mt-4">
            <Link
              href="/log"
              className="rounded-full px-4 py-2.5 font-semibold"
              style={{ fontSize: T.note, background: "#2D1B4E", color: "#fff" }}
            >
              Log a meal
            </Link>
            {!hasReport && (
              <Link
                href="/profile"
                className="rounded-full px-4 py-2.5 font-semibold"
                style={{ fontSize: T.note, background: "#E7DCF7", color: C.purple }}
              >
                Add a report
              </Link>
            )}
          </div>
        )}
      </Card>

      {/* What will be here — so the emptiness has a shape */}
      <Card>
        <p className="m-0 font-semibold uppercase tracking-widest" style={{ fontSize: T.label, color: C.ink3 }}>
          What will appear here
        </p>
        <div className="mt-3 grid gap-2.5">
          {[
            ["Needs", "What the report asks for, what the food gave, and the few changes that answer both."],
            ["Intake", "The targets your age, weight and conditions produce — and how close the eating comes."],
            ["Report", "Blood readings in plain words, and what the food adds to them."],
            ["Ayurveda", "The six tastes of a week's food, and what they do for your Prakriti."],
          ].map(([name, what]) => (
            <p key={name} className="m-0" style={{ fontSize: T.body, color: C.ink2, lineHeight: 1.5 }}>
              <span className="font-bold" style={{ color: C.ink }}>{name}</span> — {what}
            </p>
          ))}
        </div>
      </Card>
    </div>
  );
}
