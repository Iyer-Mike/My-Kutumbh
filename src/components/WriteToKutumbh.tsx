"use client";

import { useState, useTransition } from "react";
import { writeToKutumbh } from "@/app/(app)/admin/actions";

/**
 * A short note to one family. It lands in their app, where the Prime
 * Member will see it — no email, no push, nothing that can fail to
 * arrive.
 */
export default function WriteToKutumbh({
  kutumbhId,
  kutumbhName,
  primeName,
  signature,
}: {
  kutumbhId: string;
  kutumbhName: string;
  primeName: string | null;
  signature: string | null;
}) {
  // A letter should open with a name and close with one. The box is
  // filled in already, so neither of us has to remember.
  const opening = primeName ? `Dear ${primeName},

` : "";
  const closing = signature ? `

— ${signature}` : "";
  const blank = `${opening}${closing}`;

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState(blank);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium mt-3 px-3 py-1.5 rounded-full"
        style={{ background: "#E7DCF7", color: "#6B46B8" }}
      >
        {sent ? "Note sent · write another" : "Write to this Kutumbh"}
      </button>
    );
  }

  const send = () => {
    setError(null);
    start(async () => {
      const r = await writeToKutumbh(kutumbhId, title, body);
      if (r.ok) {
        setSent(true);
        setOpen(false);
        setTitle("");
        setBody(blank);
      } else {
        setError(r.error ?? "It didn't go.");
      }
    });
  };

  return (
    <div className="mt-3 rounded-xl p-3" style={{ background: "#F3EEFA", border: "1px solid #E0D4F2" }}>
      <p className="text-[11px] m-0 mb-2" style={{ color: "#6A6180" }}>
        To the Prime Member of {kutumbhName}
      </p>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What it's about"
        maxLength={80}
        className="w-full text-sm rounded-lg px-3 py-2 mb-2"
        style={{ background: "#fff", border: "1px solid #E0D4F2", color: "#241C33" }}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write plainly — they will read it inside the app."
        autoFocus
        onFocus={(e) => e.currentTarget.setSelectionRange(opening.length, opening.length)}
        rows={6}
        maxLength={1200}
        className="w-full text-sm rounded-lg px-3 py-2"
        style={{ background: "#fff", border: "1px solid #E0D4F2", color: "#241C33" }}
      />

      {error && <p className="text-xs mt-2 mb-0" style={{ color: "#B0453A" }}>{error}</p>}

      <div className="flex gap-2 mt-3">
        <button
          onClick={send}
          disabled={pending || !title.trim() || body.trim() === blank.trim()}
          className="text-xs font-semibold px-4 py-2 rounded-full"
          style={{ background: title.trim() && body.trim() !== blank.trim() ? "#2D1B4E" : "#CBB4EE", color: "#fff" }}
        >
          {pending ? "Sending…" : "Send"}
        </button>
        <button
          onClick={() => { setOpen(false); setError(null); }}
          className="text-xs px-4 py-2 rounded-full"
          style={{ background: "#E7DCF7", color: "#6B46B8" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
