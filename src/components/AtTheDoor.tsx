"use client";

import { useState, useTransition } from "react";
import { decideOn } from "@/app/(app)/admin/door-actions";
import { FAMILY, look, fieldLook } from "@/lib/brand";
import { decisionLetter } from "@/lib/door-letter";
import type { Newcomer } from "@/lib/admin";

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

/** One person waiting, and the two things that can be done about them. */
function Knocking({ w, signature }: { w: Waiting; signature: string | null }) {
  const [note, setNote] = useState("");
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const act = (admit: boolean) =>
    start(async () => {
      setError(null);
      const r = await decideOn(w.user_id, admit, note, { name: w.full_name, email: w.email, signature });
      if (!r.ok) setError(r.error ?? "It didn't work.");
    });

  return (
    <div className="py-3" style={{ borderTop: `1px solid ${C.rule}` }}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="m-0 text-sm font-semibold" style={{ color: C.ink }}>
          {w.full_name ?? "No name given"}
        </p>
        <span className="text-xs flex-shrink-0" style={{ color: C.ink3 }}>{waited(w.asked_at)}</span>
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
          className="text-xs font-medium"
          style={{ color: C.purple }}
        >
          {writing ? "Without a note" : "Add a welcome note"}
        </button>
        <span className="flex-1" />
        <button
          onClick={() => act(false)}
          disabled={pending}
          className="text-xs font-medium"
          style={{ color: C.ink3 }}
        >
          Decline
        </button>
      </div>
    </div>
  );
}

/** One newcomer of the last two weeks: where they have got to, and a welcome letter if they have stalled. */
function NewcomerRow({ n, signature, appUrl }: { n: Newcomer; signature: string | null; appUrl: string }) {
  const [copied, setCopied] = useState(false);
  const blocked = n.status === "declined";
  const stalled = !n.family && !n.invited_by && !blocked;
  const letter = decisionLetter({ name: n.full_name, admit: true, note: n.welcome, appUrl, signature });
  const mailto = `mailto:${encodeURIComponent(n.email ?? "")}?subject=${encodeURIComponent(letter.subject)}&body=${encodeURIComponent(letter.text)}`;
  const pill = "text-xs font-semibold px-3 py-2 rounded-full";
  const where = blocked
    ? "Turned away by you."
    : n.family
    ? `In ${n.family}. Nothing to do.`
    : n.invited_by
    ? `Invited by ${n.invited_by}. Will join when they type that family's six-digit number. Nothing to do.`
    : "Registered, but has not named a Kutumbh yet. A welcome letter may help.";

  return (
    <div className="py-3" style={{ borderTop: `1px solid ${C.rule}` }}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="m-0 text-sm font-semibold" style={{ color: C.ink }}>{n.full_name ?? "No name given"}</p>
        <span className="text-xs flex-shrink-0" style={{ color: C.ink3 }}>{waited(n.joined)}</span>
      </div>
      <p className="m-0 mt-0.5 text-xs" style={{ color: C.ink3 }}>{n.email}</p>
      <p className="m-0 mt-1 text-xs" style={{ color: blocked ? C.warn : n.family ? C.leaf : C.ink2, lineHeight: 1.5 }}>{where}</p>
      {stalled && (
        <div className="flex flex-wrap gap-2 mt-2">
          {n.email && <a href={mailto} className={pill} style={{ background: "#2D1B4E", color: "#fff", textDecoration: "none" }}>Email a welcome</a>}
          <a href={`https://wa.me/?text=${encodeURIComponent(letter.text)}`} target="_blank" rel="noreferrer" className={pill}
            style={{ background: C.leaf, color: "#fff", textDecoration: "none" }}>WhatsApp</a>
          <button className={pill} style={{ background: "#E7DCF7", color: C.purple }}
            onClick={async () => { try { await navigator.clipboard.writeText(letter.text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ } }}>
            {copied ? "Copied ✓" : "Copy the letter"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The door stands open: anyone with a verified email is let in at once, so
 * nothing here waits for the Admin. This is a watch-post: who came in lately,
 * and where each of them has got to.
 */
export default function AtTheDoor({
  waiting, newcomers, signature, appUrl, alertsOn,
}: { waiting: Waiting[]; newcomers: Newcomer[]; signature: string | null; appUrl: string; alertsOn: boolean }) {
  return (
    <section className="rounded-2xl px-4 py-4" style={look(FAMILY.violet)}>
      <p className="m-0 text-xs font-semibold uppercase tracking-widest" style={{ color: C.ink3 }}>
        New registrations · last 2 weeks{newcomers.length ? ` · ${newcomers.length}` : ""}
      </p>
      <p className="m-0 mt-1 text-xs" style={{ color: C.ink3, lineHeight: 1.55 }}>
        Nobody needs your approval: anyone who registers with a verified email is let in at once. This list is for keeping watch. To stop a family, use &ldquo;Pause this family&rdquo; under Households.
      </p>

      {/* Anyone left over from the old waiting room */}
      {waiting.map((w) => <Knocking key={w.user_id} w={w} signature={signature} />)}

      {newcomers.length === 0
        ? <p className="m-0 mt-2 text-xs" style={{ color: C.ink3 }}>Nobody new in the last two weeks.</p>
        : newcomers.map((n) => <NewcomerRow key={n.user_id} n={n} signature={signature} appUrl={appUrl} />)}

      <p className="m-0 mt-3 text-xs" style={{ color: alertsOn ? C.leaf : C.warn, lineHeight: 1.5 }}>
        {alertsOn
          ? "You get an email whenever someone new registers."
          : "Email alerts off · Add RESEND_API_KEY to enable."}
      </p>
    </section>
  );
}
