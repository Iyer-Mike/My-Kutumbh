"use client";

import { useState } from "react";
import type { Action, Gap, Plan } from "@/lib/insights/actions";

/**
 * The three things a reader should see first: what not to eat at all,
 * what to change, and where they stand.
 *
 * Everything here is said once. The findings that argued for an action
 * are folded underneath it as reasons, not repeated as separate advice.
 */

const C = {
  ink: "#241C33", ink2: "#4A4360", ink3: "#6A6180",
  rule: "#E0D4F2", card: "#FAF7FE",
  leaf: "#2F6B34", warn: "#B0453A", gold: "#8A5A06",
};

/** Not advice to balance — things not to eat. Kept apart, and first. */
function Avoid({ items }: { items: Action[] }) {
  if (!items.length) return null;
  return (
    <section className="rounded-2xl px-4 py-4" style={{ background: "#FDF3F2", border: "1px solid #E8C4BF" }}>
      <p className="text-xs font-semibold uppercase tracking-widest m-0 mb-2" style={{ color: C.warn }}>
        Avoid
      </p>
      {items.map((a) => (
        <div key={a.id} className="mb-1 last:mb-0">
          <p className="text-sm font-semibold m-0" style={{ color: C.ink }}>{a.headline}</p>
          {a.because.length > 0 && (
            <p className="text-xs mt-0.5 m-0" style={{ color: C.ink3 }}>{a.because.join(" · ")}</p>
          )}
        </div>
      ))}
    </section>
  );
}

/** One instruction, with its number, and the reasons folded under it. */
function ActionRow({ a, n }: { a: Action; n: number }) {
  const [why, setWhy] = useState(false);
  const tint = a.kind === "reduce" ? C.warn : C.leaf;

  return (
    <div className="py-3" style={{ borderTop: n === 0 ? "none" : `1px solid ${C.rule}` }}>
      <div className="flex gap-3">
        <span
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
          style={{ background: a.kind === "reduce" ? "#FBE2DC" : "#E1F0DE", color: tint }}
        >
          {a.kind === "reduce" ? "−" : "+"}
        </span>
        <div className="min-w-0">
          <p className="text-sm m-0" style={{ color: C.ink }}>{a.headline}</p>
          {a.because.length > 0 && (
            <button
              onClick={() => setWhy(!why)}
              className="text-[11px] font-medium mt-1"
              style={{ color: C.ink3 }}
            >
              {why ? "Hide why" : `Why · ${a.because.length}`}
            </button>
          )}
          {why && (
            <ul className="mt-1 mb-0 pl-4 text-[11px] grid gap-0.5" style={{ color: C.ink3, listStyle: "disc" }}>
              {a.because.map((b) => <li key={b}>{b}</li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** What was eaten against what is needed, and the difference in food. */
function GapRow({ g }: { g: Gap }) {
  const short = g.kind === "goal";
  const fill = Math.min(100, Math.round(g.share * 100));
  const colour = short ? (g.share < 0.6 ? C.warn : C.gold) : C.warn;

  return (
    <div className="py-2.5" style={{ borderTop: `1px solid ${C.rule}` }}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium" style={{ color: C.ink }}>{g.label}</span>
        <span className="text-xs tabular-nums" style={{ color: C.ink3 }}>
          {g.had.toLocaleString("en-IN")} of {g.target.toLocaleString("en-IN")} {g.unit}
          <span className="font-semibold" style={{ color: colour }}> · {g.gapText}</span>
        </span>
      </div>

      <div className="h-1.5 rounded-full overflow-hidden mt-1.5" style={{ background: "#E7DCF7" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(fill, 2)}%`, background: colour }} />
      </div>

      {g.inFood && (
        <p className="text-xs mt-1.5 m-0" style={{ color: C.ink2 }}>{g.inFood}</p>
      )}
    </div>
  );
}

export default function InsightsPlan({
  plan,
  kcalHad,
  kcalTarget,
  loggedDays,
  viewingOther,
  firstName,
}: {
  plan: Plan;
  kcalHad: number;
  kcalTarget: number;
  loggedDays: number;
  viewingOther: boolean;
  firstName: string;
}) {
  const who = viewingOther ? firstName : "you";
  const nothingWrong = plan.actions.length === 0 && plan.gaps.length === 0 && plan.avoid.length === 0;

  return (
    <div className="grid gap-3">
      <Avoid items={plan.avoid} />

      {/* ── What to change ── */}
      {plan.actions.length > 0 && (
        <section className="rounded-2xl px-4 py-4" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
          <p className="text-xs font-semibold uppercase tracking-widest m-0" style={{ color: C.ink3 }}>
            What to change this week
          </p>
          <p className="text-[11px] mt-1 mb-1 m-0" style={{ color: C.ink3 }}>
            The {plan.actions.length === 1 ? "one thing" : `${plan.actions.length} things`} that would move the most,
            strongest first.
          </p>
          <div className="mt-1">
            {plan.actions.map((a, i) => <ActionRow key={a.id} a={a} n={i} />)}
          </div>
        </section>
      )}

      {/* ── Where you stand ── */}
      <section className="rounded-2xl px-4 py-4" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
        <p className="text-xs font-semibold uppercase tracking-widest m-0 mb-2" style={{ color: C.ink3 }}>
          Where {viewingOther ? `${firstName} stands` : "you stand"}
        </p>

        <p className="text-2xl font-bold tabular-nums m-0" style={{ color: C.ink }}>
          {Math.round(kcalHad).toLocaleString("en-IN")}
          <span className="text-sm font-medium" style={{ color: C.ink3 }}>
            {" "}kcal a day of {Math.round(kcalTarget).toLocaleString("en-IN")}
          </span>
        </p>
        <p className="text-[11px] mt-0.5 mb-1 m-0" style={{ color: C.ink3 }}>
          averaged over {loggedDays} logged {loggedDays === 1 ? "day" : "days"}
        </p>

        {plan.gaps.length === 0 ? (
          <p className="text-sm mt-3 mb-0" style={{ color: C.leaf }}>
            Everything else is within range. Nothing needs changing.
          </p>
        ) : (
          <div className="mt-2">
            {plan.gaps.map((g) => <GapRow key={g.label} g={g} />)}
          </div>
        )}
      </section>

      {/* ── For a doctor, not the kitchen ── */}
      {plan.doctor.length > 0 && (
        <section className="rounded-2xl px-4 py-4" style={{ background: "#FFFBF2", border: "1px solid #EBD9B4" }}>
          <p className="text-xs font-semibold uppercase tracking-widest m-0 mb-2" style={{ color: C.gold }}>
            Worth asking a doctor
          </p>
          <ul className="grid gap-1.5 text-sm m-0 pl-4" style={{ color: C.ink, listStyle: "disc" }}>
            {plan.doctor.map((d) => <li key={d}>{d}</li>)}
          </ul>
          <p className="text-[11px] mt-2 mb-0" style={{ color: C.ink3 }}>
            Food cannot settle these. They are not urgent unless {who} {viewingOther ? "feels" : "feel"} unwell.
          </p>
        </section>
      )}

      {nothingWrong && (
        <section className="rounded-2xl px-4 py-4" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
          <p className="text-sm m-0" style={{ color: C.leaf }}>
            Nothing is off at the moment. Eating as {viewingOther ? `${firstName} is` : "you are"}.
          </p>
        </section>
      )}
    </div>
  );
}
