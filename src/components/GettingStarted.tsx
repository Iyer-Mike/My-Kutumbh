"use client";

import { useEffect, useState } from "react";

const KEY = "mk-tour-done-v1";

/**
 * Three lines for a first visit, then gone for good (on this phone).
 * Remembered per phone only; if storage is blocked it simply shows once per visit.
 */
export default function GettingStarted() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try { setShow(localStorage.getItem(KEY) !== "1"); } catch { setShow(true); }
  }, []);

  if (!show) return null;

  function done() {
    try { localStorage.setItem(KEY, "1"); } catch { /* private window */ }
    setShow(false);
  }

  return (
    <section className="rounded-2xl px-4 py-3.5 mb-4" style={{ background: "#fff", border: "2.5px solid #6B46B8" }} aria-label="Getting started">
      <p className="m-0 mb-2 text-sm font-bold" style={{ color: "#241C33" }}>Getting started</p>
      <ul className="m-0 pl-0 list-none grid gap-1.5 text-sm" style={{ color: "#4A4360", lineHeight: 1.5 }}>
        <li>📅 <b>Week strip</b> — tap a day to see its menu and what you ate.</li>
        <li>🍽️ <b>Meal cards</b> — tap one to open it; use <b>Log</b> to add what you ate.</li>
        <li>🧺 <b>Pantry</b> and <b>Recipes</b> are at the bottom of this page.</li>
      </ul>
      <button onClick={done} className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold text-white min-h-11" style={{ background: "#241238" }}>
        Got it
      </button>
    </section>
  );
}
