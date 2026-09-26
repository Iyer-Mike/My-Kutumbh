"use client";

import { useState, useTransition } from "react";
import { markNoticeRead, replyToAdmin } from "@/app/(app)/admin/actions";

export type Notice = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  from_admin: boolean;
  created_at: string;
  read_at: string | null;
};

/**
 * What the family has been told. Mostly the app itself; sometimes the
 * person who looks after it. The Prime Member may write back.
 */
export default function NoticesCard({ notices, isPrime }: { notices: Notice[]; isPrime: boolean }) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!notices.length) return null;

  const send = () => {
    setError(null);
    start(async () => {
      const r = await replyToAdmin(text);
      if (r.ok) { setDone(true); setReplyTo(null); setText(""); }
      else setError(r.error ?? "It didn't go.");
    });
  };

  return (
    <section className="rounded-2xl px-4 py-4" style={{ background: "#FFFBF2", border: "1px solid #EBD9B4" }}>
      <p className="text-xs font-semibold uppercase tracking-widest m-0 mb-3" style={{ color: "#8A5A06" }}>
        For your Kutumbh
      </p>

      <div className="space-y-3">
        {notices.map((n) => (
          <div key={n.id}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold m-0" style={{ color: "#241C33" }}>{n.title}</p>
              {!n.read_at && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium"
                  style={{ background: "#FBEBCB", color: "#8A5A06" }}>new</span>
              )}
            </div>

            {n.body && (
              <p className="text-sm mt-1 mb-0 whitespace-pre-wrap" style={{ color: "#4A4360" }}>{n.body}</p>
            )}

            <div className="flex gap-3 mt-2">
              {!n.read_at && (
                <button onClick={() => start(async () => { await markNoticeRead(n.id); })}
                  className="text-[11px] font-medium" style={{ color: "#6B46B8" }}>
                  Mark as read
                </button>
              )}
              {isPrime && n.from_admin && !done && (
                <button onClick={() => setReplyTo(replyTo === n.id ? null : n.id)}
                  className="text-[11px] font-medium" style={{ color: "#6B46B8" }}>
                  {replyTo === n.id ? "Never mind" : "Reply"}
                </button>
              )}
            </div>

            {replyTo === n.id && (
              <div className="mt-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  maxLength={1200}
                  placeholder="Say whatever is useful — it goes only to the person who looks after the app."
                  className="w-full text-sm rounded-lg px-3 py-2"
                  style={{ background: "#fff", border: "1px solid #EBD9B4", color: "#241C33" }}
                />
                {error && <p className="text-xs mt-1 mb-0" style={{ color: "#B0453A" }}>{error}</p>}
                <button
                  onClick={send}
                  disabled={pending || !text.trim()}
                  className="text-xs font-semibold px-4 py-2 rounded-full mt-2"
                  style={{ background: text.trim() ? "#2D1B4E" : "#CBB4EE", color: "#fff" }}
                >
                  {pending ? "Sending…" : "Send reply"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {done && (
        <p className="text-xs mt-3 mb-0" style={{ color: "#4A7C4A" }}>
          Sent. Thank you — it genuinely helps.
        </p>
      )}
    </section>
  );
}
