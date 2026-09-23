"use client";

import { useState } from "react";

export default function InviteButton() {
  const [code,    setCode]    = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied,  setCopied]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/invite/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to generate link"); return; }
      setCode(data.code);
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(`${baseUrl}/join/${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked — user can copy manually */
    }
  }

  if (!code) {
    return (
      <div>
        <button
          onClick={generate}
          disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "#241238" }}
        >
          {loading ? "Generating…" : "🔗 Create Invite Link"}
        </button>
        {error && (
          <p className="text-xs text-center mt-2" style={{ color: "#C0392B" }}>{error}</p>
        )}
      </div>
    );
  }

  const link = `${baseUrl}/join/${code}`;

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl px-4 py-3"
        style={{ background: "#E7DCF7", border: "1px solid #CBB4EE" }}
      >
        <p className="text-xs font-semibold mb-1" style={{ color: "#6B46B8" }}>Invite link (valid 7 days)</p>
        <p
          className="text-xs break-all font-mono"
          style={{ color: "#241238" }}
          aria-label="Invite link"
        >
          {link}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={copy}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: copied ? "#6B46B8" : "#241238", color: "#fff" }}
        >
          {copied ? "Copied ✓" : "Copy Link"}
        </button>
        <button
          onClick={generate}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "#EDE7F7", color: "#625A75", border: "1px solid #E0D4F2" }}
          title="Generate a new link (deactivates the old one)"
        >
          ↺
        </button>
      </div>
    </div>
  );
}
