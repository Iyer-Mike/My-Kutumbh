"use client";

import { useEffect, useState } from "react";
import { BRAND as B } from "@/lib/brand";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function keyBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "checking" | "unsupported" | "blocked" | "off" | "on";

/** Phone alerts for menu changes: switched on per phone, by the person holding it. */
export default function MenuAlertsToggle({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!KEY || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setState("unsupported"); return; }
      if (Notification.permission === "denied") { setState("blocked"); return; }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub && Notification.permission === "granted" ? "on" : "off");
      } catch { setState("unsupported"); }
    })();
  }, []);

  if (!KEY || state === "checking") return null;
  // On Home, only offer it to people who haven't decided yet
  if (compact && state !== "off") return null;

  async function turnOn() {
    setBusy(true); setNote(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "blocked" : "off"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY!) });
      const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!r.ok) throw new Error("save");
      setState("on");
      fetch("/api/push/test", { method: "POST" }).catch(() => {});
      setNote("Alerts are on. A test alert is on its way.");
    } catch { setNote("Could not switch this on. Please try again."); }
    finally { setBusy(false); }
  }

  async function sendTest() {
    setBusy(true); setNote(null);
    try {
      const r = await fetch("/api/push/test", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      setNote(r.ok ? "Test alert sent — it should appear within a few seconds." : (j.error ?? "Could not send a test alert."));
    } catch { setNote("Could not send a test alert."); }
    finally { setBusy(false); }
  }

  async function turnOff() {
    setBusy(true); setNote(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
    } catch { setNote("Could not switch this off. Please try again."); }
    finally { setBusy(false); }
  }

  if (compact) {
    return (
      <button onClick={turnOn} disabled={busy} className="text-xs font-semibold rounded-full px-3 py-1.5 min-h-8"
        style={{ background: "rgba(255,255,255,0.14)", color: B.gold }}>
        🔔 Get menu alerts on this phone
      </button>
    );
  }

  return (
    <section className="rounded-2xl px-4 py-4" style={{ background: "#FFFFFF", border: "1px solid #E4DAF3" }}>
      <p className="text-xs font-semibold uppercase tracking-widest m-0 mb-2" style={{ color: "#6A6180" }}>Menu alerts</p>
      <p className="text-sm m-0" style={{ color: "#241C33" }}>
        {state === "on" && "This phone will tell you when the Key Member adds or changes the menu."}
        {state === "off" && "Get a phone alert when the Key Member adds or changes the menu."}
        {state === "blocked" && "Alerts are blocked for this app. Allow notifications in your phone's settings, then come back."}
        {state === "unsupported" && "This phone or browser can't show alerts. On iPhone, add the app to your Home Screen first."}
      </p>
      {(state === "on" || state === "off") && (
        <button onClick={state === "on" ? turnOff : turnOn} disabled={busy}
          className="mt-3 rounded-xl px-4 min-h-11 text-sm font-semibold"
          style={state === "on" ? { background: "#F3EEFA", color: "#241C33" } : { background: "#6B46B8", color: "#FFFFFF" }}>
          {busy ? "One moment…" : state === "on" ? "Turn off on this phone" : "Turn on alerts"}
        </button>
      )}
      {state === "on" && (
        <button onClick={sendTest} disabled={busy} className="mt-3 ml-2 rounded-xl px-4 min-h-11 text-sm font-semibold"
          style={{ background: "#6B46B8", color: "#FFFFFF" }}>Send me a test alert</button>
      )}
      {note && <p className="text-xs mt-2 m-0" style={{ color: /^(Test alert sent|Alerts are on)/.test(note) ? "#2F7D32" : "#A23A1E" }}>{note}</p>}
    </section>
  );
}
