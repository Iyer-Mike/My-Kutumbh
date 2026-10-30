"use client";

import { useState, useTransition } from "react";
import { FAMILY, look, fieldLook } from "@/lib/brand";
import { addPlanned, removePlanned, setPlannedKey } from "@/app/(app)/family/planned-actions";
import InviteButton from "@/components/InviteButton";

export type PlannedRow = { id: string; name: string; email: string | null; is_key: boolean; joined: boolean };

/**
 * The family, listed by name.
 *
 * Names are a list, not accounts: each person joins with their own login
 * when invited. Who will manage the Kutumbh is a choice the Key Member can
 * change at any time; the role itself moves with the hand-over below.
 */
export default function PlannedMembers({
  rows, isOwner, keyName, inviterName, kutumbhName,
}: {
  rows: PlannedRow[]; isOwner: boolean; keyName: string | null; inviterName: string | null; kutumbhName: string | null;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const planned = rows.find((r) => r.is_key) ?? null;
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "It didn't work. Please try again.");
      else after?.();
    });

  if (rows.length === 0 && !isOwner) return null;

  return (
    <section className="rounded-2xl px-4 py-4" style={look(FAMILY.amber)} aria-label="Family list">
      <p className="m-0 text-xs font-semibold uppercase tracking-widest" style={{ color: "#6A6180" }}>
        Family list
      </p>
      <p className="m-0 mt-1 mb-3 text-xs" style={{ color: "#625A75", lineHeight: 1.5 }}>
        Names of the people in your family. Each joins with their own login when invited.
      </p>

      {/* Who manages the Kutumbh: editable by the Key Member at any time */}
      <div className="rounded-xl px-3 py-2.5 mb-3" style={{ background: "#fff", border: "1.5px solid #F2B531" }}>
        <p className="m-0 text-xs font-semibold" style={{ color: "#7A5A06" }}>★ Key Member{keyName ? `: ${keyName}` : ""}</p>
        <p className="m-0 mt-0.5 text-xs" style={{ color: "#625A75", lineHeight: 1.5 }}>
          Manages this page, the menu and the plans.
        </p>
        {isOwner && rows.some((r) => !r.joined) && (
          <>
            <label htmlFor="planned-key" className="block mt-2 mb-1 text-xs font-semibold" style={{ color: "#241C33" }}>
              Who will manage the Kutumbh?
            </label>
            <select
              id="planned-key"
              value={planned?.id ?? ""}
              disabled={pending}
              onChange={(e) => run(() => setPlannedKey(e.target.value || null))}
              className="w-full px-3 py-2.5 rounded-xl text-sm min-h-11"
              style={fieldLook(FAMILY.amber)}
            >
              <option value="">Me, for now ({keyName ?? "current Key Member"})</option>
              {rows.filter((r) => !r.joined).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            {planned && (
              <p className="m-0 mt-1.5 text-xs" style={{ color: "#625A75", lineHeight: 1.5 }}>
                You stay Key Member until {planned.name} has joined. Then use &ldquo;Hand over&rdquo; below. You can change this choice any time.
              </p>
            )}
          </>
        )}
      </div>

      <ul className="m-0 p-0 list-none grid gap-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl px-3 py-2.5" style={{ background: "#fff", border: "1.5px solid #E0D4F2" }}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="m-0 text-sm font-semibold truncate" style={{ color: "#241C33" }}>
                  {r.name}
                  {r.is_key && <span className="ml-2 text-xs font-bold" style={{ color: "#7A5A06" }}>★ next Key Member</span>}
                </p>
                <p className="m-0 text-xs truncate" style={{ color: "#6A6180" }}>
                  {r.joined ? "Joined ✓" : r.email ?? "Not invited yet"}
                </p>
              </div>
              {isOwner && !r.joined && (
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => setInviting(inviting === r.id ? null : r.id)}
                    className="px-3 min-h-11 rounded-xl text-xs font-semibold text-white" style={{ background: "#241238" }}>
                    {inviting === r.id ? "Close" : "Invite"}
                  </button>
                  <button onClick={() => run(() => removePlanned(r.id))} disabled={pending} aria-label={`Remove ${r.name} from the list`}
                    className="px-3 min-h-11 rounded-xl text-xs font-semibold" style={{ border: "1.5px solid #B0453A", color: "#B0453A" }}>
                    Remove
                  </button>
                </div>
              )}
              {isOwner && r.joined && (
                <button onClick={() => run(() => removePlanned(r.id))} disabled={pending}
                  className="px-3 min-h-11 rounded-xl text-xs font-semibold shrink-0" style={{ border: "1.5px solid #B8A8D8", color: "#6B46B8" }}>
                  Clear
                </button>
              )}
            </div>
            {isOwner && inviting === r.id && (
              <div className="mt-3">
                <InviteButton inviterName={inviterName} kutumbhName={kutumbhName} initialEmail={r.email} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <form
          className="mt-3 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addPlanned(name, email, false), () => { setName(""); setEmail(""); });
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a name" aria-label="Name"
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none" style={fieldLook(FAMILY.amber)} maxLength={60} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" aria-label="Email (optional)" type="email"
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none" style={fieldLook(FAMILY.amber)} />
          <button type="submit" disabled={!name.trim() || pending}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 min-h-11" style={{ background: "#241238" }}>
            {pending ? "One moment…" : "Add to the list"}
          </button>
        </form>
      )}

      {error && (
        <p className="mt-2 mb-0 text-xs rounded-lg px-3 py-2" style={{ ...look(FAMILY.red), color: FAMILY.red.ink }}>{error}</p>
      )}
    </section>
  );
}
