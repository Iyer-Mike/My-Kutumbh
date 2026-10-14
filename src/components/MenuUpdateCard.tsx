"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FAMILY, look } from "@/lib/brand";

export type MenuChange = { date: string; label: string; lines: string[] };

/** What the Key Member changed on the menu since this member last looked. */
export default function MenuUpdateCard({ changes, userId, kutumbhId }: { changes: MenuChange[]; userId: string; kutumbhId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);
  if (!changes.length || gone) return null;

  const gotIt = () => start(async () => {
    const supabase = createClient();
    await supabase.from("menu_seen").upsert({ user_id: userId, kutumbh_id: kutumbhId, seen_at: new Date().toISOString() });
    setGone(true);
    router.refresh();
  });

  return (
    <section className="rounded-2xl px-4 py-3 mb-4" style={look(FAMILY.gold)} aria-live="polite">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <p className="text-xs font-semibold uppercase tracking-widest m-0" style={{ color: "#8A5A06" }}>🍽 Menu updated</p>
        <button onClick={gotIt} disabled={pending} className="text-xs font-semibold rounded-full px-3 min-h-8"
          style={{ background: "#FFFFFF", color: "#241C33" }}>Got it</button>
      </div>
      <div className="space-y-2">
        {changes.map((c) => (
          <div key={c.date}>
            <Link href={`/dashboard?date=${c.date}`} className="text-sm font-semibold" style={{ color: "#241C33" }}>{c.label}</Link>
            <ul className="m-0 mt-0.5 pl-4 text-sm" style={{ color: "#4A4360" }}>
              {c.lines.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
