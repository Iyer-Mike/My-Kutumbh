"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FAMILY, look } from "@/lib/brand";
import { cancelInvite } from "@/app/(app)/family/planned-actions";

export type OpenInvite = { id: string; code: string; number: string | null; email: string | null; expires_at: string };

/** "today 5:30 pm", "Wed 5:30 pm": when an invitation runs out, in the reader's own time. */
function until(iso: string): string {
  const d = new Date(iso);
  const day = d.toDateString() === new Date().toDateString()
    ? "today"
    : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return `${day}, ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
}

/**
 * Invitations that are still open, kept where the Key Member can find them
 * again: the number was once shown a single time and lost when the card closed.
 */
export default function OpenInvites({ invites, baseUrl, kutumbhName, inviterName }: {
  invites: OpenInvite[]; baseUrl: string; kutumbhName: string | null; inviterName: string | null;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (invites.length === 0) return null;

  const message = (i: OpenInvite) =>
    `I've invited you to join ${kutumbhName ?? "our family"} on My Kutumb Bhojan, our family's food and health app.\n\n` +
    `1. Open this link: ${baseUrl}/join/${i.code}\n` +
    `2. Create your account${i.email ? ` with ${i.email}` : ""}.\n` +
    `3. Type the 6-digit number I will tell you separately.\n\n` +
    `The invitation is open until ${until(i.expires_at)}.${inviterName ? `\n\n– ${inviterName}` : ""}`;
  const pill = "text-xs font-semibold px-3 py-2 rounded-full";

  return (
    <section className="rounded-2xl px-4 py-4" style={look(FAMILY.green)} aria-label="Open invitations">
      <p className="m-0 text-xs font-semibold uppercase tracking-widest" style={{ color: "#6A6180" }}>
        Open invitations · {invites.length}
      </p>
      <p className="m-0 mt-1 text-xs" style={{ color: "#625A75", lineHeight: 1.5 }}>
        Send the link, and tell them the number separately. Each number works once, for that person only.
      </p>

      {invites.map((i) => (
        <div key={i.id} className="mt-3 rounded-xl px-3 py-3" style={{ background: "#fff", border: `1.5px solid ${FAMILY.green.edge}` }}>
          <p className="m-0 text-sm font-semibold break-all" style={{ color: "#241C33" }}>{i.email ?? "No email given"}</p>
          <p className="m-0 mt-1 text-xs" style={{ color: "#625A75" }}>
            Number to tell them:{" "}
            <span className="font-bold tabular-nums" style={{ fontSize: "1.15rem", letterSpacing: "0.12em", color: "#241238" }}>{i.number ?? "—"}</span>
          </p>
          <p className="m-0 mt-0.5 text-xs" style={{ color: "#625A75" }}>Open until {until(i.expires_at)}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(message(i))}`} target="_blank" rel="noreferrer"
              className={pill} style={{ background: "#2F6B34", color: "#fff", textDecoration: "none" }}>WhatsApp the link</a>
            <button className={pill} style={{ background: "#241238", color: "#fff" }}
              onClick={async () => { try { await navigator.clipboard.writeText(message(i)); setCopied(i.id); setTimeout(() => setCopied(null), 2000); } catch { /* clipboard blocked */ } }}>
              {copied === i.id ? "Copied ✓" : "Copy the message"}
            </button>
            <button className={pill} disabled={pending} style={{ border: "1.5px solid #B0453A", color: "#B0453A" }}
              onClick={() => start(async () => {
                setError(null);
                const r = await cancelInvite(i.id);
                if (!r.ok) setError(r.error ?? "It didn't work. Please try again."); else router.refresh();
              })}>
              Cancel it
            </button>
          </div>
        </div>
      ))}
      {error && <p role="alert" className="m-0 mt-2 text-xs" style={{ color: "#B0453A" }}>{error}</p>}
    </section>
  );
}
