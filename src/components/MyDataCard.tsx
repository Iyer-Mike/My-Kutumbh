"use client";

import { useState } from "react";

/**
 * What the app holds about you, and how to take it away.
 * Being forgotten is a separate, heavier door — it is not offered here
 * until the export is at least available, so nobody deletes what they
 * have not been able to keep.
 */
export default function MyDataCard() {
  const [taken, setTaken] = useState(false);

  return (
    <section className="rounded-2xl px-4 py-4" style={{ background: "#FAF7FE", border: "1px solid #E0D4F2" }}>
      <p className="text-xs font-semibold uppercase tracking-widest m-0" style={{ color: "#6A6180" }}>
        Your data
      </p>
      <p className="text-xs mt-2 mb-3" style={{ color: "#6A6180" }}>
        Everything the app holds about you — your profile, every meal logged, your medical
        records, what the AI has cost you — in one plain file you can keep or read anywhere.
      </p>

      <a
        href="/api/my-data"
        onClick={() => setTaken(true)}
        className="inline-block text-xs font-semibold px-4 py-2 rounded-full"
        style={{ background: "#E7DCF7", color: "#6B46B8" }}
      >
        Take my data
      </a>

      {taken && (
        <p className="text-[11px] mt-2 mb-0" style={{ color: "#4A7C4A" }}>
          Saved to your downloads. It is yours — nothing here changes.
        </p>
      )}
    </section>
  );
}
