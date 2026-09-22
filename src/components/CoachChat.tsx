"use client";

import { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const INK = "#141814";

/** Light formatting for coach replies: paragraphs, "- " bullets and **bold**. */
function Reply({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const bold = (s: string, k: string) =>
    s.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={`${k}-${i}`}>{part}</b> : part));
  const flush = (k: string) => {
    if (!list.length) return;
    out.push(<ul key={`ul-${k}`} className="list-disc pl-5 grid gap-0.5">{list.map((l, i) => <li key={i}>{bold(l, `${k}-${i}`)}</li>)}</ul>);
    list = [];
  };
  text.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) { list.push(bullet[1]); return; }
    flush(String(i));
    if (line) out.push(<p key={`p-${i}`}>{bold(line.replace(/^#+\s*/, ""), String(i))}</p>);
  });
  flush("end");
  return <div className="grid gap-2 text-sm leading-relaxed" style={{ color: INK }}>{out}</div>;
}

export default function CoachChat({ memberId, firstName, viewingOther }: {
  memberId: string | null; firstName: string; viewingOther: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const who = viewingOther ? firstName : "me";
  const suggestions = viewingOther
    ? [`What should ${firstName} eat more of this week?`, `Explain ${firstName}'s lab report simply`, `Plan a healthy day of meals for ${firstName}`]
    : ["What should I eat more of this week?", "Explain my lab report in simple words", "Plan a healthy day of meals for me"];

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    setError(null);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, member: memberId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reply) {
        setError(data.error ?? "The coach couldn't answer just now. Please try again.");
        setMessages(messages);           // let them resend the same question
        setDraft(q);
        return;
      }
      setMessages([...next, { role: "assistant", content: data.reply }]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    } catch {
      setError("Couldn't reach the coach. Check your connection and try again.");
      setMessages(messages);
      setDraft(q);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      {messages.length === 0 && (
        <>
          <p className="text-sm" style={{ color: "#3A4238" }}>
            Ask anything about food, your lab results or daily habits. Answers use {viewingOther ? `${firstName}'s` : "your"} profile,
            meals, lab report and your family&apos;s dishes.
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} onClick={() => send(s)} disabled={busy}
                className="text-left text-sm px-3 py-2 rounded-xl disabled:opacity-50"
                style={{ background: "#EEF2EC", color: "#1F3D1F", border: "1px solid #CFDCCB" }}>
                {s}
              </button>
            ))}
          </div>
        </>
      )}

      {messages.length > 0 && (
        <div className="grid gap-2.5" aria-live="polite">
          {messages.map((m, i) => (
            m.role === "user" ? (
              <div key={i} className="justify-self-end max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm"
                style={{ background: "#1C2B1C", color: "#fff" }}>
                {m.content}
              </div>
            ) : (
              <div key={i} className="justify-self-start max-w-[92%] rounded-2xl rounded-bl-md px-3.5 py-2.5"
                style={{ background: "#F3F5F0", border: "1px solid #DDE5D8" }}>
                <Reply text={m.content} />
              </div>
            )
          ))}
          {busy && (
            <div className="justify-self-start rounded-2xl px-3.5 py-2 text-sm" style={{ background: "#F3F5F0", color: "#5F675C" }}>
              Thinking about {who === "me" ? "your" : `${firstName}'s`} data…
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#FBE2DC", color: "#8E2A1B" }}>{error}</p>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(draft); }} className="flex items-end gap-2">
        <label htmlFor="coach-input" className="sr-only">Ask the coach</label>
        <textarea id="coach-input" rows={2} value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); } }}
          placeholder={viewingOther ? `Ask about ${firstName}…` : "Ask a question…"} maxLength={2000}
          className="flex-1 rounded-xl px-3 py-2 text-sm resize-none"
          style={{ border: "1.5px solid #CFDCCB", background: "#fff", color: INK, outline: "none" }} />
        <button type="submit" disabled={busy || !draft.trim()}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: "#1C2B1C" }}>
          {busy ? "…" : "Ask"}
        </button>
      </form>

      <p className="text-xs" style={{ color: "#5F675C" }}>
        The coach gives general guidance, not medical advice, and never changes medicines. For symptoms or treatment, speak to your doctor.
      </p>
    </div>
  );
}
