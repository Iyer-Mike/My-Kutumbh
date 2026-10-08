"use client";

import { FAMILY, look, fieldLook } from "@/lib/brand";
import { useState } from "react";

/**
 * Inviting someone by name.
 *
 * The link used to be the permission: whoever held it joined. Now the
 * Key Member says who is being invited, and the link admits that
 * person alone — a copy forwarded to a family group opens nothing.
 *
 * The address travels into the sign-up form as well, so joining is one
 * continuous motion rather than three disconnected steps.
 */
export default function InviteButton({ inviterName, kutumbhName }: { inviterName?: string | null; kutumbhName?: string | null }) {
  const [email,   setEmail]   = useState("");
  const [minor,   setMinor]   = useState(false);
  const [code,    setCode]    = useState<string | null>(null);
  const [number,  setNumber]  = useState<string | null>(null);
  const [sentTo,  setSentTo]  = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied,  setCopied]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/invite/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), forMinor: minor }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "The link couldn't be made. Try again."); return; }
      setCode(data.code);
      setNumber(data.joinCode ?? null);
      setSentTo(data.invitedEmail ?? null);
    } catch {
      setError("No connection — try again.");
    } finally {
      setLoading(false);
    }
  }

  // A ready-made email. The number is left out on purpose: it goes by a second route (phone or message).
  const mailSubject = `Join ${kutumbhName ? `our family, ${kutumbhName},` : "our family"} on My-Kutumbh`;
  const mailBody = () =>
    `Hi,\n\nI've invited you to join ${kutumbhName ?? "our family"} on My-Kutumbh, our family's food and health app.\n\n` +
    `1. Open this link: ${baseUrl}/join/${code}\n` +
    `2. When asked, enter the 6-digit number I will tell you separately (by phone or message).\n\n` +
    `The number works once and expires in 24 hours.\n\n${inviterName ? `– ${inviterName}` : "Thanks"}`;
  const [copiedMail, setCopiedMail] = useState(false);
  async function copyMail() {
    try {
      await navigator.clipboard.writeText(`Subject: ${mailSubject}\n\n${mailBody()}`);
      setCopiedMail(true);
      setTimeout(() => setCopiedMail(false), 2500);
    } catch { /* clipboard blocked */ }
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(`${baseUrl}/join/${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked — the link is on screen to copy by hand */
    }
  }

  if (!code) {
    return (
      <div>
        <label htmlFor="invite-email" className="block text-xs font-semibold mb-1.5" style={{ color: "#6A6180" }}>
          Who are you inviting?
        </label>
        <input
          id="invite-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="their email address"
          className="w-full text-sm rounded-xl px-3 py-2.5 mb-2"
          style={fieldLook(FAMILY.amber)}
        />
        <p className="text-[11px] mt-0 mb-3" style={{ color: "#6A6180", lineHeight: 1.5 }}>
          You get a link and a 6-digit number. Send the link; tell them the number.
        </p>

        {/* A child cannot agree to anything; whoever can, does it here */}
        <label
          className="flex gap-2.5 items-start mb-3 rounded-xl px-3 py-2.5 cursor-pointer"
          style={{ background: "#fff", border: `2px solid ${minor ? FAMILY.gold.edge : FAMILY.amber.edge}` }}
        >
          <input
            type="checkbox"
            checked={minor}
            onChange={(e) => setMinor(e.target.checked)}
            className="mt-0.5 flex-shrink-0"
            style={{ accentColor: "#6B46B8", width: "1rem", height: "1rem" }}
          />
          <span className="text-[11px]" style={{ color: minor ? "#6B4A0A" : "#4A4360", lineHeight: 1.55 }}>
            This person is <strong>under eighteen</strong>, and I am their parent or guardian.
            {minor && (
              <>
                {" "}I accept{" "}
                <a href="/privacy" target="_blank" style={{ color: "#8A5A06", fontWeight: 600 }}>
                  what the app knows
                </a>{" "}
                and{" "}
                <a href="/terms" target="_blank" style={{ color: "#8A5A06", fontWeight: 600 }}>
                  its terms
                </a>{" "}
                on their behalf, and this is recorded against my name.
              </>
            )}
          </span>
        </label>

        <button
          onClick={generate}
          disabled={loading || !looksLikeEmail}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "#241238" }}
        >
          {loading ? "Making the link…" : "Create the invitation"}
        </button>

        {error && <p className="text-xs text-center mt-2" style={{ color: "#B0453A" }}>{error}</p>}
      </div>
    );
  }

  const link = `${baseUrl}/join/${code}`;

  return (
    <div className="space-y-3">
      <div className="rounded-xl px-4 py-4 text-center" style={{ background: "#241238" }}>
        <p className="text-[11px] font-semibold uppercase tracking-widest m-0" style={{ color: "#C9B8E4" }}>
          Tell them this number
        </p>
        <p className="m-0 mt-2 font-bold tabular-nums" style={{ fontSize: "2.2rem", letterSpacing: "0.18em", color: "#fff" }}>
          {number}
        </p>
        <p className="text-[11px] m-0 mt-2" style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
          Works once · valid 24 hours
        </p>
      </div>

      <div className="rounded-xl px-4 py-3" style={look(FAMILY.green)}>
        <p className="text-xs font-semibold mb-1" style={{ color: "#6B46B8" }}>
          Send this link (the number is needed to join)
        </p>
        <p className="text-xs break-all font-mono" style={{ color: "#241238" }} aria-label="Invite link">
          {link}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={copy}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: copied ? "#6B46B8" : "#241238", color: "#fff" }}
        >
          {copied ? "Copied ✓" : "Copy the link"}
        </button>
        <button
          onClick={() => { setCode(null); setNumber(null); setSentTo(null); setEmail(""); }}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "#EDE7F7", color: "#625A75", border: "1px solid #E0D4F2" }}
          title="Invite somebody else instead"
        >
          Someone else
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={copyMail}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: copiedMail ? "#6B46B8" : "#E7DCF7", color: copiedMail ? "#fff" : "#6B46B8", border: "1px solid #CBB4EE" }}
        >
          {copiedMail ? "Copied ✓" : "Copy email message"}
        </button>
        {sentTo && (
          <a
            href={`mailto:${encodeURIComponent(sentTo)}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody())}`}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-center"
            style={{ background: "#E7DCF7", color: "#6B46B8", border: "1px solid #CBB4EE" }}
          >
            Open in email
          </a>
        )}
      </div>

      <p className="text-[11px] m-0" style={{ color: "#6A6180", lineHeight: 1.5 }}>
        You&apos;re notified upon joining. 5 wrong attempts cancels the invite.
      </p>
    </div>
  );
}
