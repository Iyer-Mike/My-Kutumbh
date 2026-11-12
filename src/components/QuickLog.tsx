"use client";

import { useEffect, useRef, useState } from "react";
import { VOICE_LANGS, MAX_MEAL_TEXT } from "@/lib/meal-parse";

/** What the matcher returns for one phrase; `food` is the dish row from the family's list. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Found = { phrase: string; quantity: number; food: any | null };

// The browser's own speech recogniser; not in every browser, so the mic only shows where it exists
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function recogniser(): any | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const STEPS = ["Capture", "Review", "Confirm"] as const;

/**
 * Say or type a whole meal. Matched dishes are put on the plate in the panel below
 * (the same ticked list as ever), where the person reviews and taps Save.
 * Nothing is saved from here.
 */
export default function QuickLog({ onAdd }: { onAdd: (food: never, quantity: number) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [lang, setLang] = useState<string>(VOICE_LANGS[0].code);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<Found[] | null>(null);
  const rec = useRef<{ stop: () => void } | null>(null);
  const [canListen, setCanListen] = useState(false);
  useEffect(() => { setCanListen(recogniser() != null); }, []);

  const step = found ? 1 : 0;

  function listen() {
    const R = recogniser();
    if (!R) return;
    if (listening) { rec.current?.stop(); return; }
    const r = new R();
    r.lang = lang; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const said = Array.from(e.results).map((x) => x[0].transcript).join(" ");
      setText((t) => `${t} ${said}`.trim().slice(0, MAX_MEAL_TEXT));
    };
    r.onerror = () => { setListening(false); setError("Couldn't hear that. Try again, or type it."); };
    r.onend = () => setListening(false);
    rec.current = r;
    setError(null); setListening(true);
    r.start();
  }

  async function find() {
    if (!text.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/parse-meal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't read that."); return; }
      const items = (data.items ?? []) as Found[];
      setFound(items);
      // Matched dishes go straight onto the plate below; nothing is saved yet
      for (const i of items) if (i.food) onAdd(i.food as never, i.quantity);
    } catch {
      setError("No connection. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function reset() { setText(""); setFound(null); setError(null); }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-2xl px-4 py-3 text-left flex items-center justify-between gap-3 min-h-11"
        style={{ background: "#EDE7F7", border: "1.5px solid #6B46B8" }}>
        <span>
          <span className="block text-sm font-bold" style={{ color: "#4B2E8A" }}>Say or type your meal</span>
          <span className="block text-xs" style={{ color: "#6A6180" }}>&ldquo;2 idli, sambar and a coffee&rdquo; · English, हिन्दी, தமிழ், తెలుగు, ಕನ್ನಡ</span>
        </span>
        <span aria-hidden className="text-lg" style={{ color: "#6B46B8" }}>🎤</span>
      </button>
    );
  }

  return (
    <section className="rounded-2xl px-4 py-3 grid gap-2.5" style={{ background: "#fff", border: "2px solid #6B46B8" }} aria-label="Say or type your meal">
      <div className="flex items-center justify-between gap-2">
        <ol className="m-0 p-0 list-none flex items-center gap-1.5 text-[11px] font-semibold">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full" style={i === step ? { background: "#6B46B8", color: "#fff" } : { background: "#EDE7F7", color: "#6A6180" }}>{i + 1}. {s}</span>
              {i < STEPS.length - 1 && <span aria-hidden style={{ color: "#6A6180" }}>›</span>}
            </li>
          ))}
        </ol>
        <button onClick={() => { reset(); setOpen(false); }} className="text-xs underline" style={{ color: "#6A6180" }}>Close</button>
      </div>

      {!found ? (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, MAX_MEAL_TEXT))} rows={2}
            placeholder="What did you eat? e.g. 2 idli, sambar and a coffee"
            aria-label="What did you eat"
            className="w-full rounded-xl px-3 py-2 text-sm" style={{ border: "1.5px solid #6B46B8", color: "#241C33" }} />
          <div className="flex items-center gap-2 flex-wrap">
            {canListen && (
              <>
                <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Voice language"
                  className="rounded-lg px-2 py-2 text-sm min-h-11" style={{ border: "1.5px solid #6B46B8", background: "#fff" }}>
                  {VOICE_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
                <button onClick={listen} className="rounded-lg px-3 py-2 text-sm font-semibold min-h-11"
                  style={listening ? { background: "#B42318", color: "#fff" } : { background: "#EDE7F7", color: "#4B2E8A" }}>
                  {listening ? "● Stop" : "🎤 Speak"}
                </button>
              </>
            )}
            <button onClick={find} disabled={busy || !text.trim()} className="rounded-lg px-4 py-2 text-sm font-semibold text-white min-h-11 ml-auto disabled:opacity-50"
              style={{ background: "#6B46B8" }}>{busy ? "Finding…" : "Find dishes"}</button>
          </div>
          <p className="m-0 text-[11px]" style={{ color: "#6A6180" }}>
            Your words are sent to the AI only to recognise dishes from your family's list. Nothing is saved until you tap Save below.
          </p>
        </>
      ) : (
        <>
          {found.length === 0 && <p className="m-0 text-sm" style={{ color: "#241C33" }}>Nothing recognised. Try again, or search below.</p>}
          {found.map((f, n) => (
            <p key={n} className="m-0 text-sm flex justify-between gap-3" style={{ color: "#241C33" }}>
              <span>{f.food ? <>✓ {f.food.name}</> : <>? {f.phrase}</>}</span>
              <span className="text-xs shrink-0" style={{ color: f.food ? "#2F6B33" : "#9A2C1B" }}>
                {f.food ? `${f.quantity} added to your plate` : "not in your family's list: search below"}
              </span>
            </p>
          ))}
          <p className="m-0 text-xs font-semibold" style={{ color: "#4B2E8A" }}>Next: check the amounts on your plate below, then tap Save to confirm.</p>
          <button onClick={reset} className="text-xs underline justify-self-start" style={{ color: "#6A6180" }}>Start again</button>
        </>
      )}
      {error && <p className="m-0 text-xs" role="alert" style={{ color: "#B42318" }}>{error}</p>}
    </section>
  );
}
