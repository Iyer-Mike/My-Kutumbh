"use client";

import { useState, useTransition } from "react";
import { makePasscode, decideOn } from "@/app/(app)/admin/door-actions";
import { FAMILY, look, fieldLook } from "@/lib/brand";

const C = { ink: "#241C33", ink2: "#4A4360", ink3: "#6A6180", rule: "#E0D4F2", leaf: "#2F6B34", warn: "#B0453A", purple: "#6B46B8" };

export type Waiting = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  asked_at: string;
  invited_email: string | null;
};

/** "3 days ago", "an hour ago" — how long someone has been waiting. */
function waited(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs === 1 ? "an hour ago" : `${hrs} hours ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** Writing a passcode to put in a letter. */
function NewPasscode({ signature, appUrl }: { signature: string | null; appUrl: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [made, setMade] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const letter = [
    `Dear ${name.trim() || "friend"},`,
    "",
    "I have kept a place for you in My Kutumbh — a small app for an Indian household's food:",
    "the day's menu, what each person eats, and what the lab report says about it.",
    "",
    "To register:",
    `  ${appUrl}/signup`,
    "",
    `Your passcode: ${made}`,
    "",
    "The passcode works once and lasts a day. After you register I will welcome you in,",
    "and then you can name your own Kutumbh and begin.",
    "",
    note.trim(),
    note.trim() ? "" : null,
    `— ${signature ?? "Mohan Iyer"}`,
  ]
    .filter((line): line is string => line !== null)
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n");

  async function copyLetter() {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked — the text is on screen to copy by hand */
    }
  }

  if (made) {
    return (
      <div className="rounded-2xl px-4 py-4" style={{ background: "#241238" }}>
        <p className="m-0 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#C9B8E4" }}>
          Passcode for {email || "your letter"}
        </p>
        <p className="m-0 mt-2 font-bold tabular-nums" style={{ fontSize: "1.9rem", letterSpacing: "0.22em", color: "#fff" }}>
          {made}
        </p>
        <p className="m-0 mt-2 text-xs" style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.55 }}>
          Send from iyer.mike@gmail.com · Copy the letter, paste into Gmail, address to {email || "them"}.
        </p>

        <pre
          className="mt-3 mb-0 whitespace-pre-wrap text-left"
          style={{
            background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.92)",
            borderRadius: 12, padding: "0.75rem 0.85rem", fontSize: "0.8rem",
            lineHeight: 1.55, fontFamily: "inherit", maxHeight: "16rem", overflow: "auto",
          }}
        >
{letter}
        </pre>

        <div className="flex gap-2 mt-3">
          <button
            onClick={copyLetter}
            className="text-xs font-semibold px-4 py-2 rounded-full"
            style={{ background: copied ? "#6B46B8" : "#fff", color: copied ? "#fff" : "#241238" }}
          >
            {copied ? "Copied ✓" : "Copy the letter"}
          </button>
          <button
            onClick={() => { setMade(null); setName(""); setEmail(""); setNote(""); setOpen(false); }}
            className="text-xs font-semibold px-4 py-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold px-4 py-2 rounded-full"
        style={{ background: "#E7DCF7", color: C.purple }}
      >
        Write a passcode
      </button>
    );
  }

  return (
    <div className="rounded-xl p-3" style={look(FAMILY.amber)}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="their name, as you would say it"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2"
        style={fieldLook(FAMILY.amber)}
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="their email address"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2"
        style={fieldLook(FAMILY.amber)}
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="a line of your own to add to the letter (optional)"
        className="w-full text-sm rounded-lg px-3 py-2"
        style={fieldLook(FAMILY.amber)}
      />
      {error && <p className="text-xs mt-2 mb-0" style={{ color: C.warn }}>{error}</p>}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => start(async () => {
            setError(null);
            const r = await makePasscode(email, note);
            if (r.ok) setMade(r.passcode ?? null);
            else setError(r.error ?? "It didn't work.");
          })}
          disabled={pending}
          className="text-xs font-semibold px-4 py-2 rounded-full"
          style={{ background: "#2D1B4E", color: "#fff" }}
        >
          {pending ? "Writing…" : "Make the passcode"}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs px-4 py-2 rounded-full" style={{ background: "#E7DCF7", color: C.purple }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** One person waiting, and the two things that can be done about them. */
function Knocking({ w }: { w: Waiting }) {
  const [note, setNote] = useState("");
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const act = (admit: boolean) =>
    start(async () => {
      setError(null);
      const r = await decideOn(w.user_id, admit, note);
      if (!r.ok) setError(r.error ?? "It didn't work.");
    });

  return (
    <div className="py-3" style={{ borderTop: `1px solid ${C.rule}` }}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="m-0 text-sm font-semibold" style={{ color: C.ink }}>
          {w.full_name ?? "No name given"}
        </p>
        <span className="text-[11px] flex-shrink-0" style={{ color: C.ink3 }}>{waited(w.asked_at)}</span>
      </div>

      <p className="m-0 mt-0.5 text-xs" style={{ color: C.ink3 }}>
        {w.email}
        {w.invited_email && w.invited_email.toLowerCase() !== (w.email ?? "").toLowerCase() && (
          <span style={{ color: C.warn }}> · you wrote to {w.invited_email}</span>
        )}
      </p>

      {writing && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={400}
          placeholder="a welcome in your own words — they will read this"
          className="w-full text-sm rounded-lg px-3 py-2 mt-2"
          style={fieldLook(FAMILY.amber)}
        />
      )}

      {error && <p className="text-xs mt-2 mb-0" style={{ color: C.warn }}>{error}</p>}

      <div className="flex gap-2 mt-2 items-center">
        <button
          onClick={() => act(true)}
          disabled={pending}
          className="text-xs font-semibold px-4 py-2 rounded-full"
          style={{ background: C.leaf, color: "#fff" }}
        >
          {pending ? "One moment…" : "Welcome them in"}
        </button>
        <button
          onClick={() => setWriting(!writing)}
          className="text-[11px] font-medium"
          style={{ color: C.purple }}
        >
          {writing ? "Without a note" : "Add a welcome note"}
        </button>
        <span className="flex-1" />
        <button
          onClick={() => act(false)}
          disabled={pending}
          className="text-[11px] font-medium"
          style={{ color: C.ink3 }}
        >
          Decline
        </button>
      </div>
    </div>
  );
}

export default function AtTheDoor({
  waiting, signature, appUrl, alertsOn,
}: { waiting: Waiting[]; signature: string | null; appUrl: string; alertsOn: boolean }) {
  return (
    <section
      className="rounded-2xl px-4 py-4"
      style={
        waiting.length
          ? look(FAMILY.gold)
          : look(FAMILY.violet)
      }
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="m-0 text-xs font-semibold uppercase tracking-widest" style={{ color: waiting.length ? "#8A5A06" : C.ink3 }}>
          At the door{waiting.length ? ` · ${waiting.length}` : ""}
        </p>
      </div>

      {waiting.length === 0 ? (
        <p className="m-0 mt-2 text-xs" style={{ color: C.ink3, lineHeight: 1.55 }}>
          Nobody waiting · Make a passcode and send it with the registration link; new registrants appear here.
        </p>
      ) : (
        <div className="mt-1">
          {waiting.map((w) => <Knocking key={w.user_id} w={w} />)}
        </div>
      )}

      <div className="mt-4">
        <NewPasscode signature={signature} appUrl={appUrl} />
      </div>

      {/* Whether you will be told, or must remember to look */}
      <p className="m-0 mt-3 text-[11px]" style={{ color: alertsOn ? C.leaf : C.warn, lineHeight: 1.5 }}>
        {alertsOn
          ? "You're emailed when someone registers."
          : "Email alerts off · Add RESEND_API_KEY to enable."}
      </p>
    </section>
  );
}
